# Plan A — WhoDB x Sealos 集成实施方案

> **Date:** 2026-03-23
> **Status:** Draft
> **Related:** [Data Flow Diagrams](./sealos-integration-dataflow.md) · [方案对比分析](./sealos-integration-analysis.md)

---

## 1. 概述

用定制化 WhoDB 替换 Chat2DB，作为 Sealos dbprovider 的数据库客户端。

**方案核心：** WhoDB 作为独立 Sealos app（`system-whodb`）部署，通过 postMessage 从 dbprovider 接收数据库凭证，自动登录并进入工作区。同时对 UI 进行重度定制，裁剪不需要的功能、适配 Sealos 品牌和中文。

**替换 Chat2DB 的理由：**
- Chat2DB 凭证通过 URL query params + AES 传递，暴露在浏览器历史和 logs 中
- Chat2DB 是闭源产品，无法定制
- WhoDB 是开源的，功能是 Chat2DB 的超集，且技术栈现代（Go + React + GraphQL）

---

## 2. 架构

```
User clicks "Manage Data" in dbprovider
    │
    ▼
dbprovider ── GET K8s Secret ──▶ {host, port, username, password}
    │
    ▼
sealosApp.runEvents('openDesktopApp', {
    appKey: 'system-whodb',
    messageData: { type, action, data: {dbType, connection, theme, lang} }
})
    │
    ▼
Sealos Desktop ── postMessage ──▶ WhoDB Frontend (iframe)
    │
    ▼
WhoDB Frontend ── mutation Login(credentials) ──▶ WhoDB Backend (Go)
    │
    ▼
WhoDB Backend ── GORM/native driver ──▶ Target Database
```

详细数据流图见 [sealos-integration-dataflow.md](./sealos-integration-dataflow.md)。

---

## 3. 数据库支持

| dbprovider (KubeBlocks) | WhoDB Plugin | 支持 |
|------------------------|-------------|:----:|
| `postgresql` | `Postgres` | Yes |
| `apecloud-mysql` | `MySQL` | Yes |
| `mongodb` | `MongoDB` | Yes |
| `redis` | `Redis` | Yes |
| `clickhouse` | `ClickHouse` | Yes |
| `kafka` / `milvus` / `weaviate` | — | No |

覆盖 dbprovider 5 种主要关系型/NoSQL 数据库。Kafka/Milvus/Weaviate 非传统数据库客户端管理范围。

---

## 4. Sealos SDK 集成

轻量接入，只用 SDK 的 "app 注册 + 事件总线" 能力：

| SDK 能力 | 需要 | 说明 |
|---------|:----:|------|
| `createSealosApp()` | Yes | 通知 Desktop "iframe 已就绪" |
| `addEventListener('message')` | Yes | 接收凭证（原生 API，非 SDK） |
| `EVENT_NAME.CHANGE_I18N` | Yes | 同步 Desktop 语言切换 |
| `sealosApp.getSession()` | No | 不需要 kubeconfig |
| `QuotaGuardProvider` | No | WhoDB 不涉及计费 |

集成代码约 50 行。

---

## 5. 改动清单

### 5.1 dbprovider 侧（2 个文件 + 删除）

| 文件 | 改动 |
|------|------|
| `src/pages/dbs/components/dbList.tsx` | `handleManageData()`: Chat2DB 逻辑 → `sealosApp.runEvents('openDesktopApp', { appKey: 'system-whodb', messageData })` |
| `src/pages/db/detail/components/Header.tsx` | 同上 |
| `src/services/chat2db/` | 删除整个目录 |
| `src/constants/chat2db.ts` | 删除 |

### 5.2 WhoDB Frontend

| 改动 | 文件 | 说明 |
|------|------|------|
| SDK 注册 + postMessage 监听 | `src/index.tsx` | `createSealosApp()` + `addEventListener('message')` + origin 白名单 |
| dbType 映射 | `src/config/sealos.ts` (新增) | `postgresql→Postgres`, `apecloud-mysql→MySQL`, `mongodb→MongoDB`, `redis→Redis`, `clickhouse→ClickHouse` |
| 自动登录 | `src/pages/auth/login.tsx` | 检测 sessionStorage pending → 自动 Login mutation → 跳转 workspace |
| 语言同步 | `src/index.tsx` | 监听 `CHANGE_I18N` → i18n 切换 |

### 5.3 WhoDB Backend

| 改动 | 说明 |
|------|------|
| PostHog key 移除 | `core/src/env/env.go` 中 `PosthogAPIKey` 置空 |
| Plugin 注册裁剪 | `core/src/src.go`: 只注册 Postgres、MySQL、MongoDB、Redis、ClickHouse |
| CORS | `WHODB_ALLOWED_ORIGINS` 限制为 Sealos 域名 |

### 5.4 环境变量

```bash
WHODB_DISABLE_UPDATE_CHECK=true
WHODB_ENABLE_AWS_PROVIDER=false
WHODB_DISABLE_CREDENTIAL_FORM=true
WHODB_DISABLE_MOCK_DATA_GENERATION=true
WHODB_ALLOWED_ORIGINS=https://*.sealos.run
WHODB_LOG_LEVEL=warn
WHODB_MAX_PAGE_SIZE=5000
```

---

## 6. UI 定制

### 6.1 保留（核心功能）

| 功能 | 页面/组件 | 代码量 |
|------|----------|--------|
| Table Browser | `pages/storage-unit/` | ~750 LOC |
| Data Grid | `pages/storage-unit/explore-storage-unit.tsx` + `components/table.tsx` | ~2,950 LOC |
| SQL Editor | `pages/raw-execute/` | ~1,180 LOC |
| Graph Visualization | `pages/graph/` + `components/graph/` | ~665 LOC |
| Import / Export | `components/import-data.tsx` + `components/export.tsx` | ~996 LOC |
| Where 条件构建 | `pages/storage-unit/explore-*-where-*` | ~1,096 LOC |
| Code Editor | `components/editor.tsx` | ~529 LOC |
| Schema Viewer | `components/schema-viewer.tsx` | ~182 LOC |

### 6.2 修改

| 功能 | 当前 | 改动 |
|------|------|------|
| Login 页面 | ~1,147 LOC，含 DB 选择器 / 多 profile / SSL / AWS picker | 重写为 ~100 LOC："等待连接" 状态页 + postMessage 自动登录 |
| Sidebar | ~530 LOC，含多 profile 切换 / update 通知 / cloud filter | 精简到 ~200 LOC：保留导航菜单 + schema 选择 |
| Settings | ~317 LOC，含 PostHog toggle / AWS provider 管理 | 精简到 ~150 LOC：保留 UI 偏好 + 分页大小 |
| 主题 | @clidey/ux 默认主题 | CSS 变量适配 Sealos Design System |
| Branding | WhoDB logo / name / favicon | 替换为 Sealos |
| i18n | 英文 | 补充中文 YAML 翻译文件 |

### 6.3 移除

| 功能 | 代码量 | 理由 |
|------|--------|------|
| AI Chat | ~2,035 LOC | Sealos 有自己的 AI 能力，WhoDB AI 需额外 API key |
| AWS Cloud Provider | ~1,045 LOC | Sealos 不用 AWS 发现 |
| Contact Us | ~94 LOC | 替换为 Sealos support |
| Tour / Onboarding | ~300 LOC | WhoDB sample DB tour 不适用 |
| PostHog Analytics | ~500 LOC | 不发数据到 WhoDB 的 PostHog |
| Command Palette | ~329 LOC | 嵌入场景下不需要，可后续加回 |
| Keyboard Shortcuts Help | ~202 LOC | 可后续加回 |
| Mock Data 生成 | ~400 LOC | 生产环境不需要 |
| Desktop 集成 | ~300 LOC | keyring / file picker，非 Desktop app |
| Version Check | ~100 LOC | 环境变量禁用 |
| SQLite plugin | — | Sealos 无 SQLite，不注册 plugin |
| ElasticSearch plugin | — | KubeBlocks 不管理 ES，不注册 plugin |

### 6.4 UI 库选择

**现状：** @clidey/ux v0.39.0 — 基于 Radix UI + Tailwind CSS 的组件库（npm 包）。46 个文件导入，~20 种组件。

**底层和 shadcn/ui 几乎相同：** 都是 Radix UI + Tailwind + CVA + sonner + next-themes。区别是 @clidey/ux 是 npm 包（不可改源码），shadcn/ui 是本地源码（完全可控）。

| | 保留 @clidey/ux | 替换 shadcn/ui |
|--|:-:|:-:|
| 额外工时 | 0 | +4d |
| 组件可定制性 | 低（只能改 CSS 变量） | 高（改组件结构和样式） |
| Sealos 风格深度适配 | 受限 | 完全自主 |
| 社区 | 小众 | 主流 |
| 上游 WhoDB 兼容 | 兼容 | 分叉（import path 差异） |

替换代码变更示例：

```tsx
// Before
import { Button, Dialog, DialogContent, cn } from '@clidey/ux';

// After
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
```

**建议：** 只做主题色彩适配 → 保留 @clidey/ux。需要深度定制组件 → 换 shadcn/ui。

---

## 7. 工时评估

### Phase 1：集成层（最小可用）

| 任务 | 预估 |
|------|------|
| Sealos SDK 集成 + postMessage handler | 0.5d |
| dbType 映射 + 自动登录流程 | 0.5d |
| dbprovider 侧 Chat2DB 替换 | 0.5d |
| 基础联调（dbprovider → Desktop → WhoDB → DB） | 0.5d |
| **小计** | **2d** |

> Phase 1 产出：端到端可用的 demo。WhoDB 原始 UI 不变，但可通过 dbprovider "Manage Data" 按钮一键打开并自动连接数据库。

### Phase 2：UI 裁剪

| 任务 | 预估 |
|------|------|
| 移除 AI Chat 页面 + 路由 + store | 0.5d |
| 移除 AWS / Cloud Provider | 0.5d |
| 移除 Contact Us / Tour / Command Palette | 0.25d |
| 移除 PostHog analytics（前端 + 后端） | 0.25d |
| 移除 Mock Data / Version Check / Desktop 集成 | 0.25d |
| Login 页面简化（重写为 "等待连接" 状态页） | 0.5d |
| Sidebar 精简 | 0.5d |
| 裁剪后回归测试 | 0.5d |
| **小计** | **3.25d** |

### Phase 3：UI 适配

| 任务 | 预估 |
|------|------|
| Sealos 主题适配（CSS 变量、色彩） | 1d |
| Branding（logo、app name、favicon） | 0.25d |
| 中文翻译（补充 YAML） | 1d |
| 语言同步（CHANGE_I18N 事件） | 0.25d |
| 响应式 / iframe 适配 | 0.5d |
| **小计** | **3d** |

### Phase 4：部署 + 验收

| 任务 | 预估 |
|------|------|
| Dockerfile + K8s manifests (Deployment / Service / Ingress) | 0.5d |
| Sealos app 注册（system-whodb，icon / 名称） | 0.25d |
| 端到端验收（5 种 DB × browse + query + import/export + graph） | 1d |
| Bug 修复 buffer | 1d |
| **小计** | **2.75d** |

### 可选：UI 库替换 shadcn/ui

> 与 Phase 2 并行，仅在需要深度定制组件时执行。

| 任务 | 预估 |
|------|------|
| shadcn/ui 初始化 + 安装 ~20 种组件 | 0.5d |
| 批量替换 import path（46 文件） | 0.5d |
| Toast / Theme / ModeToggle 迁移 | 0.5d |
| 组件 API 差异修复 | 1d |
| 样式微调 | 1d |
| 回归测试 | 0.5d |
| **小计** | **4d** |

### 总计

| 路径 | Phase 1 | Phase 2 | Phase 3 | Phase 4 | 总计 |
|------|:-------:|:-------:|:-------:|:-------:|:----:|
| **保留 @clidey/ux** | 2d | 3.25d | 3d | 2.75d | **~11d (2.5 周)** |
| **替换 shadcn/ui** | 2d | 5d | 3d | 2.75d | **~13d (3 周)** |

> - Phase 1 完成即可内部 demo
> - Phase 2 + 3 可并行
> - Phase 4 依赖 Phase 2 + 3 完成
> - shadcn 替换 (4d) 与 Phase 2 裁剪 (3.25d) 并行，取较长路径 + 合并调试

---

## 8. postMessage 消息格式

```typescript
// dbprovider → Desktop → WhoDB
interface SealosWhoDB_Message {
  type: 'InternalAppCall';
  action: 'connectDatabase';
  data: {
    dbName: string;           // e.g., "my-postgres"
    dbType: string;           // e.g., "postgresql", "apecloud-mysql", "mongodb", "redis", "clickhouse"
    connection: {
      host: string;           // e.g., "my-postgres-postgresql.ns-xxx.svc.cluster.local"
      port: string;           // e.g., "5432"
      username: string;
      password: string;
    };
    theme: 'light' | 'dark';
    language: string;         // e.g., "zh", "en"
  };
}
```

WhoDB 接收后映射为 `LoginCredentials`：

```typescript
// WhoDB Login mutation input
{
  Type: typeMap[message.data.dbType],       // "Postgres"
  Hostname: message.data.connection.host,   // "my-postgres-postgresql.ns-xxx.svc"
  Username: message.data.connection.username,
  Password: message.data.connection.password,
  Database: defaultDB[message.data.dbType], // "postgres" / "" / "admin" etc.
  Advanced: [
    { Key: "Port", Value: message.data.connection.port }
  ]
}
```

Type 映射表：

```typescript
const typeMap: Record<string, string> = {
  'postgresql':     'Postgres',
  'apecloud-mysql': 'MySQL',
  'mongodb':        'MongoDB',
  'redis':          'Redis',
  'clickhouse':     'ClickHouse',
};
```

---

## 9. K8s 部署

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: whodb
  labels:
    app: whodb
spec:
  replicas: 1
  selector:
    matchLabels:
      app: whodb
  template:
    metadata:
      labels:
        app: whodb
    spec:
      containers:
        - name: whodb
          image: sealos/whodb:latest
          ports:
            - containerPort: 8080
          env:
            - name: WHODB_DISABLE_UPDATE_CHECK
              value: "true"
            - name: WHODB_ENABLE_AWS_PROVIDER
              value: "false"
            - name: WHODB_DISABLE_CREDENTIAL_FORM
              value: "true"
            - name: WHODB_DISABLE_MOCK_DATA_GENERATION
              value: "true"
            - name: WHODB_ALLOWED_ORIGINS
              value: "https://*.sealos.run"
            - name: WHODB_LOG_LEVEL
              value: "warn"
            - name: WHODB_MAX_PAGE_SIZE
              value: "5000"
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
---
apiVersion: v1
kind: Service
metadata:
  name: whodb
spec:
  selector:
    app: whodb
  ports:
    - port: 8080
      targetPort: 8080
```

单容器，Go 后端 serve 静态前端 + GraphQL API。idle 状态资源消耗低（~50MB RAM）。

---

## 10. 关键文件索引

### WhoDB

| 用途 | 路径 |
|------|------|
| Plugin 接口 | `core/src/engine/plugin.go` |
| Plugin 注册 | `core/src/src.go` |
| GraphQL Schema | `core/graph/schema.graphqls` |
| 认证中间件 | `core/src/auth/auth.go` |
| 连接池 | `core/src/plugins/connection_pool.go` |
| 连接缓存 | `core/src/plugins/connection_cache.go` |
| 环境变量 | `core/src/env/env.go` |
| PostHog key | `core/src/env/env.go` (line ~92) |
| 前端入口 | `frontend/src/index.tsx` |
| 前端路由 | `frontend/src/config/routes.tsx` |
| 前端登录 | `frontend/src/pages/auth/login.tsx` |
| 前端 Sidebar | `frontend/src/components/sidebar/sidebar.tsx` |
| 前端 Auth store | `frontend/src/store/auth.ts` |
| Feature flags | `frontend/src/config/features.ts` |
| GraphQL client | `frontend/src/config/graphql-client.ts` |
| i18n | `frontend/src/locales/` |
| CSS 主题 | `frontend/src/index.css` |

### dbprovider

| 用途 | 路径 |
|------|------|
| Chat2DB 集成 (列表页) | `src/pages/dbs/components/dbList.tsx` → `handleManageData()` |
| Chat2DB 集成 (详情页) | `src/pages/db/detail/components/Header.tsx` → `handleManageData()` |
| Chat2DB 常量 | `src/constants/chat2db.ts` |
| Chat2DB 服务 | `src/services/chat2db/` |
| K8s Secret API | `src/pages/api/getSecretByName.ts` |
| Desktop SDK | `src/pages/_app.tsx` |
| DB 类型映射 | `src/utils/database.ts` |

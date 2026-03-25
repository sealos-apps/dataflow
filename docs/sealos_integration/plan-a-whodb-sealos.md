# Plan A — WhoDB x Sealos 集成实施方案

> **Date:** 2026-03-23
> **Updated:** 2026-03-24
> **Status:** Draft
> **Related:** [Data Flow Diagrams](./sealos-integration-dataflow.md) · [方案对比分析](./sealos-integration-analysis.md)

---

## 1. 概述

用定制化 WhoDB 替换 Chat2DB，作为 Sealos dbprovider 的数据库客户端。

**方案核心：** WhoDB 作为独立 Sealos app（`system-whodb`）部署，dbprovider 通过 `openDesktopApp` + URL query params 传递数据库连接信息（敏感字段 AES 加密），WhoDB 前端解密后立即从 URL 中清除，自动登录并进入工作区。同时对 UI 进行重度定制，裁剪不需要的功能、适配 Sealos 品牌和中文。

**替换 Chat2DB 的理由：**
- Chat2DB 是闭源产品，无法定制
- WhoDB 是开源的，功能是 Chat2DB 的超集，且技术栈现代（Go + React + GraphQL）
- 集成层更简单：无需独立后端 API 同步，环境变量从 4 个减少到 1 个（仅 `WHODB_AES_KEY`）

---

## 2. 架构

```
User clicks "Manage Data" in dbprovider
    │
    ▼
dbprovider ── GET K8s Secret ──▶ {host, port, username, password}
    │
    ▼
dbprovider ── AES encrypt(username, password) ──▶ credential (密文)
    │
    ▼
sealosApp.runEvents('openDesktopApp', {
    appKey: 'system-whodb',
    query: { dbType, host, port, credential, theme, lang }
})
    │
    ▼
Sealos Desktop ── formatUrl() ──▶ WhoDB iframe src (URL with query params)
    │  (URL 中只有密文，无明文 username/password)
    ▼
WhoDB Frontend loads ── reads query params ── AES decrypt(credential, build-time key) ── history.replaceState() clears URL
    │
    ▼
WhoDB Frontend ── mutation Login(credentials) ──▶ WhoDB Backend (Go)
    │
    ▼
WhoDB Backend ── GORM/native driver ──▶ Target Database
```

详细数据流图见 [sealos-integration-dataflow.md](./sealos-integration-dataflow.md)。

### 2.1 为什么用 URL query params 而非 postMessage

Sealos Desktop SDK **没有消息队列机制**：`createSealosApp()` 不会向 Desktop 发送 "已就绪" 信号，Desktop 对 iframe 的 `postMessage` 是 fire-and-forget，没有握手、缓冲或重试。如果 Desktop 在 WhoDB iframe 注册 `message` listener 之前发出 `messageData`，消息直接丢失。

Chat2DB 的生产方案也是 URL query params（`openDesktopApp` 的 `query` 字段），已验证可靠。Desktop 的 `openApp()` 通过 `formatUrl()` 把 `query` 拼进 iframe src，iframe 加载时 URL 已经带上了参数，不存在时序问题。

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

轻量接入，只用 SDK 的 "app 注册 + 语言事件" 能力。凭证通过 URL query params 传递（敏感字段 AES 加密），不依赖 postMessage。

| SDK 能力 | 需要 | 说明 |
|---------|:----:|------|
| `createSealosApp()` | Yes | 初始化 SDK，注册 iframe 与 Desktop 的通信通道 |
| URL query params 读取 | Yes | 从 iframe src URL 读取凭证（原生 API，非 SDK） |
| `EVENT_NAME.CHANGE_I18N` | Yes | 同步 Desktop 语言切换 |
| `sealosApp.getSession()` | No | 不需要 kubeconfig |
| `QuotaGuardProvider` | No | WhoDB 不涉及计费 |

集成代码约 50 行。

---

## 5. 改动清单

### 5.1 dbprovider 侧（2 个文件 + 删除）

| 文件 | 改动 |
|------|------|
| `src/pages/dbs/components/dbList.tsx` | `handleManageData()`: Chat2DB 逻辑 → AES 加密 username/password → `sealosApp.runEvents('openDesktopApp', { appKey: 'system-whodb', query: { dbType, host, port, credential, theme, lang } })` |
| `src/pages/db/detail/components/Header.tsx` | 同上 |
| `src/services/chat2db/` | 删除整个目录（API 同步、JDBC URL 构造不需要；AES 加密逻辑可复用或重写为简化版） |
| `src/constants/chat2db.ts` | 删除 |
| `src/pages/api/proxy/sync_data_source_a.ts` | 删除（不再需要后端 proxy 同步 datasource） |
| `src/store/db.ts` 中 Chat2DB 相关状态 | 删除（dataSourceId 缓存不再需要） |

对比 Chat2DB 集成，dbprovider 侧从 **"三步"（sync → encrypt → openApp with URL）** 简化为 **"两步"（encrypt → openApp with query）**，消除对 `CHAT2DB_API_KEY`、`CLIENT_DOMAIN_NAME`、`GATEWAY_DOMAIN_NAME` 三个环境变量的依赖。`CHAT2DB_AES_KEY` 替换为 `WHODB_AES_KEY`（同为 AES-256-CBC，可复用同一个 key 值）。

### 5.2 WhoDB Frontend

| 改动 | 文件 | 说明 |
|------|------|------|
| URL params 读取 + 解密 + 清除 | `src/index.tsx` | 读取 query params → AES 解密 `credential` 字段（Web Crypto API, build-time key） → `history.replaceState()` 清除 URL → 调用 Login mutation |
| SDK 注册 | `src/index.tsx` | `createSealosApp()` 初始化 |
| dbType 映射 | `src/config/sealos.ts` (新增) | `postgresql→Postgres`, `apecloud-mysql→MySQL`, `mongodb→MongoDB`, `redis→Redis`, `clickhouse→ClickHouse` |
| 自动登录 | `src/pages/auth/login.tsx` | 检测 sessionStorage pending → 自动 Login mutation → 跳转 workspace |
| 语言同步 | `src/index.tsx` | 监听 `CHANGE_I18N` → i18n 切换 |

### 5.3 WhoDB Backend

后端不再处理 Sealos 特有逻辑（解密已移至前端）。

**已完成：**

| 改动 | 说明 | 状态 |
|------|------|:----:|
| SealosLogin mutation 移除 | 删除 `SealosLogin` resolver、GraphQL 类型、`crypto` 包、`GetAESKey()` | ✅ |
| DisableCredentialForm 守卫移除 | `Login` resolver 不再拒绝 programmatic login | ✅ |
| Auth whitelist 清理 | `core/src/auth/auth.go` 中移除 `"SealosLogin"` | ✅ |
| CORS | 运行时配置，部署时设置 `WHODB_ALLOWED_ORIGINS` 即可，代码无需改动 | ✅ |

**待完成：**

| 改动 | 说明 | 文件 |
|------|------|------|
| PostHog key 移除 | `PosthogAPIKey` 仍硬编码为 `phc_hbXcCoPTd...` | `core/src/env/env.go:92-93`、`core/server.go:50` |
| Plugin 注册裁剪 | MariaDB、SQLite3、ElasticSearch 仍注册，需只保留 Postgres、MySQL、MongoDB、Redis、ClickHouse | `core/src/src.go:56-63` |

### 5.4 环境变量

```bash
WHODB_DISABLE_UPDATE_CHECK=true
WHODB_ENABLE_AWS_PROVIDER=false
WHODB_DISABLE_CREDENTIAL_FORM=true
WHODB_DISABLE_MOCK_DATA_GENERATION=true
WHODB_ALLOWED_ORIGINS=https://*.sealos.run
WHODB_LOG_LEVEL=warn
WHODB_MAX_PAGE_SIZE=5000
# Note: WHODB_AES_KEY moved to frontend build-time variable (VITE_WHODB_AES_KEY)
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
| Login 页面 | ~1,147 LOC，含 DB 选择器 / 多 profile / SSL / AWS picker | 重写为 ~100 LOC："等待连接" 状态页 + URL params 自动登录 |
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
| Sealos SDK 集成 + URL params 读取/清除 | 0.5d |
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

## 8. 凭证传递格式

### 8.1 加密策略

只加密敏感字段（`username` + `password`），非敏感字段（`dbType`、`host`、`port`、`theme`、`lang`）保持明文。这样 access log 中只出现密文，同时非敏感字段仍可用于调试。

加密算法：**AES-256-CBC**（与 Chat2DB 一致），密钥为 `WHODB_AES_KEY` 环境变量（32 字符）。

### 8.2 dbprovider 发出（加密 + URL query params）

```typescript
// dbprovider 侧：加密敏感字段
const credential = AES_encrypt(
  JSON.stringify({ username, password }),
  WHODB_AES_KEY   // 32-char AES-256-CBC key
);

// dbprovider → Desktop openDesktopApp
sealosApp.runEvents('openDesktopApp', {
  appKey: 'system-whodb',
  query: {
    dbName:     'my-postgres',                                     // 明文，显示用
    dbType:     'postgresql',                                      // 明文，KubeBlocks 类型名
    host:       'my-postgres-postgresql.ns-xxx.svc.cluster.local', // 明文，集群内地址
    port:       '5432',                                            // 明文
    credential: credential,                                        // 密文，AES(username+password)
    theme:      'light',                                           // 明文，跟随 Desktop
    lang:       'zh',                                              // 明文，跟随 Desktop
  }
});
// Desktop 调用 formatUrl() 将 query 拼入 iframe src URL
// access log 示例: ?dbType=postgresql&host=...&credential=a3f8b2c1e9...&theme=light
```

### 8.3 WhoDB 前端接收 + 解密 + 立即清除

```typescript
// WhoDB 前端入口，iframe 加载后第一时间执行
const params = new URLSearchParams(window.location.search);

// 解密敏感字段（Web Crypto API, build-time key）
const { username, password } = await decryptSealosCredential(
  params.get('credential')!,
  import.meta.env.VITE_WHODB_AES_KEY
);

// 立刻清掉 URL 里的所有参数
window.history.replaceState({}, '', window.location.pathname);

// 直接调用 Login mutation（不再经过 SealosLogin mutation）
login({
  variables: {
    credentials: {
      Type: mapSealosDbType(params.get('dbType')!),
      Hostname: params.get('host'),
      Username: username,
      Password: password,
      Database: getDefaultDatabase(params.get('dbType')!),
      Advanced: [{ Key: 'Port', Value: params.get('port') }],
    }
  }
});
```

### 8.4 映射为 Login mutation 输入

```typescript
// WhoDB Login mutation input
{
  Type: typeMap[credentials.dbType],       // "Postgres"
  Hostname: credentials.host,              // "my-postgres-postgresql.ns-xxx.svc"
  Username: credentials.username,
  Password: credentials.password,
  Database: defaultDB[credentials.dbType], // "postgres" / "" / "admin" etc.
  Advanced: [
    { Key: "Port", Value: credentials.port }
  ]
}
```

### 8.5 Type 映射表

```typescript
const typeMap: Record<string, string> = {
  'postgresql':     'Postgres',
  'apecloud-mysql': 'MySQL',
  'mongodb':        'MongoDB',
  'redis':          'Redis',
  'clickhouse':     'ClickHouse',
};

const defaultDB: Record<string, string> = {
  'postgresql':     'postgres',
  'apecloud-mysql': '',
  'mongodb':        'admin',
  'redis':          '',
  'clickhouse':     'default',
};
```

### 8.6 AES key 传递

`VITE_WHODB_AES_KEY` 需要在 dbprovider 和 WhoDB 前端两侧都可用：

| 侧 | 获取方式 |
|-----|---------|
| dbprovider | 服务端环境变量 `WHODB_AES_KEY`，在 `handleManageData()` 中调用加密 |
| WhoDB 前端 | 构建时注入（`VITE_WHODB_AES_KEY`），Docker build arg 传入 |
| WhoDB 后端 | 不再需要（解密已移至前端） |

---

## 9. 安全分析

### 9.1 凭证暴露面

WhoDB 运行在 Sealos Desktop 的 **iframe** 内，不是顶层页面。敏感字段（username/password）在 URL 中以 AES 密文形式传输。

| 暴露渠道 | 明文暴露 | 说明 |
|----------|:--------:|------|
| 浏览器地址栏 | **否** | iframe 内 URL 不显示在地址栏 |
| 浏览器历史记录 | **否** | iframe 导航不写入 history |
| DevTools Elements/Network | 短暂密文 | `replaceState()` 执行前可见密文（几毫秒），之后 iframe src 已清除 |
| Referer（跨域请求） | **否** | 浏览器默认策略 `strict-origin-when-cross-origin`，跨域只发 origin |
| Referer（同源请求） | 短暂密文 | `replaceState()` 之后 Referer 也变干净，只有首次请求可能携带密文 |
| Nginx/Ingress access log | **否（密文）** | access log 记录的是 `credential=a3f8b2c1e9...`，无法直接读出明文 |
| sessionStorage | 短暂明文 | 解密后的明文存在当前 tab 的 sessionStorage 中，关闭 tab 自动清除 |

### 9.2 防护措施

1. **AES-256-CBC 加密** — username/password 在 URL 中始终是密文，access log、DevTools、Referer 中都无法直接读出明文
2. **`history.replaceState()`** — 即便是密文也只在 URL 中存在几毫秒，之后 URL 完全干净
3. **sessionStorage** — 解密后的明文存在当前 tab 的 sessionStorage 中，关闭 tab 自动清除，不跨 tab 共享
4. **非敏感字段明文** — `dbType`、`host`、`port` 等保持明文，便于调试和日志分析，不构成安全风险

### 9.3 与 Chat2DB 的安全性对比

| | Chat2DB（现状） | WhoDB（本方案） |
|--|--|--|
| 加密算法 | AES-256-CBC | AES-256-CBC（相同） |
| 加密范围 | 整个 `userId/userNS:orgId` token | `username` + `password` 字段 |
| URL 中是否有明文凭证 | 否（密文） | 否（密文） |
| 需要独立后端同步 | 是（sync_data_source_a API） | 否 |
| 环境变量数量 | 4 个 | 1 个（`WHODB_AES_KEY`） |
| access log 安全 | 密文 | 密文 |

### 9.4 信任模型说明

无论传输方式（URL params / postMessage / AES 加密），Sealos 平台侧始终可以看到用户数据库凭证——因为凭证的源头是平台管理的 K8s Secret，平台也持有 AES key。这不是 WhoDB 集成引入的新风险，而是 Sealos 架构的固有属性。

AES 加密的目标是**防止非平台方**（日志聚合系统操作员、能看到 access log 但没有 K8s Secret 权限的人）直接读取到明文凭证。

---

## 10. K8s 部署

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
            - name: WHODB_AES_KEY
              valueFrom:
                secretKeyRef:
                  name: whodb-secrets
                  key: aes-key
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

## 11. 关键文件索引

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

| 用途 | 路径 | 操作 |
|------|------|------|
| Chat2DB 集成 (列表页) | `src/pages/dbs/components/dbList.tsx` → `handleManageData()` | 改为 WhoDB query params |
| Chat2DB 集成 (详情页) | `src/pages/db/detail/components/Header.tsx` → `handleManageData()` | 改为 WhoDB query params |
| Chat2DB 常量 | `src/constants/chat2db.ts` | 删除 |
| Chat2DB 服务 | `src/services/chat2db/` | 删除整个目录 |
| Chat2DB 后端 proxy | `src/pages/api/proxy/sync_data_source_a.ts` | 删除 |
| Chat2DB 状态缓存 | `src/store/db.ts` 中 dataSourceId 相关 | 删除 |
| K8s Secret API | `src/pages/api/getSecretByName.ts` | 保留（仍需获取凭证） |
| Desktop SDK | `src/pages/_app.tsx` | 保留 |
| DB 类型映射 | `src/utils/database.ts` | 保留 |

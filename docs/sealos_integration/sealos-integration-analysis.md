# Sealos x WhoDB 集成方案分析

> **Date:** 2026-03-23
> **Author:** sealos
> **Status:** Draft
> **Related:** [Data Flow Diagrams](./sealos-integration-dataflow.md) · [Original DB Manager Design](/Users/sealos/Library/Mobile%20Documents/com~apple~CloudDocs/Documents/Obsidian/aimerite_cc/Notes/DB-Manager-Message-Flow-Design.md)

---

## 1. 背景

### 1.1 现状

dbprovider 当前使用 **Chat2DB** 作为数据库客户端。用户在 dbprovider 点击 "Manage Data" 后，系统通过以下方式打开 Chat2DB：

1. 从 K8s Secret 获取数据库凭证
2. 用 AES 加密凭证，拼入 Chat2DB 的 URL query params
3. 通过 `sealosApp.runEvents('openDesktopApp', { appKey: 'system-chat2db' })` 打开
4. Chat2DB 解密 URL 参数，创建 datasource，建立连接

**问题：**
- 凭证通过 URL 传递，暴露在浏览器历史、Referer header、server logs 中
- 需要维护 AES 加密密钥
- 需要额外的 datasource sync API（`syncDatasource`、`syncDatasourceFirst`）
- Chat2DB 是独立的闭源产品，定制能力有限

### 1.2 原计划

原计划是新建一个 Sealos provider —— **DB Manager**，从零构建数据库客户端（SQL editor、data browser、schema inspection），通过 postMessage 接收凭证。详见原设计文档。

### 1.3 新方向

用 **WhoDB**（开源数据库管理工具）替代从零构建。WhoDB 已具备完整的数据库客户端功能，只需添加集成层即可对接 Sealos。

---

## 2. WhoDB 能力评估

### 2.1 功能覆盖

DB Manager 设计中要求的全部功能，WhoDB 均已实现：

| 需求功能 | WhoDB 对应能力 | 实现层 |
|---------|---------------|--------|
| SQL Editor | `RawExecute` query + CodeMirror 编辑器 | GraphQL + Frontend |
| Data Browser | `Row` query + 分页表格 + Where/Sort 条件 | GraphQL + Frontend |
| Schema Inspection | `Schema` / `StorageUnit` / `Columns` / `Graph` queries | GraphQL + Frontend |
| 连接管理 | `Login` mutation + connection cache + connection pool | GraphQL + Backend |

WhoDB 还额外提供以下功能：

| 额外功能 | 说明 |
|---------|------|
| AI Chat | 自然语言生成 SQL，支持 OpenAI / Anthropic / Ollama / 自定义 provider |
| Graph Visualization | 表关系可视化（ReactFlow + Dagre 布局） |
| 数据导入/导出 | CSV / Excel / SQL 导入，CSV 导出 |
| Mock Data 生成 | 支持外键约束的测试数据批量生成 |
| 表结构管理 | 创建表、修改列、添加/删除行 |

### 2.2 数据库支持

| dbprovider (KubeBlocks) | WhoDB Plugin | 支持状态 |
|------------------------|-------------|---------|
| `postgresql` | `Postgres` | 完整支持 |
| `apecloud-mysql` | `MySQL` | 完整支持 |
| `mongodb` | `MongoDB` | 完整支持 |
| `redis` | `Redis` | 完整支持 |
| `clickhouse` | `ClickHouse` | 完整支持 |
| `kafka` | — | 不支持（无 plugin） |
| `milvus` | — | 不支持 |
| `weaviate` | — | 不支持 |

覆盖 dbprovider 5 种主要数据库类型。Kafka / Milvus / Weaviate 为向量或消息队列类数据库，不属于传统数据库客户端的管理范围。

### 2.3 技术栈

| 层 | 技术 |
|----|------|
| Backend | Go 1.26, Chi router, gqlgen (GraphQL), GORM |
| Frontend | React 18, TypeScript, Vite, Redux Toolkit, Apollo Client, Tailwind CSS, CodeMirror 6, ReactFlow |
| 部署 | 单容器（Go 静态 serve 前端 build + GraphQL API） |

---

## 3. 集成方案 — 方案 A 详细设计

> WhoDB 作为独立 Sealos app 部署，通过 postMessage 接收凭证，同时进行 UI 重度定制。

### 3.1 整体架构

```
User → dbprovider → K8s Secret → sealosApp.runEvents('openDesktopApp')
    → Sealos Desktop → postMessage → WhoDB Frontend
    → Auto Login mutation → WhoDB Backend → Database
```

WhoDB 以独立 Sealos 应用身份运行（`system-whodb`），需要轻量接入 Sealos Desktop SDK + 重度 UI 定制。

### 3.2 Sealos SDK 集成（轻量）

WhoDB 不需要 kubeconfig 或计费系统，只需 SDK 的"app 注册 + 事件总线"能力：

| SDK 能力 | 是否需要 | 说明 |
|---------|:-------:|------|
| `createSealosApp()` | 是 | 告诉 Desktop iframe 加载完毕，可以接收消息 |
| `addEventListener('message')` | 是 | 接收 dbprovider 传来的凭证（原生 API，非 SDK） |
| `EVENT_NAME.CHANGE_I18N` | 是 | 同步 Desktop 语言切换 |
| `sealosApp.getSession()` | **否** | 方案 A 不需要 kubeconfig |
| `QuotaGuardProvider` | **否** | WhoDB 不涉及计费 |

集成代码量约 50 行。`sealos-desktop-sdk` 是 Sealos monorepo 的 workspace 包，需要在 WhoDB 构建流程中处理（npm 发包或 git submodule）。

### 3.3 postMessage 凭证传递

**dbprovider 侧改动（2 个文件）：**

| 文件 | 改动 |
|------|------|
| `src/pages/dbs/components/dbList.tsx` | `handleManageData()`: 替换 Chat2DB → `sealosApp.runEvents('openDesktopApp', { appKey: 'system-whodb', messageData })` |
| `src/pages/db/detail/components/Header.tsx` | 同上 |
| `src/services/chat2db/` + `src/constants/chat2db.ts` | 删除 |

**WhoDB 侧改动：**

| 改动点 | 文件 | 内容 |
|--------|------|------|
| SDK 注册 + postMessage 监听 | `frontend/src/index.tsx` | `createSealosApp()` + `addEventListener('message', handler)` + origin 白名单 |
| dbType 映射 | `frontend/src/config/sealos.ts` (新增) | `postgresql→Postgres`, `apecloud-mysql→MySQL`, `mongodb→MongoDB`, `redis→Redis`, `clickhouse→ClickHouse` |
| 自动登录 | `frontend/src/pages/auth/login.tsx` | 检测 sessionStorage pending connection → 自动调用 Login mutation → 跳转 workspace |
| 语言同步 | `frontend/src/index.tsx` | 监听 `CHANGE_I18N` 事件，调用 i18n 切换 |

### 3.4 UI 重度定制

WhoDB 原始 UI 是通用数据库管理工具，面向独立用户。嵌入 Sealos 后需要移除不相关功能、适配 Sealos 风格。

#### 3.4.1 功能清单 — 保留 / 修改 / 移除

**保留（核心功能）：**

| 功能 | 页面/组件 | 代码量 | 说明 |
|------|----------|--------|------|
| Table Browser | `pages/storage-unit/` | ~750 LOC | 核心：表列表、列结构预览 |
| Data Grid | `pages/storage-unit/explore-storage-unit.tsx` + `components/table.tsx` | ~2,950 LOC | 核心：数据浏览、CRUD、分页、筛选、排序 |
| SQL Editor | `pages/raw-execute/` | ~1,180 LOC | 核心：SQL 执行、历史、多 tab 结果 |
| Graph Visualization | `pages/graph/` + `components/graph/` | ~665 LOC | 表关系可视化 |
| Import / Export | `components/import-data.tsx` + `components/export.tsx` | ~996 LOC | CSV/Excel/SQL 导入导出 |
| Where 条件构建 | `pages/storage-unit/explore-*-where-*` | ~1,096 LOC | 可视化筛选条件 |
| Code Editor | `components/editor.tsx` | ~529 LOC | CodeMirror SQL 编辑器 |
| Schema Viewer | `components/schema-viewer.tsx` | ~182 LOC | 列结构展示 |

**修改：**

| 功能 | 改动 | 代码量 |
|------|------|--------|
| Login 页面 (`pages/auth/login.tsx`, ~1,147 LOC) | 大幅简化：移除数据库类型选择器、多 profile 管理、SSL 配置、AWS picker。只保留 postMessage 自动登录 + 简单的"等待连接"状态页 | 重写为 ~100 LOC |
| Sidebar (`components/sidebar/sidebar.tsx`, ~530 LOC) | 移除：多 profile 切换、新连接按钮、update 通知、cloud provider filter。保留：导航菜单、schema 选择 | 精简到 ~200 LOC |
| Settings (`pages/settings/`, ~317 LOC) | 移除：PostHog telemetry toggle、AWS provider 管理。保留：UI 偏好（字体、间距、暗色模式）、分页大小 | 精简到 ~150 LOC |
| 主题系统 | 适配 Sealos Design System 色彩，替换 @clidey/ux 默认主题变量 | CSS 变量调整 |
| Branding | 替换 logo、app name、favicon | 资源替换 |
| i18n | 添加中文翻译（WhoDB 已有 i18n 框架，补充 YAML） | 新增翻译文件 |

**移除：**

| 功能 | 文件 | 代码量 | 移除理由 |
|------|------|--------|---------|
| AI Chat | `pages/chat/` (~1,500 LOC)、`components/ai.tsx` (~535 LOC) | ~2,035 LOC | Sealos 有自己的 AI 能力，WhoDB 内置 AI 需要额外 API key 配置 |
| AWS Cloud Provider | `components/aws/` (~1,045 LOC) | ~1,045 LOC | Sealos 不用 AWS 发现 |
| Contact Us | `pages/contact-us/` (~94 LOC) | ~94 LOC | 替换为 Sealos support |
| Tour / Onboarding | `components/tour/` + `config/tour-config.tsx` | ~300 LOC | WhoDB 的 sample DB tour 不适用 |
| PostHog Analytics | `components/analytics/` + backend `analytics/posthog.go` | ~500 LOC | 替换或移除，不发送数据到 WhoDB 的 PostHog |
| Version Check | backend `version/check.go` | ~100 LOC | 通过 `WHODB_DISABLE_UPDATE_CHECK=true` 禁用 |
| Desktop 集成 | `services/desktop.ts`、keyring、file picker | ~300 LOC | 不在 Desktop app 中运行 |
| Command Palette | `components/command-palette.tsx` (~329 LOC) | ~329 LOC | 嵌入场景下过于复杂，可后续考虑 |
| Keyboard Shortcuts Help | `components/keyboard-shortcuts-help.tsx` (~202 LOC) | ~202 LOC | 可后续添加 |
| Mock Data 生成 | 前端 UI + 后端 `mockdata/` | ~400 LOC | 生产环境不需要 |
| SQLite 支持 | plugins/sqlite3 + 前端 file picker | — | Sealos 无 SQLite 场景，通过不注册 plugin 禁用 |
| ElasticSearch 支持 | plugins/elasticsearch | — | KubeBlocks 不管理 ES，通过不注册 plugin 禁用 |

#### 3.4.2 UI 库选择 — @clidey/ux vs shadcn/ui

**现状：** WhoDB 使用 **@clidey/ux v0.39.0**，一个基于 Radix UI + Tailwind CSS 的组件库（npm 包形式发布）。46 个文件导入了该库，使用约 20 种组件。

**@clidey/ux 底层依赖：**
- Radix UI（16 个 primitives：dialog、select、tooltip、popover 等）
- Tailwind CSS v4
- class-variance-authority（组件变体）
- cmdk（命令面板）
- sonner（toast 通知）
- next-themes（暗色模式）
- lucide-react（图标）

**这和 shadcn/ui 几乎相同的技术栈。** 区别：@clidey/ux 是 npm 包（不可改源码），shadcn/ui 是 copy-paste 本地源码（完全可控）。

**替换评估：**

| 因素 | 保留 @clidey/ux | 替换为 shadcn/ui |
|------|:-:|:-:|
| 额外工时 | 0 | +4d |
| 组件可定制性 | 低（只能改 CSS 变量） | 高（可改组件结构和样式） |
| Sealos 风格深度适配 | 受限 | 完全自主 |
| 社区生态 | 小众 | 主流，文档丰富 |
| 后续维护 | 依赖 @clidey 发版 | 自主掌控 |
| 上游 WhoDB 兼容 | 完全兼容 | 分叉（import path 差异） |

由于底层都是 Radix + Tailwind，API 高度相似，替换主要是改 import path + 微调 variant 名称：

```tsx
// Before (@clidey/ux)
import { Button, Dialog, DialogContent, Input, Label, cn } from '@clidey/ux';

// After (shadcn/ui)
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';  // cn() 实现完全一致
```

**替换工时明细（如选择替换）：**

| 任务 | 预估 |
|------|------|
| shadcn/ui 初始化 + 安装 ~20 种组件 | 0.5d |
| 46 个文件批量替换 import path | 0.5d |
| Toast / ThemeProvider / ModeToggle 迁移 | 0.5d |
| 组件 API 差异修复（SearchSelect 等） | 1d |
| 样式微调（默认色彩/间距差异） | 1d |
| 回归测试 | 0.5d |
| **小计** | **4d** |

**建议：** 如果只做主题色彩适配，保留 @clidey/ux 够用。如果需要深度定制组件结构（如 Sealos Design System 有自己的 Button/Dialog 规范），替换 shadcn/ui 值得。替换可与 Phase 2 UI 裁剪并行。

#### 3.4.3 Backend 配置（环境变量）

```bash
# 禁用不需要的功能
WHODB_DISABLE_UPDATE_CHECK=true
WHODB_ENABLE_AWS_PROVIDER=false
WHODB_DISABLE_CREDENTIAL_FORM=true    # 隐藏原始登录表单
WHODB_DISABLE_MOCK_DATA_GENERATION=true

# 安全
WHODB_ALLOWED_ORIGINS=https://*.sealos.run
WHODB_LOG_LEVEL=warn
WHODB_MAX_PAGE_SIZE=5000

# 禁用 AI（不设置 key 即可）
# WHODB_OPENAI_API_KEY=       (不设置)
# WHODB_ANTHROPIC_API_KEY=    (不设置)
```

#### 3.4.4 Backend 代码改动

| 改动点 | 说明 |
|--------|------|
| 移除 PostHog 硬编码 key | `core/src/env/env.go` 中 `PosthogAPIKey` 置空或移除 |
| Plugin 注册裁剪 | `core/src/src.go`: 只注册 Postgres、MySQL、MongoDB、Redis、ClickHouse |
| CORS 配置 | `WHODB_ALLOWED_ORIGINS` 限制为 Sealos 域名 |

### 3.5 工时评估

#### Phase 1：集成层（可用）

| 任务 | 预估 | 说明 |
|------|------|------|
| Sealos SDK 集成 + postMessage handler | 0.5d | `createSealosApp()` + message listener + origin 验证 |
| dbType 映射 + 自动登录流程 | 0.5d | sessionStorage buffer → Login mutation → redirect |
| dbprovider 侧 Chat2DB 替换 | 0.5d | 2 个文件 handleManageData 重写 + 删除 chat2db 依赖 |
| 基础联调 | 0.5d | 端到端：dbprovider → Desktop → WhoDB → DB 连通 |
| **小计** | **2d** | |

#### Phase 2：UI 裁剪（精简）

| 任务 | 预估 | 说明 |
|------|------|------|
| 移除 AI Chat 页面 + 路由 | 0.5d | 删除 pages/chat/、components/ai.tsx、相关 store/graphql |
| 移除 AWS / Cloud Provider | 0.5d | 删除 components/aws/、settings 中的 AWS section、相关 store |
| 移除 Contact Us / Tour / Command Palette | 0.25d | 删除页面 + 路由 + 组件 |
| 移除 PostHog analytics | 0.25d | 前端删除 components/analytics/、后端置空 PostHog key |
| 移除 Mock Data / Version Check / Desktop 集成 | 0.25d | 环境变量禁用 + 前端 UI 入口移除 |
| Login 页面简化 | 0.5d | 重写为"等待连接"状态页，移除 profile 管理 / SSL / DB 选择器 |
| Sidebar 精简 | 0.5d | 移除多 profile 切换、update 通知、cloud filter |
| 裁剪后回归测试 | 0.5d | 确保 core features（table browse、SQL execute、graph）正常 |
| **小计** | **3.25d** | |

#### Phase 3：UI 适配（品牌 + 体验）

| 任务 | 预估 | 说明 |
|------|------|------|
| Sealos 主题适配 | 1d | CSS 变量调整、色彩替换、间距调整 |
| Branding 替换 | 0.25d | Logo、app name、favicon |
| 中文翻译 | 1d | WhoDB 已有 i18n 框架，需要为所有保留页面补充中文 YAML |
| 语言同步（Desktop SDK CHANGE_I18N） | 0.25d | 监听事件 → 切换 i18n |
| 响应式 / iframe 适配 | 0.5d | 确保在 Sealos Desktop iframe 中布局正确 |
| **小计** | **3d** | |

#### Phase 4：部署 + 验收

| 任务 | 预估 | 说明 |
|------|------|------|
| Dockerfile / K8s manifests | 0.5d | WhoDB 镜像构建 + Deployment + Service + Ingress |
| Sealos app 注册 | 0.25d | 注册为 system-whodb，配置 icon/名称 |
| 端到端验收测试 | 1d | 全流程：5 种数据库 × (browse + query + import/export + graph) |
| Bug 修复 buffer | 1d | 集成问题、样式微调 |
| **小计** | **2.75d** | |

#### 可选 Phase：UI 库替换（shadcn/ui）

> 仅在需要深度定制组件结构时执行，可与 Phase 2 并行。

| 任务 | 预估 | 说明 |
|------|------|------|
| shadcn/ui 初始化 + 安装组件 | 0.5d | `pnpx shadcn@latest init` + add ~20 种组件 |
| 批量替换 import path (46 文件) | 0.5d | `'@clidey/ux'` → `'@/components/ui/*'` |
| Toast / Theme / ModeToggle 迁移 | 0.5d | 两者都基于 sonner + next-themes，改 import 即可 |
| 组件 API 差异修复 | 1d | SearchSelect、SidebarProvider 等 |
| 样式微调 | 1d | 默认色彩/间距/圆角差异 |
| 回归测试 | 0.5d | |
| **小计** | **4d** | |

#### 总计

**路径 1：保留 @clidey/ux（主题色彩适配足够时）**

| Phase | 工时 | 说明 |
|-------|------|------|
| Phase 1: 集成层 | 2d | **最小可用版本**，能跑通全流程 |
| Phase 2: UI 裁剪 | 3.25d | 精简到 Sealos 所需功能集 |
| Phase 3: UI 适配 | 3d | 品牌、主题、中文、响应式 |
| Phase 4: 部署验收 | 2.75d | 上线就绪 |
| **总计** | **~11d (约 2.5 周)** | |

**路径 2：替换为 shadcn/ui（需要深度定制组件时）**

| Phase | 工时 | 说明 |
|-------|------|------|
| Phase 1: 集成层 | 2d | 最小可用版本 |
| Phase 2: UI 裁剪 + shadcn 替换 | 5d | 裁剪 (3.25d) 与 shadcn 替换 (4d) 并行，取较长路径 + 0.75d 合并调试 |
| Phase 3: UI 适配 | 3d | 品牌、主题、中文、响应式 |
| Phase 4: 部署验收 | 2.75d | 上线就绪 |
| **总计** | **~13d (约 3 周)** | |

> Phase 1 完成后即可内部 demo。Phase 2+3 可并行推进。Phase 4 依赖前三个 phase 完成。

---

## 4. 其他方案（对比参考）

### 4.1 方案 B — WhoDB 独立接入 K8s

> WhoDB 作为独立 Sealos 应用，通过 kubeconfig 自动发现并管理用户所有数据库

```
User → Sealos Desktop → 打开 WhoDB
    → sealosApp.getSession() → kubeconfig
    → K8s API: list Clusters (apps.kubeblocks.io/v1alpha1)
    → 展示数据库列表
    → 用户选择 → K8s API: read Secret ({dbName}-conn-credential)
    → Auto Login → WhoDB Backend → Database
```

**WhoDB 侧改动：**

**Backend (Go) — 重度改动：**

| 改动点 | 说明 |
|--------|------|
| 新增 K8s client | 引入 `k8s.io/client-go` 依赖，从 kubeconfig 初始化 K8s 客户端 |
| 新增 `DiscoverDatabases` query | 查询 `apps.kubeblocks.io/v1alpha1 Cluster` CRD，按 `clusterdefinition.kubeblocks.io/name` label 过滤 |
| 新增 `GetDatabaseCredentials` query | 读取 K8s Secret `{dbName}-conn-credential`，解析 host/port/username/password（不同 dbType 的 key 名不同） |
| 认证模型改造 | 新增 kubeconfig-based 认证路径：前端传 kubeconfig → 后端用它访问 K8s API |
| dbType 映射 | KubeBlocks label 值 → WhoDB DatabaseType enum |
| 数据库状态感知 | 读取 Cluster status.phase，只对 Running 实例启用连接 |

**K8s Secret 结构参考** (来自 dbprovider `src/utils/database.ts`)：

```
Secret name: {dbName}-conn-credential
Keys (base64 encoded):
  - postgresql: username, password, host, port
  - apecloud-mysql: username, password, host, port
  - mongodb: username, password, host, port
  - redis: username, password, host, port
  - clickhouse: username, password, host, port

Host 需要追加 .{namespace}.svc DNS 后缀
```

**Frontend (React) — 重度改动：**

| 改动点 | 说明 |
|--------|------|
| Sealos Desktop SDK 集成 | `createSealosApp()` + `sealosApp.getSession()` 获取 kubeconfig |
| 数据库发现页面 | 替代 Login 页面，展示 K8s 中所有数据库实例 + Running/Creating/Failed 状态 |
| 自动凭证获取 | 用户选择数据库 → 调用 `GetDatabaseCredentials` → 自动 Login |
| 事件监听 | 监听 `EVENT_NAME.CHANGE_I18N` 同步语言 |
| 非 Desktop 检测 | 非 Sealos 环境 redirect 到 Desktop 页面 |

**需要的 K8s RBAC：**

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
rules:
  - apiGroups: ["apps.kubeblocks.io"]
    resources: ["clusters"]
    verbs: ["list", "get"]
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get"]
    # resourceNames 限制为 *-conn-credential 模式
```

实际上 Sealos 的 kubeconfig 已经包含了用户在自己 namespace 内的权限，不需要额外 ServiceAccount。WhoDB 只需使用用户传来的 kubeconfig 即可。

**优势：**
- 用户体验最好：打开 WhoDB → 看到所有数据库 → 一键连接
- 完全独立于 dbprovider
- 可同时管理多个数据库，在 WhoDB 内切换
- dbprovider 零改动（甚至可以保留 Chat2DB 兼容）

**劣势：**
- 开发量大，预估 1-2 周
- WhoDB 与上游严重分叉（加入 K8s 依赖和 Sealos SDK 是 Sealos-specific 的）
- `sealos-desktop-sdk` 是 Sealos monorepo 的 workspace 依赖，构建流程需要适配
- 需要理解并实现 KubeBlocks CRD 的完整类型映射
- 后续上游 WhoDB 更新合并成本高

---

### 4.2 方案 C — WhoDB 前端嵌入 dbprovider

> 将 WhoDB 的 UI 能力集成到 dbprovider 内部，用户在 dbprovider 内直接操作数据库

**技术栈对比：**

| | dbprovider | WhoDB |
|--|-----------|-------|
| 框架 | Next.js 14 (SSR, pages router) | Vite SPA (CSR) |
| UI | Chakra UI 2.8 | @clidey/ux 0.39 + Tailwind 4 |
| 状态 | Zustand 4.4 | Redux Toolkit 2.9 + redux-persist |
| 数据 | React Query 4.35 | Apollo Client 3.13 |
| 路由 | Next.js pages router | React Router DOM 7 |
| CSS | Sass + Emotion (CSS-in-JS) | Tailwind + 全局 CSS |
| i18n | next-i18next | 自定义 YAML-based i18n |

**子方案评估：**

**C1: 直接导入 WhoDB React 组件**

不可行。原因：
- 两套路由系统冲突（Next.js pages router vs React Router）
- 两套全局状态冲突（Zustand vs Redux + redux-persist）
- 两套 GraphQL 客户端冲突（React Query vs Apollo Client）
- 全局 CSS 冲突（Chakra Emotion vs Tailwind utilities）
- Bundle 膨胀 2-3x（CodeMirror、ReactFlow、Dagre、@clidey/ux 等全部引入）
- 改造成本接近重写 WhoDB 前端

**C2: iframe 嵌入 WhoDB 页面**

可行，但本质等同于方案 A。仍需独立部署 WhoDB 服务，凭证通过 postMessage 传递。区别仅在于 UI 展示位置（dbprovider tab 内 vs 独立窗口）。

**C3: 只用 WhoDB 后端，在 dbprovider 中重写前端**

中等可行。在 dbprovider 中用 Chakra UI + React Query 重新实现 SQL editor、table browser、graph 等页面，请求打到 WhoDB Go 后端的 GraphQL API。

优势：
- UI 风格完全统一
- 权限天然继承 dbprovider 的 K8s 认证
- 无跨 app 跳转

劣势：
- 需要用 dbprovider 技术栈重写 WhoDB 全部前端页面
- 仍需部署 WhoDB Go 后端作为独立服务
- 无法享受 WhoDB 前端的后续更新
- 开发量预估 2-3 周

---

## 5. 综合对比

| 维度 | A: postMessage + UI 定制 | B: K8s 独立 | C1: 组件导入 | C2: iframe | C3: 重写前端 |
|------|:---:|:---:|:---:|:---:|:---:|
| **可行性** | 可行 | 可行 | 不可行 | 可行 | 可行 |
| **开发量** | ~2.5 周 (含 UI 定制) | 1-2 周 (不含 UI 定制) | — | 同方案 A | 2-3 周 |
| **上游兼容** | 中等（UI 层分叉，core 不变） | 差 | — | 好 | 差 |
| **用户体验** | 跳转独立 app，Sealos 风格 | 一站式 | — | dbprovider 内 tab | dbprovider 内原生 |
| **维护成本** | 中 | 高 | — | 低 | 高 |
| **dbprovider 改动** | 2 个文件 | 零 | — | 2 个文件 | 大量新页面 |
| **WhoDB 改动** | 中（集成层 + UI 裁剪） | 大（K8s + SDK + UI） | — | 小（集成层） | 零（只用后端） |
| **安全性** | 好 (内存传递) | 好 (kubeconfig) | — | 好 (内存传递) | 好 (服务端直连) |

---

## 6. 建议

### 推荐：方案 A（postMessage + UI 重度定制）

分 4 个 phase 推进，总计约 2.5 周：

| Phase | 工时 | 产出 |
|-------|------|------|
| 1. 集成层 | 2d | 最小可用版本，端到端跑通 |
| 2. UI 裁剪 | 3.25d | 移除 AI/AWS/Tour 等不需要的功能 |
| 3. UI 适配 | 3d | Sealos 主题、中文翻译、品牌 |
| 4. 部署验收 | 2.75d | K8s 部署 + 5 种数据库全流程验收 |

Phase 1 完成即可内部 demo。Phase 2+3 可并行。

### 中期可选：+方案 B 渐进融合

在方案 A 上线后，逐步给 WhoDB 添加 K8s 数据库发现能力：
1. 先上线方案 A，立即替换 Chat2DB
2. 后续添加 `/discover` 页面，支持 K8s Cluster CRD 查询
3. 两种入口共存：dbprovider 跳转 + WhoDB 自主发现

### 不推荐：方案 C

技术栈冲突太大（Next.js vs Vite、Chakra vs Tailwind、Zustand vs Redux）。直接导入组件不可行，重写前端成本等于新建项目。

---

## 6. 数据流图

详细的 Mermaid 数据流图见 [sealos-integration-dataflow.md](./sealos-integration-dataflow.md)，包含：

1. **架构对比** — Chat2DB vs WhoDB 安全性和架构差异
2. **凭证传递时序** — postMessage 完整流程
3. **认证中间件** — WhoDB AuthMiddleware 请求解析路径
4. **查询执行时序** — 前端 → GraphQL → Plugin → 连接缓存 → DB
5. **连接缓存生命周期** — 状态机：创建 → 活跃 → 空闲 → 过期
6. **K8s 部署拓扑** — namespace 内 Pod 网络关系
7. **类型映射** — KubeBlocks dbType → WhoDB DatabaseType
8. **端到端路径** — 用户点击到看到结果的 17 步完整链路

---

## 附录

### A. WhoDB 关键文件参考

| 用途 | 路径 |
|------|------|
| Plugin 接口 | `core/src/engine/plugin.go` |
| Plugin 注册 | `core/src/src.go` |
| GraphQL Schema | `core/graph/schema.graphqls` |
| 认证中间件 | `core/src/auth/auth.go` |
| 连接池 | `core/src/plugins/connection_pool.go` |
| 连接缓存 | `core/src/plugins/connection_cache.go` |
| 前端登录页 | `frontend/src/pages/auth/login.tsx` |
| 前端状态 | `frontend/src/store/auth.ts` |
| GraphQL 客户端 | `frontend/src/config/graphql-client.ts` |
| 路由配置 | `frontend/src/config/routes.tsx` |

### B. dbprovider 关键文件参考

| 用途 | 路径 |
|------|------|
| Chat2DB 集成 (列表页) | `src/pages/dbs/components/dbList.tsx` |
| Chat2DB 集成 (详情页) | `src/pages/db/detail/components/Header.tsx` |
| Chat2DB 常量 | `src/constants/chat2db.ts` |
| Chat2DB datasource 同步 | `src/services/chat2db/datasource.ts` |
| Chat2DB 用户/登录 | `src/services/chat2db/user.ts` |
| K8s Secret 获取 | `src/pages/api/getSecretByName.ts` |
| K8s 客户端初始化 | `src/services/backend/kubernetes.ts` |
| Sealos 认证 | `src/services/backend/auth.ts` |
| Desktop SDK 集成 | `src/pages/_app.tsx` |
| 数据库类型映射 | `src/utils/database.ts` |

### C. WhoDB 环境变量（集成相关）

| 变量 | 默认值 | 用途 |
|------|--------|------|
| `PORT` | `8080` | 服务端口 |
| `WHODB_DISABLE_CREDENTIAL_FORM` | `false` | 隐藏登录表单（嵌入模式） |
| `WHODB_TOKENS` | — | 静态 API token（API Gateway 模式） |
| `WHODB_POSTGRES` | — | 预配置 Postgres profile (JSON) |
| `WHODB_MYSQL` | — | 预配置 MySQL profile (JSON) |
| `WHODB_LOG_LEVEL` | `info` | 日志级别 |
| `WHODB_MAX_PAGE_SIZE` | `10000` | 单次查询行数上限 |

# WhoDB x Sealos 集成 — 数据流设计

> **Date:** 2026-03-23
> **Context:** 用定制 WhoDB 替代 DB Manager / Chat2DB 作为 dbprovider 的数据库客户端

---

## 1. 架构对比 — Chat2DB vs WhoDB

```mermaid
graph TB
    subgraph current["Current: Chat2DB"]
        direction TB
        U1[User] -->|Click Manage Data| DP1[dbprovider]
        DP1 -->|getSecretByName| K1[K8s Secret]
        K1 -->|credentials| DP1
        DP1 -->|generateLoginUrl<br/>AES encrypt + URL params| URL1[Chat2DB URL<br/>credentials in query string]
        DP1 -->|openDesktopApp<br/>appKey: system-chat2db| DSK1[Sealos Desktop]
        DSK1 -->|open iframe with URL| C2[Chat2DB Frontend]
        C2 -->|syncDatasource API| C2B[Chat2DB Backend]
        C2B -->|JDBC| DB1[(Database)]

        style URL1 fill:#ff6b6b,stroke:#c92a2a,color:#fff
    end

    subgraph proposed["Proposed: WhoDB"]
        direction TB
        U2[User] -->|Click Manage Data| DP2[dbprovider]
        DP2 -->|getSecretByName| K2[K8s Secret]
        K2 -->|credentials| DP2
        DP2 -->|openDesktopApp<br/>appKey: system-whodb<br/>messageData: credentials| DSK2[Sealos Desktop]
        DSK2 -->|postMessage<br/>credentials in memory only| WF[WhoDB Frontend]
        WF -->|Login mutation<br/>GraphQL| WB[WhoDB Backend]
        WB -->|GORM / native driver| DB2[(Database)]

        style WF fill:#51cf66,stroke:#2b8a3e,color:#fff
        style WB fill:#51cf66,stroke:#2b8a3e,color:#fff
    end
```

**关键差异:**
- Chat2DB: credentials 通过 URL query params + AES 加密（暴露在浏览器历史、Referer header、server logs）
- WhoDB: credentials 通过 `postMessage` 内存传递，never touches URL or logs
- Chat2DB: 需要额外的 datasource sync API 和独立后端
- WhoDB: 单容器（Go backend + static frontend），GraphQL 直连数据库

---

## 2. 凭证传递 — postMessage 完整时序

```mermaid
sequenceDiagram
    participant User
    participant dbprovider as dbprovider<br/>(Next.js)
    participant K8sAPI as Kubernetes API
    participant Desktop as Sealos Desktop
    participant WhoDB_FE as WhoDB Frontend<br/>(React + Apollo)
    participant WhoDB_BE as WhoDB Backend<br/>(Go + GraphQL)
    participant DB as Target Database

    User->>dbprovider: Click "Manage Data"

    rect rgb(240, 240, 255)
        Note over dbprovider,K8sAPI: Step 1 — 从 K8s 获取凭证
        dbprovider->>K8sAPI: GET /api/getSecretByName
        K8sAPI-->>dbprovider: {host, port, username, password}
    end

    rect rgb(240, 255, 240)
        Note over dbprovider,Desktop: Step 2 — 通过 Desktop SDK 发送
        dbprovider->>Desktop: sealosApp.runEvents('openDesktopApp', {<br/>  appKey: 'system-whodb',<br/>  messageData: {<br/>    type: 'InternalAppCall',<br/>    action: 'connectDatabase',<br/>    data: {dbType, connection, theme, lang}<br/>  }<br/>})
    end

    rect rgb(255, 240, 240)
        Note over Desktop,WhoDB_FE: Step 3 — postMessage 中继
        Desktop->>WhoDB_FE: window.postMessage(messageData)
        Note right of WhoDB_FE: addEventListener('message')<br/>validate origin whitelist
    end

    rect rgb(255, 255, 230)
        Note over WhoDB_FE,WhoDB_BE: Step 4 — GraphQL 自动登录
        WhoDB_FE->>WhoDB_FE: Type mapping:<br/>postgresql → Postgres<br/>apecloud-mysql → MySQL<br/>mongodb → MongoDB<br/>redis → Redis
        WhoDB_FE->>WhoDB_BE: mutation Login(credentials: {<br/>  Type: "Postgres",<br/>  Hostname: "xxx.svc.cluster.local",<br/>  Username: "root",<br/>  Password: "***",<br/>  Database: "postgres",<br/>  Advanced: [{Key:"Port", Value:"5432"}]<br/>})
    end

    rect rgb(240, 245, 255)
        Note over WhoDB_BE,DB: Step 5 — 连接验证
        WhoDB_BE->>DB: plugin.IsAvailable() — connection test
        DB-->>WhoDB_BE: OK
        WhoDB_BE-->>WhoDB_FE: {Status: true}<br/>Set-Cookie: Token=base64(credentials)
    end

    WhoDB_FE->>WhoDB_FE: Store profile in Redux<br/>Navigate to workspace
    WhoDB_FE-->>User: Database workspace ready
```

---

## 3. 认证中间件 — 每次请求的凭证解析

WhoDB 的 `AuthMiddleware` 在每个 GraphQL 请求中解析凭证并注入 context。

```mermaid
flowchart TD
    REQ["HTTP POST /api"] --> PUBLIC{Allowed operation?<br/>Login / GetProfiles /<br/>SettingsConfig / Version}
    PUBLIC -->|Yes| PASS["Pass through<br/>no credentials needed"]
    PUBLIC -->|No| HEADER{"Authorization<br/>header present?"}

    HEADER -->|"Bearer xxx"| TOKEN_H["Extract token from header"]
    HEADER -->|No| COOKIE{"Token cookie?"}
    COOKIE -->|Yes| TOKEN_C["Extract token from cookie"]
    COOKIE -->|No| REJECT["401 Unauthorized"]

    TOKEN_H --> DECODE["base64 decode → JSON"]
    TOKEN_C --> DECODE

    DECODE --> UNMARSHAL["Unmarshal → engine.Credentials<br/>{Type, Hostname, Username,<br/>Password, Database, Advanced}"]

    UNMARSHAL --> ID_CHECK{"Has Id but<br/>no Type/Hostname?"}

    ID_CHECK -->|"ID-only request"| PROFILE{"Match env profile?"}
    ID_CHECK -->|"Full credentials"| GATEWAY{"API Gateway<br/>enabled?"}

    PROFILE -->|Yes| USE_PROFILE["Resolve from WHODB_POSTGRES=..."]
    PROFILE -->|No| KEYRING{"Match OS keyring?"}
    KEYRING -->|Yes| USE_KEYRING["Resolve from keyring"]
    KEYRING -->|No| REJECT

    GATEWAY -->|Yes| TOKEN_VALID{"AccessToken in<br/>WHODB_TOKENS list?"}
    GATEWAY -->|No| INJECT
    TOKEN_VALID -->|Yes| INJECT
    TOKEN_VALID -->|No| REJECT

    USE_PROFILE --> INJECT["ctx = context.WithValue(<br/>  ctx, Credentials, creds)"]
    USE_KEYRING --> INJECT
    INJECT --> RESOLVER["GraphQL resolver executes<br/>auth.GetCredentials(ctx)"]

    style REJECT fill:#ff6b6b,stroke:#c92a2a,color:#fff
    style INJECT fill:#51cf66,stroke:#2b8a3e,color:#fff
    style PASS fill:#74c0fc,stroke:#1971c2,color:#fff
```

---

## 4. 查询执行 — Frontend → GraphQL → Plugin → Database

```mermaid
sequenceDiagram
    participant FE as WhoDB Frontend
    participant Apollo as Apollo Client
    participant Auth as AuthMiddleware
    participant Resolver as GraphQL Resolver
    participant Engine as Engine.Choose()
    participant Plugin as Database Plugin
    participant Pool as WithConnection<T>
    participant Cache as Connection Cache<br/>(SHA256 → *gorm.DB)
    participant DB as Target Database

    FE->>Apollo: query RawExecute("SELECT * FROM users")
    Apollo->>Auth: POST /api<br/>Cookie: Token=base64(credentials)
    Auth->>Auth: Decode → Credentials
    Auth->>Resolver: ctx with Credentials

    Resolver->>Resolver: auth.GetCredentials(ctx)
    Resolver->>Engine: engine.Choose("Postgres")
    Engine-->>Resolver: PostgresPlugin

    Resolver->>Plugin: RawExecute(config, query)
    Plugin->>Pool: WithConnection(config, p.DB, op)

    Pool->>Cache: getOrCreateConnection(config)

    alt Cache HIT — SHA256 match + not expired
        Cache-->>Pool: reuse cached *gorm.DB
    else Cache MISS
        Pool->>Plugin: p.DB(config) — create new
        Plugin->>DB: gorm.Open(postgres.Open(dsn))
        DB-->>Plugin: *gorm.DB
        Plugin->>Pool: ConfigureConnectionPool<br/>(maxOpen:10, idle:5, lifetime:30m)
        Pool->>Cache: store(key, conn, TTL=5min)
    end

    Pool->>DB: db.Raw("SELECT * FROM users")
    DB-->>Pool: sql.Rows
    Pool-->>Plugin: RowsResult{Columns, Rows, TotalCount}
    Plugin-->>Resolver: RowsResult
    Resolver-->>Auth: GraphQL JSON response
    Auth-->>Apollo: HTTP 200
    Apollo-->>FE: Render data table
```

---

## 5. 连接缓存生命周期

```mermaid
stateDiagram-v2
    [*] --> Idle: WhoDB starts<br/>no connections

    Idle --> Creating: First query for this DB

    Creating --> Cached: gorm.Open() succeeds<br/>SHA256(credentials) = cache key

    state Cached {
        [*] --> Active
        Active --> Active: Query executed<br/>lastUsed = now()
        Active --> Waiting: No queries for a while
        Waiting --> Active: New query arrives<br/>SQL ping validates
        Waiting --> Stale: TTL > 5 minutes
    }

    Cached --> Evicted: Cache full > 50 entries<br/>LRU eviction
    Stale --> Closed: Cleanup goroutine<br/>runs every 1 minute
    Evicted --> Closed: sqlDB.Close()
    Closed --> Idle: Slot freed

    note right of Cached
        GORM connection pool per entry:
        MaxOpenConns = 10
        MaxIdleConns = 5
        ConnMaxLifetime = 30min
        ConnMaxIdleTime = 5min
    end note
```

---

## 6. Kubernetes 部署拓扑

```mermaid
graph TB
    subgraph browser["Browser (Sealos Desktop)"]
        DESKTOP["Desktop Shell"]
        DP_IF["dbprovider iframe"]
        WH_IF["WhoDB iframe"]

        DP_IF -.->|"postMessage<br/>(via Desktop relay)"| WH_IF
    end

    subgraph k8s["Kubernetes Namespace: ns-user-xxx"]

        subgraph dp["Pod: dbprovider"]
            DP_APP["Next.js :3000"]
        end

        subgraph whodb["Pod: whodb"]
            WH_BE["Go Backend :8080<br/>(GraphQL + static files)"]
        end

        subgraph dbs["KubeBlocks Managed Databases"]
            PG["PostgreSQL<br/>:5432"]
            MY["MySQL<br/>:3306"]
            MG["MongoDB<br/>:27017"]
            RD["Redis<br/>:6379"]
        end

        SEC[("K8s Secrets<br/>(DB credentials)")]
    end

    DP_IF -->|HTTP| DP_APP
    WH_IF -->|"HTTP /api (GraphQL)"| WH_BE

    DP_APP -->|K8s API| SEC

    WH_BE -->|"TCP (GORM)"| PG
    WH_BE -->|"TCP (GORM)"| MY
    WH_BE -->|"TCP (native)"| MG
    WH_BE -->|"TCP (native)"| RD

    style WH_BE fill:#51cf66,stroke:#2b8a3e,color:#fff
    style SEC fill:#ffd43b,stroke:#e67700,color:#000
```

**要点:**
- WhoDB 单容器部署，Go 后端既处理 GraphQL API 也 serve 静态前端
- 凭证不经过 WhoDB 磁盘，只在内存中（auth context + connection cache）
- 每个用户 namespace 一个 WhoDB 实例，天然隔离

---

## 7. 类型映射 — dbprovider → WhoDB

```mermaid
flowchart LR
    subgraph src["dbprovider (KubeBlocks types)"]
        A1["postgresql"]
        A2["apecloud-mysql"]
        A3["mongodb"]
        A4["redis"]
        A5["clickhouse"]
        A6["kafka"]
        A7["milvus"]
        A8["weaviate"]
    end

    subgraph map["Mapping Layer<br/>(postMessage handler)"]
        M["typeMap"]
    end

    subgraph dst["WhoDB DatabaseType"]
        B1["Postgres"]
        B2["MySQL"]
        B3["MongoDB"]
        B4["Redis"]
        B5["ClickHouse"]
        BX["Not Supported"]
    end

    A1 --> M --> B1
    A2 --> M --> B2
    A3 --> M --> B3
    A4 --> M --> B4
    A5 --> M --> B5
    A6 --> M --> BX
    A7 --> M --> BX
    A8 --> M --> BX

    style B1 fill:#51cf66,stroke:#2b8a3e,color:#fff
    style B2 fill:#51cf66,stroke:#2b8a3e,color:#fff
    style B3 fill:#51cf66,stroke:#2b8a3e,color:#fff
    style B4 fill:#51cf66,stroke:#2b8a3e,color:#fff
    style B5 fill:#51cf66,stroke:#2b8a3e,color:#fff
    style BX fill:#ff6b6b,stroke:#c92a2a,color:#fff
```

**凭证字段转换:**

```mermaid
flowchart LR
    subgraph input["dbprovider K8s Secret"]
        I1["host: my-pg.ns-xxx.svc"]
        I2["port: 5432"]
        I3["username: root"]
        I4["password: ****"]
    end

    subgraph output["WhoDB LoginCredentials"]
        O1["Type: 'Postgres'"]
        O2["Hostname: 'my-pg.ns-xxx.svc'"]
        O3["Username: 'root'"]
        O4["Password: '****'"]
        O5["Database: 'postgres'"]
        O6["Advanced: [{Key:'Port', Value:'5432'}]"]
    end

    input --> output
```

---

## 8. 端到端完整路径

从用户点击按钮到执行 SQL 查询的完整数据流。

```mermaid
flowchart TB
    START(("User"))

    START -->|1| CLICK["Click 'Manage Data'<br/>on running DB instance"]
    CLICK -->|2| FETCH["dbprovider: GET /api/getSecretByName<br/>→ K8s API → Secret"]
    FETCH -->|3| BUILD["Build messageData:<br/>{type, action, data:{dbType, connection, theme, lang}}"]
    BUILD -->|4| SEND["sealosApp.runEvents('openDesktopApp',<br/>{appKey:'system-whodb', messageData})"]
    SEND -->|"5 — postMessage relay"| RECV["WhoDB: addEventListener('message')<br/>validate origin whitelist"]
    RECV -->|6| STORE["sessionStorage.setItem(<br/>'pendingConnection', JSON)"]
    STORE -->|7| MAP["Map types:<br/>postgresql→Postgres, apecloud-mysql→MySQL"]
    MAP -->|8| LOGIN["Auto-trigger: mutation Login({<br/>Type, Hostname, Username,<br/>Password, Database, Advanced})"]
    LOGIN -->|9| AUTH["AuthMiddleware: pass through<br/>(Login is in allowed list)"]
    AUTH -->|10| RESOLVE["Login resolver:<br/>engine.Choose(dbType)<br/>→ plugin.IsAvailable(credentials)"]
    RESOLVE -->|11| CONNECT["Plugin: gorm.Open(dsn)<br/>+ ConfigureConnectionPool"]
    CONNECT -->|12| TEST["Connection test:<br/>SELECT 1 / Ping"]
    TEST -->|"13 — success"| COOKIE["Response: {Status:true}<br/>Set-Cookie: Token=base64(creds)"]
    COOKIE -->|14| NAV["Frontend: dispatch login()<br/>navigate to workspace"]
    NAV -->|15| QUERY["User writes SQL or<br/>browses tables"]
    QUERY -->|16| EXEC["GraphQL with cookie →<br/>AuthMiddleware → Plugin →<br/>WithConnection → DB"]
    EXEC -->|17| RESULT(("Results rendered<br/>in WhoDB UI"))

    style START fill:#228be6,stroke:#1864ab,color:#fff
    style RESULT fill:#51cf66,stroke:#2b8a3e,color:#fff
    style SEND fill:#ffd43b,stroke:#e67700,color:#000
    style RECV fill:#ffd43b,stroke:#e67700,color:#000
    style LOGIN fill:#be4bdb,stroke:#862e9c,color:#fff
    style COOKIE fill:#be4bdb,stroke:#862e9c,color:#fff
```

---

## Diagram Index

| # | Diagram | 说明 |
|---|---------|------|
| 1 | Architecture Comparison | Chat2DB (URL+AES) vs WhoDB (postMessage) 安全性和架构差异 |
| 2 | Credential Delivery Sequence | postMessage 凭证传递完整时序，含 origin 验证 |
| 3 | Auth Middleware Flowchart | 每次 HTTP 请求的认证解析路径（cookie/header/profile/keyring）|
| 4 | Query Execution Sequence | 前端输入 → GraphQL → Plugin → 连接缓存 → DB 的完整数据通路 |
| 5 | Connection Cache Lifecycle | 连接缓存状态机：创建 → 活跃 → 空闲 → 过期/驱逐 → 关闭 |
| 6 | K8s Deployment Topology | WhoDB、dbprovider、DB pods 在 Sealos namespace 中的网络拓扑 |
| 7 | Type Mapping | KubeBlocks dbType → WhoDB DatabaseType 映射 + 凭证字段转换 |
| 8 | End-to-End Path | 用户从点击按钮到看到查询结果的 17 步完整路径 |

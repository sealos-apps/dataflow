# Database Expansion Plan

WhoDB 当前支持的数据库：PostgreSQL、MySQL、SQLite、MongoDB、Redis、ClickHouse、Elasticsearch。

本文档分析尚未支持的数据库/中间件的重要性与优先级，为后续扩展提供参考。

## 候选数据库总览

| 名称 | 类型 | 重要程度 | 建议优先级 |
|------|------|---------|-----------|
| Kafka | 消息流平台 | 高 | P1 |
| Milvus | 向量数据库 | 高 | P1 |
| Qdrant | 向量数据库 | 中 | P2 |
| Weaviate | 向量数据库 | 中 | P2 |
| NebulaGraph | 图数据库 | 中 | P2 |
| Pulsar | 消息流平台 | 低 | P3 |

## 详细分析

### Kafka（P1 — 高优先级）

- **类型**：分布式事件流平台
- **市场地位**：消息流领域事实标准，几乎所有中大型系统都在用
- **适配难点**：Kafka 不是传统数据库，其数据模型（Topic → Partition → Offset）与 WhoDB 现有的表/行/列 CRUD 模式差异大，需要设计新的浏览模型（Topic 列表、消息浏览、Consumer Group 状态、Partition 分布等）
- **价值**：覆盖面极广，对 Sealos 平台用户吸引力大

### Milvus（P1 — 高优先级）

- **类型**：向量数据库
- **市场地位**：国内最流行的向量数据库，在 AI/RAG/语义搜索场景中广泛使用，GitHub 30k+ stars
- **适配难点**：数据模型相对简单（Collection → Vector + Metadata），可复用现有表格浏览模式，适配成本中等
- **价值**：AI 基础设施场景刚需，与 Sealos 面向的云原生/AI 用户群高度匹配

### Qdrant（P2 — 中优先级）

- **类型**：向量数据库
- **市场地位**：海外较流行，Rust 编写，性能口碑好，GitHub 22k+ stars
- **适配难点**：REST/gRPC API，数据模型与 Milvus 类似（Collection → Point = Vector + Payload）
- **价值**：与 Milvus 同类，按用户反馈决定是否支持。如果已支持 Milvus，适配成本会降低

### Weaviate（P2 — 中优先级）

- **类型**：向量数据库
- **市场地位**：海外较流行，内置向量化模块，GitHub 12k+ stars
- **适配难点**：GraphQL 原生 API，数据模型为 Class → Object（含 Vector），与 WhoDB 自身使用 GraphQL 有一定亲和性
- **价值**：与 Qdrant/Milvus 同类，优先级取决于用户群分布

### NebulaGraph（P2 — 中优先级）

- **类型**：图数据库
- **市场地位**：国内较流行的分布式图数据库，适用于知识图谱、社交网络、风控等场景
- **适配难点**：图数据模型（Vertex/Edge/Space）与表格模式差异大，需要设计图可视化浏览方式
- **价值**：市场规模有限，但在特定领域（金融风控、知识图谱）有刚需用户

### Pulsar（P3 — 低优先级）

- **类型**：分布式消息流平台
- **市场地位**：Apache 顶级项目，功能上对标 Kafka，但市场份额远小于 Kafka
- **适配难点**：与 Kafka 类似，需要设计消息浏览模型
- **价值**：除非有明确用户需求，否则优先支持 Kafka 即可覆盖该品类

## 建议路线

1. **第一批（P1）**：Milvus、Kafka
   - Milvus 适配成本较低且 AI 场景需求明确，建议先做
   - Kafka 适配成本高但覆盖面广，可与 Milvus 并行或紧随其后
2. **第二批（P2）**：根据用户反馈从 Qdrant / Weaviate / NebulaGraph 中选择
   - 如果用户群偏海外：优先 Qdrant
   - 如果用户群偏国内：优先 NebulaGraph
3. **第三批（P3）**：Pulsar，需求驱动

## 适配架构考虑

WhoDB 采用插件架构，每种数据库实现 `PluginFunctions` 接口。新增数据库需要：

1. 在 `core/src/plugins/` 下新建插件目录
2. 实现 `PluginFunctions` 接口
3. 在 `core/src/src.go` 中注册插件
4. 更新 GraphQL schema（如需新的查询类型）

对于 Kafka/Pulsar 等消息流平台，现有 CRUD 接口可能不够用，需要扩展 GraphQL schema 以支持 Topic 浏览、消息消费等操作。

对于向量数据库（Milvus/Qdrant/Weaviate），现有表格浏览模式基本可复用，但需要增加向量搜索相关的查询接口。

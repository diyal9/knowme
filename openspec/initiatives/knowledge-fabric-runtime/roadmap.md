# Initiative · KnowMe 运行时知识织网（Knowledge Fabric Runtime）

> 状态：规划中（North Star）· 负责人：制作人 · 最后更新：2026-08-08
>
> 本文是**跨多个 OpenSpec change 的北极星路线图**，不是单个 change。每个阶段成熟后用
> `/opsx:propose <change-name>` 拆成独立 change 落地，落地后回填「关联 change」列。
>
> **适用范围**：KnowMe **产品运行时**知识库（数据在 `%APPDATA%\KnowMe\knowledge-os\`），
> **不是** `brain/` 开发用 llmwiki。二者严格分离。

---

## 1. 愿景（一句话）

把**根 llmwiki 升级为「知识织网中枢（Knowledge Fabric）」**——它同时是语义层、结构层、索引层；
所有外挂知识库通过它被关联、织网；检索时**根优先命中 → 按根维护情况路由 → 再选择性去外挂库召回**，
底层用 [`qmd`](https://github.com/tobi/qmd) 提供本地混合检索（BM25 + 向量 + 重排）与 tools。

架构范式：从「平级多库联邦」升级为 **Hub-and-Spoke（中枢-辐条）**。

---

## 1.5 命名与术语（对外单一事实源 · 2026-08-09）

> KnowMe 对外把这套能力称为「知识网」。**「知识网」是顶层聚合 / 菜单 / 整体**（根 + 专业库织成的结构化知识图谱）；**个体单元仍叫「知识库 / llmwiki」，不改**。

| 术语 | 含义 | 是否改名 |
|---|---|---|
| **知识网 (Knowledge Web)** | 左侧菜单入口 / 顶层概念 / 整体 = 根 + 若干专业库织网形成的结构化知识图谱。Slogan：**"KnowMe 懂你的知识网"** | ✅ 原「知识库」菜单/顶层定位语改为此 |
| **根知识库 / 根 llmwiki** | 默认个体单元（= 根 Fabric 本身），可写、可织网 | ❌ 保留"库" |
| **专业知识库 / 专业 llmwiki** | 外挂个体单元 | ❌ 保留"库" |
| **飞书知识库** 等第三方专有名词 | 外部产品名（Feishu Wiki 等） | ❌ 原样保留，禁止改动 |
| 代码 / 模块 / 目录 / IPC | `fabric-*`、`knowledge-*`、`knowledge-os`、channel 名 | ❌ 不改 |
| 英文 | 对外 Knowledge Web；内部技术 Fabric | — |

**改名边界**：仅改**顶层**（左侧菜单标签、知识中心整体定位语）为「知识网」；**不改**个体库用词、AI 提示词中泛指/个体的"知识库"、专有名词与代码标识。落地见工作台顶栏「知识网」文案（原 change `rename-knowledge-menu-to-web` 已从 archive 删除）。

---

## 2. 定位与心智模型

```
                        ┌─────────────────────────────────────────────┐
                        │        根 llmwiki = Knowledge Fabric          │
                        │  (%APPDATA%\KnowMe\knowledge-os\fabric\)       │
                        │  L1 语义层  概念/实体节点 + embedding + 主题本体  │
                        │  L2 结构层  关系图边(含指向外挂库的锚点边)=织网    │
                        │  L3 索引层  qmd 统一索引(根全文 + 外挂库锚点/摘要) │
                        └───────┬───────────────┬───────────────┬───────┘
                     织网/路由   │               │               │
              ┌──────────────────┘      ┌────────┘        ┌──────┘
              ▼                          ▼                 ▼
     外挂库①(本地目录/Obsidian)   外挂库②(专业库)     外挂库③(服务端 remote-rag)
       qmd collection A            qmd collection B      远程 RAG 端点
```

- **默认个人库 = 根 Fabric 本身**（开箱即得的"第二大脑"，天然可写、可织网）。
- 根不必拷贝全部内容，维护的是外挂库的 **anchor（锚点）+ 摘要 + 关系边 + 路由元数据**。
- 检索用一次廉价的**根检索**决定"要不要 / 去哪些外挂库"做昂贵扇出，避免无脑查所有库。

---

## 3. 关键设计决策（讨论已达成，待实现时确认）

| 维度 | 结论 / 倾向 | 备注 |
|---|---|---|
| 分层 scope | client / server / shared | 落在 KB Registry |
| 分级 authority | 1(草稿)~5(团队权威事实) | 驱动检索加权 + 冲突裁决 |
| 检索层级 retrievalTier | 数字越小越先命中/权重越高 | 驱动分层扇出与短路 |
| 单库检索引擎 | 采用 **qmd**（本地混合检索），词面 `knowledge-rank` 作 fallback | 见 §6 |
| 融合 | RRF + authority 加权 | 二级：库内 qmd RRF + 跨库加权 RRF |
| 冲突裁决链 | pin/override → authority → scope 上下文 → recency | 冲突回流治理，不静默丢弃 |
| Memory 升库 | 规则筛选 → LLM 归纳 → **人工审核** → 写根 | 复用 knowledge-steward |
| 单一事实源(SSOT) | ingest 前跨库去重：已有更高权威版本则改为"更新提案/引用" | 防多库重复 |

### 待决策点（已定 MVP 默认值 · 2026-08-08）

1. **锚点粒度** → MVP **文件级**；章节/chunk 级列为后续。
2. **根是否存外挂内容摘要+embedding** → **存**（让"根优先短路"成立）。
3. **短路激进程度** → 保守：根/锚点摘要先答，涉及高 authority 或用户展开时再回外挂库取全文。
4. **qmd 索引边界** → 若采用 qmd：根 collection（路由）+ 每个本地外挂库 collection（召回）都建。
5. **qmd 接入形态** → 先 **CLI/子进程或 MCP spike**；若原生模块在 Windows/Electron 打包本轮不可行，**不得阻塞交付**，退化为本地混合检索 fallback（复用 `knowledge-rank` + 可选 `semantic-index`/`buildEmbedFn` 重排），qmd 作为文档化后续 + feature flag。
6. **本地模型策略** → **无模型纯词面/BM25 兜底必须始终可用**；embedding/qmd 重排为可选增强。
7. **冲突默认策略** → **authority 优先，recency 兜底**；个人库草稿(authority 1)默认不参与检索，除非显式包含。
8. **SSOT 强度** → MVP **允许重复但标记冲突**（非阻断）；ingest 去重给"更新提案"。

---

## 4. 数据模型（草案）

新增 `knowledge-os/fabric/`：

```jsonc
// fabric/graph.json —— 语义层 + 结构层
{
  "nodes": [
    { "id": "c:auth-flow", "kind": "concept", "title": "认证流程",
      "summary": "...", "embedding": "vec_ref", "tags": ["security"],
      "authority": 3, "path": "wiki/auth-flow.md" },
    { "id": "a:kbB/jwt", "kind": "anchor", "kbId": "kb_security_pro",
      "extRef": "docs/jwt.md", "title": "JWT 实现", "summary": "...",
      "embedding": "vec_ref", "lastSynced": "2026-08-08T...", "stale": false }
  ],
  "edges": [
    { "from": "c:auth-flow", "to": "a:kbB/jwt", "type": "refines", "weight": 0.8 },
    { "from": "a:kbB/jwt", "to": "a:kbC/sso", "type": "contradicts" }
  ]
}
```

```jsonc
// fabric/routing.json —— 路由元数据（检索决策依据）
{
  "topics": {
    "security.auth": {
      "owners": ["kb_security_pro"],
      "coverageInRoot": 0.4,
      "delegateTo": ["kb_security_pro", "kb_server"],
      "authorityRank": ["kb_server", "kb_security_pro", "kb_personal"]
    }
  },
  "kbs": { "kb_security_pro": { "lastWoven": "...", "staleAnchors": 3, "health": 0.92 } }
}
```

边类型：`refines / coversTopic / alias / relatesTo / contradicts / ownedBy`。

KB Registry 描述符（扩展现有 `knowledge-provider.normalizeProvider`）：

```jsonc
{
  "id": "kb_personal", "displayName": "我的第二大脑",
  "kind": "qmd-local",              // qmd-local | remote-rag | local(legacy)
  "scope": "client",               // client | server | shared
  "authority": 2,                  // 1~5
  "retrievalTier": 1,
  "governance": "llm-wiki",
  "writable": true, "promotable": true,
  "collectionId": "root",          // qmd collection 映射
  "spaceSourceId": "src_xxx", "subDir": ""
}
```

---

## 5. 检索流程（根优先 → 路由 → 选择性召回）

```
查询 q
 ├─ ① 根检索(快)：qmd query 根 collection → 命中 {概念节点, 锚点节点} topK
 ├─ ② 路由：读 routing.json + 沿 graph 边扩散 → 候选库集 + 是否扇出
 │      · 根覆盖高 & 锚点新鲜 → 短路(用根/锚点摘要)
 │      · 主题 delegateTo 权威库 → 强制召回
 │      · 锚点 stale → 触发重织 + 召回
 │      · 命中弱/无覆盖 → 按 tier 广扇出
 ├─ ③ 选择性召回：qmd-local 库→qmd query;remote-rag 库→queryProvider
 ├─ ④ 融合：跨库 RRF + authority 加权
 └─ ⑤ 仲裁 + provenance：沿 contradicts 边裁决;结果挂来源可追溯回 fabric
```

---

## 6. qmd 落点

- **映射**：根 = qmd collection `root`；每个本地外挂库 = 一个 qmd collection；remote-rag 不进 qmd。
- **命令分级**：路由用 `qmd query`（hybrid+rerank）；大库快过滤 `qmd search`（BM25）；语义扩散 `qmd vsearch`。
- **Agent tools**（升级 `agent-tools.js` 的 `search_knowledge`）：
  - `fabric_search(q)` 根优先编排（默认入口）
  - `kb_query(collection, q)` 定向查某库
  - `kb_get(ref)` 按锚点取全文（qmd get/multi_get）
- **风险**：`node-llama-cpp` 原生模块 Electron 打包（Windows ABI/prebuild）；GGUF 模型体积与按需下载；冷启动/增量索引；无模型时降级到词面 fallback。

---

## 7. 技术架构（对接现有模块）

```
渲染层(workspace.js)  Fabric 图谱视图 / 检索台(来源+冲突) / 织网审核 / 库管理
        │ preload(补: fabric-query / kb-mount / weave / qmd tools)
IPC(main.js)          fabric-query  kb-mount/weave  fabric-graph  qmd-index  steward-*
        │
逻辑层(src/lib)
  [新] fabric-graph.js      语义/结构层 CRUD(graph.json/routing.json)
  [新] fabric-weave.js      织网管线(抽取→摘要→锚点→连边→索引)
  [新] fabric-retrieval.js  根优先编排 + 路由 + 融合 + 仲裁
  [新] qmd-engine.js        qmd 封装(索引/查询/get, collection 管理)
  [改] knowledge-provider   新增 kind:'qmd-local';抽象统一 retriever 接口
  [用] knowledge-os.js      根 wiki 存储/浏览(index.json → 扩为 fabric)
  [用] knowledge-steward    织网/冲突/维护/升库提案(人工审核)
  [用] okf-lib.js           OKF 校验(升库门禁)
  [替/降] semantic-index.js 被 qmd 取代或降级为 fallback
```

---

## 8. 阶段路线图（每阶段 = 一个未来 change）

| 阶段 | 建议 change 名 | 交付要点 | 依赖 | 关联 change |
|---|---|---|---|---|
| P0 | `unify-knowledge-registry` | 外挂库注册表(scope/authority/tier) + retriever 抽象 + preload 补齐(export/import/ingest) | — | _部分并入 `establish-root-knowledge-fabric`_ |
| P1 | `establish-root-knowledge-fabric` | 根 Fabric 三层：graph.json/routing.json + 图谱视图 | P0 | **`establish-root-knowledge-fabric`**（MVP 垂直切片） |
| P2 | `weave-external-kbs-into-fabric` | 织网管线(挂载→抽取→锚点→连边)，Steward 审核 | P1 | _并入 `establish-root-knowledge-fabric` 基础版_ |
| P2.5 | `evaluate-qmd-retrieval-engine` | qmd 在 Windows/Electron 打包 spike + 模型管理方案 | 可并行 | _待创建_ |
| P3 | `root-first-federated-retrieval` | 根优先编排 + 路由 + 选择性扇出 + qmd tools | P1,P2.5 | _核心已并入 `establish-root-knowledge-fabric`_ |
| P4 | `fabric-governance-and-conflict` | 断锚/新鲜度/冲突调和 + 联合体检面板 | P1-P3 | **`fabric-governance-and-conflict`** |

并行说明：P2.5 可与 P1/P2 并行验证；P0/P1 是新地基，须先行。

---

## 9. 现存缺口（探索发现，需在相应阶段修复）

- `knowledge-export`/`import` 有 IPC 但 preload 未暴露 → P0 补齐。
- `knowledgeOsIngest` 有 IPC 但 UI 未调用 → P2 接入织网/升库。
- `semanticRerank` 默认关且无 UI → 被 qmd 取代或加开关。
- 两套知识根（`knowledge/` vs `knowledge-os/`）未统一 → 用 Registry + Fabric 收敛。
- seed 文档 `knowledge-seed/processes/knowledge-io.md` 指向已移除入口 → 更新。

---

## 10. 相关既有工作

- `openspec/changes/ai-llmwiki-knowledge-steward-workspace/`：AI 批量整理 + 提案审核工作台（本 initiative 的 Steward 审核层复用其成果）。
- `src/lib/knowledge-os.js`、`knowledge-provider.js`、`knowledge-steward.js`、`semantic-index.js`、`agent-tools.js`：现有知识运行时基座。

---

## 11. 变更记录（Changelog）

- 2026-08-08：初稿。沉淀四轮讨论（知识库定位 → 多库治理 → qmd → 根 Fabric 织网）为北极星路线图。

# QA Plan — unify-capability-fabric-foundation

## Smoke Scope

- [x] 旧 SKILL.md、EXPERT.md、connector manifest 和 Cursor linked 能力无需 sidecar 仍可导入
- [x] v2 能力在 Hub 展示真实 dependencies、permissions、inputs/outputs、risk、provenance
- [x] required dependency 缺失时安装/启用被阻止，optional 缺失仅警告
- [x] high/critical 能力未经确认不会改变 install store
- [x] curated connector 安装后设置页、Hub 和 Agent 状态一致
- [x] manifest-only MCP connector 可运行，不依赖既有 connectors.json 条目
- [x] legacy connectors.json 迁移幂等、有备份且可回退
- [x] Pack 聚合原子能力依赖和风险，不复制独立 schema

## Automated

- `node --test tests/capability-manifest-v2.test.js`
- `node --test tests/capability-store.test.js tests/capability-import.test.js tests/capability-catalog.test.js`
- `node --test tests/expert-runtime.test.js tests/skill-runtime.test.js tests/connectors.test.js tests/capability-pack.test.js`
- `node --test tests/capability-integration.test.js tests/capability-hub.test.js`
- `npm test`
- `npm run lint`
- `openspec validate unify-capability-fabric-foundation --strict`

## Manual / Electron

1. 启动 KnowMe，进入能力 Hub 三个现有 Tab。
2. 查看精选 Skill、Expert、Connector 与本地导入项的详情治理字段。
3. 尝试启用缺失 required dependency 的能力，确认有明确阻断。
4. 尝试启用 high-risk MCP，先取消再确认，核对状态只在确认后变化。
5. 在旧设置页修改 Connector allowlist/启停，返回 Hub 和 Agent 核对一致。
6. 重启应用，确认迁移不重复、状态持久化且控制台无 uncaught error。

## Regression

- Hub 单层顶部栏、专家/技能/MCP 连接器三 Tab 与响应式布局不变
- Session 快照、L0–L3 Skill、linked path confinement 不变
- Feishu JIT auth 和 write-review 不变
- preload API 名称和 Renderer Node 安全边界不变

## Evidence

- `evidence/dev-self-test.md`
- `acceptance.md`
- `code-review.md`
- `evidence/test-report.md`
- `evidence/ui-smoke-evidence.md`

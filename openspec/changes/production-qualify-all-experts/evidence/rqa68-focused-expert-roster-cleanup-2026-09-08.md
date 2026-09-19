# RQA68：核心专家名册收敛与历史清理

日期：2026-09-08

## 结论

KnowMe 内置专家从 22 个收敛为 6 个核心专家：`product-manager`、`office-partner`、`research-analyst`、`software-engineer`、`data-analyst`、`image-producer`。

本轮完成的是组合治理、能力承接、目录与历史清理及工程门禁，不是生产资格认证。AgentEvals 当前显示 6/6 包合同为 100，但 6 位均无满足资格规则的当前配置运行样本，严格结论仍为 0/6 `unverified`。

## 处置

- 12 个重叠角色合并到 6 个核心专家的声明式路由或包内执行模式。
- `presentation-writer`、`content-strategist`、`longform-editor` 退出专家身份，保留为通用 Skill。
- `external-capability-importer` 退出专家身份；导入工具仅按任务 required tools 由平台工作流投影，不再按专家 ID 特判。
- 16 个退出内置专家包从 `src/catalog/experts` 与 `catalog.json` 删除。
- 生产迁移删除对应 curated 安装记录和历史任务，不创建兼容备份；即使安装记录已经缺失，内置退役专家的孤儿任务也会被删除；用户自定义同名专家和任务按来源保护保留。

## 关键能力承接

- 产品经理：产品定义、用户研究、需求评审。
- 办公协作专家：办公写作、会议证据整理、行动项提取及飞书读取路由。
- 研究分析师：研究综合、事实核查、知识策展。
- 软件开发工程师：工程实现、架构决策、独立质量验证。
- 数据分析师：数据分析、商业洞察、数据报告。
- 生图执行专家：创意方向、视觉 Brief、真实生图、修改与验收。

## 验证

- 迁移专项：7/7 通过；聚焦组合、依赖闭包与执行矩阵此前全量通过。
- 最终后端回归：3408/3408；Renderer 607/607、lint 与 typecheck 均通过。
- AgentEvals：6 个生产候选；包合同 100；qualified 0/6；expert-title eligible 0/6。

## 剩余生产门禁

每位保留专家仍需在当前 Agent、Skill、Connector、模型和运行时配置上完成 normal×2、edge、retry、revision、reopen 的真实证据，并通过独立专业断言与 UI 验收。生图专家必须额外完成真实图片生成、整图预览、修改基图继承、失败副作用与验收闭环。

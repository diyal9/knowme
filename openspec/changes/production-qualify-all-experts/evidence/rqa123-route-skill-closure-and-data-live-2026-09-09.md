# RQA123：路线 Skill 安装闭环与数据分析师专项执行

## 发现

数据分析师的 `data-report`、`business-insight` 路线声明了 `requiredSkills`，但对应依赖在专家能力包中仍标记为可选。安装专家后这些 Skill 不会进入当前专家的可用绑定，运行时才报“技能未安装”，导致专项路线无法执行。

## 修正

- 将数据分析师四个路线 Skill（`business-metrics-analysis`、`business-cause-analysis`、`business-insight-report`、`data-report-method`）改为专家安装闭包中的必需依赖。
- 将办公协作的四个路线 Skill和研究分析师的 `knowledge-steward` 改为必需依赖；外部 Feishu 连接器仍保持可选并继续由运行时授权/可用性门禁控制。
- 增加通用回归，保证保留专家所有路线声明的 Skill 都是专家安装闭包的一部分。

## 验证

- `tests/expert-required-skills.test.js`、`tests/rqa38-capability-dependency-update.test.js`：`11/11` 通过。
- 本地 OpenAI 兼容文本夹具 + 正式 Electron 资格入口：
  - `DA07 data-report`：`review`，路线 `data-report`，execution evidence `1` 条；
  - `DA08 business-insight`：`review`，路线 `business-insight`，execution evidence `1` 条；
  - 生命周期 `2/2`，运行失败 `0`，环境阻塞 `0`。

本证据证明安装闭包、正式任务运行时和路线回执闭环，不代表真实 Provider 或独立专业语义评审已经通过；`professionallyQualified=0` 保持。

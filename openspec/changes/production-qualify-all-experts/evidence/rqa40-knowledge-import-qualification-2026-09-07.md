# RQA40：知识治理与能力导入专家首轮资格审查

日期：2026-09-07。题面与断言来自此前冻结但未执行的 knowledge/import 集；只做格式归一，未在看答案后改标准。隔离 userData，未执行外部写入。

## 实际结果

| 专家/案例 | 运行证据 | 功能 | 专业结论 |
|---|---|---|---|
| knowledge-curator 2.1.0 / KC04 | `task-mtq5bztc-8id20`，review，3065 字，0 工具 | A1–A3 可运行；异常/续作未测 | 1/5。虽区分同名范围、完全重复和旧引用，并给 6 问，但凭空声称国内/海外文档库、公开权限、现行/失效状态、新流程、IP 排序、24 小时/90 天规则和具体责任部门，触发事实捏造红线 |
| knowledge-curator 2.1.0 / KC05 | `task-mtq5cxxw-b6aq6`，needs_input，候选 1388 字，0 工具 | 门禁以“责任人无来源”替换正文，A3 失败 | B 未验证。没有可用专业正文，不能因拒绝状态推断其方法正确 |
| external-capability-importer 1.4.0 / ECI04 | `task-mtq5dbq4-r2vcq`，needs_input，候选 1109 字 | 用户提供的历史安装信息被执行声明门禁拦截，无交付 | B 未验证；不能判断 installed/ready/verified 分层是否答对 |
| external-capability-importer 1.4.0 / ECI05 | `task-mtq5dm3y-c3aln`，needs_input，候选 1184 字，2 次 discover_tools | 仅需拒绝旧确认并重做预览，却进入工具发现后被门禁替换；A3 失败 | B 未验证；同时暴露“每次必须预览”的包规程过度刚性 |

## 归因

1. 知识策展专家的问题属于 Agent/Skill 专业纪律：把缺失元数据补成确定事实，不能由 KnowMe 为某专家写特判。
2. 能力导入专家同时存在包设计和通用门禁问题：咨询/判断任务不应强制执行导入工具；用户明确提供的历史工具结果应允许按来源归因描述，但不能冒充本轮 ToolLedger。
3. `review`、`needs_input` 与 gate verified/blocked 只是功能状态，不是专业能力分数。

两位均未获生产资格；需要先修路由/来源表达，再用原题及同机制变体复测。

# QA Plan

## Smoke Scope

- [x] 使用运行时定义创建完整专业 Agent，不修改 `src/catalog/experts`。
- [x] 创建后 Agent 进入能力中心、可被工作台绑定，并能生成任务快照。
- [x] 更新 Agent 后版本、manifest、overlay、install record 与 revision 一致。
- [x] retire 后 UI 不提供新任务，IPC 和子 Run 同样拒绝启动。
- [x] 历史任务在 Agent retire 后仍保留原冻结 persona/合同。
- [x] restore 后在依赖就绪时可重新创建任务。
- [x] rollback 恢复目标定义且保留新的审计记录。
- [x] 创建弹窗只显示结构属性，不显示 AgenticType、Soul 或 SOP 等调优项。
- [x] 保存完整结构属性后写入 draft，并创建 `能力管家` 草稿任务后打开现有专家协作房。
- [x] 创建房间失败时保留已保存草稿并显示可恢复错误，不错误宣称已进入调优。

## Security

- [x] preview 不写文件，commit 必须携带有效且未过期的 token。
- [x] Agent hash 在预览后变化时 commit 返回 stale。
- [x] Agent 工具写操作进入主机审批；模型布尔字段不能自行授权。
- [x] id 路径逃逸、非法 semver、重复路线、未知必需依赖和权限越界被拒绝。
- [x] bundled Agent 只能 runtime retire，不被物理删除。
- [x] 草稿更新不发布 Agent；commit 仍是唯一需要主机审批的发布入口。

## Professional quality

- [x] 缺少范围、边界、输入、输出、路线或质量复核时不能发布。
- [x] route requiredSkills 必须属于声明绑定；requiredTools 必须受权限 allowlist 约束。
- [x] 外部写权限必须声明足够风险等级和理由。
- [x] 新建和实质更新后的 qualification 不冒充已完成专业认证。
- [x] 能力管家明确区分结构就绪、真实试运行和独立专业资格，并可建议降级为 Skill/工作流。
- [x] Skill 新建通过协作对话澄清触发、输入输出、步骤、边界和评估标准，不要求用户填写完整定义表单。
- [x] Skill 静态校验不会被描述为行为评估；只读 Skill 不允许原地覆盖。

## Regression

- [x] 原有能力中心创建、复制、编辑、删除个人 Agent 保持可用。
- [x] curated Agent 安装、停用、卸载保持可用。
- [x] 技能页展示搜索和“我的技能”，连接器页展示搜索和“我的连接器”，右上角不再显示“只看已安装”开关。
- [x] “我的技能”提供新建入口并进入能力治理协作房；“我的连接器”不提供创建入口。
- [x] 能力管家顶部不展示 Agent 选择器；输入框支持 `#` 搜索、选择、展示和提交可管理 Agent，对话结构化选项也能绑定精确对象。
- [x] `npm run check` 全绿。

# Delta Spec: workspace

## ADDED Requirements

### Requirement: Daemon launch dialog prefers remote context defaults

当 Workbench 通过远程 Daemon 启动工作流时，启动弹窗 MUST 优先展示 Daemon 返回的默认上下文，而不是仅依赖本地缓存。

#### Scenario: Load launch defaults from Daemon

- **GIVEN** 用户打开一个可通过 Daemon 启动的工作流
- **AND** Daemon 提供该 workflow 的默认上下文
- **WHEN** 启动弹窗渲染启动上下文区域
- **THEN** `GitLab 项目 / 仓库`、`ref`、`commit`、输入制品目录、PRD/asset 文件与输出目录 SHOULD 优先展示 Daemon 返回值
- **AND** 用户仍可以手动修改这些字段后再提交

#### Scenario: Graceful fallback when Daemon has no defaults endpoint

- **GIVEN** 用户打开一个可通过 Daemon 启动的工作流
- **AND** 当前 Daemon 版本尚未实现默认上下文接口
- **WHEN** Workbench 尝试读取默认上下文
- **THEN** 弹窗 MUST 继续可用
- **AND** 系统 SHALL 回退到已有本地缓存与占位符
- **AND** MUST NOT 因接口缺失阻断任务启动

### Requirement: PRD field supports requirement asset files

启动上下文中的 PRD 字段 MUST 明确支持仓库内的需求附件文件，而不仅是 Markdown 文档。

#### Scenario: Input PRD markdown path

- **GIVEN** 用户准备启动远程工作流
- **WHEN** 用户在 `PRD / asset 文件` 字段填写 `PRD.md`
- **THEN** 系统 SHALL 将其作为 `inputs.prd` 提交
- **AND** 路径 MUST 继续按仓库内相对路径校验

#### Scenario: Input requirement asset path

- **GIVEN** 用户准备启动远程工作流
- **WHEN** 用户在 `PRD / asset 文件` 字段填写 `assets/mockup.png`
- **THEN** 系统 SHALL 将其作为 `inputs.prd` 提交
- **AND** 系统 MUST NOT 因其不是 Markdown 文件而拒绝
- **AND** 路径仍 MUST NOT 是绝对路径或目录穿越路径

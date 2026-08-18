## Purpose

Defines the task-first pipeline service workbench: managing Daemon pipeline tasks, creating them with goal and materials, evaluating required ingest per workflow, and reviewing task status and artifacts.

## ADDED Requirements

### Requirement: 管线任务列表为主入口

管线服务 Tab 默认界面 SHALL 以管线任务管理为左侧主入口：展示服务返回的管线任务列表、「+ 新建任务」、搜索与状态筛选，以及服务在线/离线状态。界面 MUST NOT 以交付路径目录作为默认左栏主内容。

#### Scenario: 进入管线服务看到任务管理

- **WHEN** 用户打开工作台「管线服务」Tab 且服务在线
- **THEN** 左侧标题为任务管理类文案（如「管线任务」）
- **AND** 可见「+ 新建任务」
- **AND** 展示当前 Daemon 任务列表（可为空状态）

#### Scenario: 离线降级

- **WHEN** 管线服务离线
- **THEN** 列表区展示可读离线提示与重试入口
- **AND** 「+ 新建任务」禁用或提交前阻止并提示连接

#### Scenario: 筛选与搜索

- **WHEN** 用户输入搜索词或选择状态筛选（全部 / 需要你 / 进行中 / 已完成）
- **THEN** 左侧列表仅显示匹配的管线任务

### Requirement: 创建管线任务对话框

系统 SHALL 提供「创建管线任务」对话框（或等价居中面板），包含：目标描述输入、补充材料上传/关联区、交付路径选择（可默认一级路径）、取消与「开始开发」操作。目标描述与材料规则 SHALL 允许：描述不少于 20 字，或至少一份补充材料，二者满足其一方可提交（另受 ingest 门禁约束）。创建区 MUST NOT 把软 ingest 就绪态渲染成可点击 toggle；软项由上方「目标描述」与「上传区」自然完成，硬项缺失在提交时提示。

#### Scenario: 打开新建

- **WHEN** 用户点击「+ 新建任务」且服务在线、无硬阻塞
- **THEN** 展示创建对话框，提示描述业务目标/范围/验收
- **AND** 展示居中虚线上传区（文案在组件内：点击或拖拽文件到此处上传）

#### Scenario: 最短材料门槛

- **WHEN** 用户未满 20 字且未上传/关联任何补充材料
- **THEN** 点击「开始开发」时提交失败并以提示补全（不在表单上常驻红字拦截条）

#### Scenario: 满足门槛可继续校验

- **WHEN** 用户填写不少于 20 字描述，或已添加至少一份补充材料
- **THEN** 最小文本/材料门槛通过
- **AND** 仍 SHALL 继续执行该路径的 ingest 判定（见下条；硬缺失在提交时阻止，不在创建表单用假 toggle 展示软清单）

### Requirement: 按 Daemon 路径判定 required ingest

创建管线任务时，系统 MUST 根据所选交付路径解析所需 ingest 项（例如需求说明文档、美术/原型资源、配置说明等），展示每项就绪或待补状态。硬失败项（服务离线、路径锁定、或路径声明为 hard 的缺失输入）MUST 阻止「开始开发」；软缺失 MUST 明确标出，MAY 允许启动。

#### Scenario: 缺 hard 输入阻止开工

- **WHEN** 所选路径将「需求文档」声明为 hard 且用户未提供对应 ingest
- **THEN** 对应项显示待补
- **AND** 「开始开发」不可用

#### Scenario: 美术资源类路径

- **WHEN** 所选路径需要美术/原型类资源
- **THEN** ingest 清单包含资源类项（标签可读，如「原型或 UI 稿」「美术资源」）
- **AND** 用户关联符合建议类型后该项转为就绪

#### Scenario: 无 schema 时的回退

- **WHEN** Daemon 未提供 required inputs 声明且 launch-context 不可用
- **THEN** 系统仍展示基于路径类型的默认 ingest 建议（至少含需求说明与补充材料）
- **AND** 默认将业务材料视为软提醒，不得因 schema 缺失而全部 hard 阻断

### Requirement: 任务态审阅面

选中某条管线任务后，右侧主内容 SHALL 呈现该任务的状态与审阅相关信息：至少包含状态标签、与任务相关的下一动作，以及产物或步骤/事件中可导航的一项入口。审阅信息 MUST 绑定选中任务，不展示无关路径的通用开工台作为右侧默认内容。

#### Scenario: 选中后看状态

- **WHEN** 用户在列表中选中一条管线任务
- **THEN** 右侧显示该任务标识（intent 优先）与状态
- **AND** 显示下一动作或空状态说明（如排队中尚无产物）

#### Scenario: 产物为空

- **WHEN** 选中任务尚无 artifacts
- **THEN** 产物区域展示「暂无制品」类空状态，不伪造产物

#### Scenario: 未选择任务

- **WHEN** 列表存在任务但用户尚未选择
- **THEN** 右侧引导选择管线任务以查看状态与审阅

# RQA57：导入专家执行合同与资格诊断

日期：2026-09-07  
结论：KnowMe 已能通用识别“可导入但不可证明可执行”的外部专家包；当前安装的 `ui-expert` 与 `artbundle-expert` 均判为 limited，不授予专家资格。

## 1. 系统性根因

旧的 Cursor 仓库扫描只确认 Expert/Skill 目录和声明 ID 存在，预览固定显示 `compatible`。Skill 即使要求运行脚本、调用 MCP 或读取不存在的包内资料，只要目录可见就会被注册为 enabled。这里混淆了三个状态：

- `installed/enabled`：包已登记且没有被禁用；
- `executable`：动作、权限、连接器、脚本入口与资源闭包能够被宿主验证；
- `qualified`：真实任务的专业质量和完整生命周期已经验收。

前者不能推出后两者。

## 2. 通用整改

Cursor 仓库扫描现增加只读合同诊断，不按专家 ID 分支，也不自动扩大权限：

- 校验 Skill Markdown 的仓库内链接，越界或不存在时记录 `missing_capability_reference`；
- 包内 `scripts/` 由 KnowMe 通用 `run_skill_script` 执行，不因“存在脚本”误判受限；只有命令引用 Skill 包外入口时记录 `unportable_execution_path`；
- `CallMcpTool` 没有 connector 依赖时记录 `undeclared_connector_contract`，直接下载命令没有 action/permission/connector 合同时记录 `undeclared_network_contract`；
- 必需 Skill 受限时，Expert 标记 `contractStatus: limited` 并列出 `limitedSkills`；
- 仓库预览由固定 `compatible` 改为真实 `compatible/limited`；
- 导入仍可继续，但评估结果写入统一 manifest 的 `metadata.knowme.qualification`，不会把用户仓库内容覆盖成 KnowMe 内置模板。

普通对话式澄清（如 AskQuestion）、脚本库文件说明和裸标识链接不被误判为宿主执行动作。进一步核查发现旧 `run_skill_script` 虽接收 `args`，实际运行器未向子进程传递。本轮补齐通用参数合同：优先接受显式 `args.argv`，也可把命名参数稳定转换为 kebab-case CLI flags；Node/Python/Shell/PowerShell 脚本以 argv 数组直接启动，避免 shell 插值。路径仍限于 Skill 自身 `scripts/`，原审批、权限和沙箱边界不变。

## 3. 真实 th-art 扫描结果

对 `D:/aiworkspace/th-art` 重新扫描：5 个 Expert、22 个 Skill、1 个 Connector、3 个 Workflow、254 份知识资料。预览状态为 `limited`，共 11 个 Skill 与 5 个 Expert 受限；诊断包含 27 个不可达本地引用、6 个跨包执行入口、1 个未声明网络合同、1 个未声明 MCP 合同、5 个受限专家。

- `ui-expert`：limited。关键受限 Skill 为 `th-art-prompt-enrich`、`th-art-pango-generate`、`th-art-ui-slicer`。生图 Skill 明确要求盘古 MCP，但仓库只发现 Creator Connector；多个 `../../knowledge/...` 路径从 Skill 目录解析后不存在；切图流程仍调用仓库根 `scripts/`，不能由包内脚本运行器携带。
- `artbundle-expert`：limited。关键受限 Skill 为 `th-art-artbundle-export`、`th-art-export`。前者调用多个仓库根构建/导入脚本，后者要求直接下载但没有网络合同；“有操作说明”不等于已形成可移植的宿主执行入口。
- 源仓库另外三个 PSD 专家也全部 limited；它们不是当前 24 位冻结安装范围，但证明问题属于仓库包契约，而不是单个生图专家。

## 4. 验证与边界

- 新回归先失败于 `contractStatus` 缺失；校准阶段又用包内脚本与描述性 `.py` 引用反例排除了误报。导入、沙箱、参数序列化、Skill 工具和运行时聚焦组合 72/72 通过；真实 Node 脚本收到 `--out`、含空格值和 shell 元字符原样 argv，证明不是只测转换函数。
- 最终 `npm run check` exit 0：后端 3507 passed / 51 skipped / 0 failed；渲染层 86 files、606 tests 全绿；lint 与 renderer typecheck 通过。
- GitNexus 将扫描入口评为 HIGH；`runSkillScriptInSandbox` 与通用 `buildSandboxTools` 评为 CRITICAL（分别影响 7、5 条流程）。改动保持现有工具定义、审批、权限和工作目录边界，仅增加向后兼容的内部 argv 执行入口及精确诊断，并覆盖直接调用方和真实子进程。

本轮没有修改用户的 th-art 源仓库，也没有伪造盘古、Photoshop、Creator、CLI 或文件写入回执。两位自定义专家要获得资格，必须先在 Agent 包中声明可执行 action/connector/权限、修正资源路径与依赖闭包，再完成真实正常、失败、重试、修改、验收和重开任务。

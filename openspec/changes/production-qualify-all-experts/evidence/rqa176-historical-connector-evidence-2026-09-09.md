# RQA176：历史连接器证据与沙箱探针边界

日期：2026-09-09

## 结论

本次审计同时读取了 KnowMe 用户数据中的连接器配置、专家任务记录和 Agent run 记录。历史记录表明，Feishu 曾在真实运行中完成会议候选读取与妙记读取，Pango 生图链路也曾产出并被用户验收的图片成果。当前命令行沙箱中的连接器实时探针返回失败，不能据此覆盖历史成功记录，也不能把历史记录直接升级为当前版本的生产认证。

## 证据口径

- Feishu：用户数据中的连接器已启用；历史 `agent-runs` 中存在终态成功、provider 用量记录以及 Feishu 工具面加载记录。
- Pango：用户数据中的 `pango-image-mcp` 已配置并保留授权密钥；历史专家任务存在已验证且已验收的图片成果及对应 run 引用。
- 当前版本：历史成果对应的专家版本或内容哈希与当前包不一致，因此审计将其标记为 `staleVersionEvidence`，不用于当前 route qualification。
- 沙箱边界：审计命令无法复用 Electron 正常运行时的授权会话、网络环境和 MCP 进程上下文；实时探针失败只标记为当前环境不可复核。

## 代码行为

生产审计现在输出三类互不混淆的信号：

1. `historicalEvidence`：展示历史已验收成果、任务号和 run 号，支持追溯与复用测试样本。
2. `productionReady` / `executionReady`：只接受当前专家版本的完整执行回执，并要求当前运行环境中的必需连接器可用。
3. `historicalRunEvidence`：展示历史成功终态中实际加载过的连接器工具面；它弱于工具成功回执，只用于诊断“过去是否能看到连接器”。

此外，审计只对当前 bundled catalog 中的 6 个核心专家计算生产路线；用户数据中已存在的 Crawl4AI、舆情专家作为非生产用户侧记录保留，不再阻塞当前 6 个专家的目录口径。

## RQA178：探针状态分类

当连接器同时满足以下条件时，审计不再将其直接列为 `unhealthyConnectors`：

- 当前进程确实尝试过探测，但状态是 `auth_required`、`offline`、`probe_failed` 或安全存储/沙箱不可用；
- 用户历史 `agent-runs` 中存在该连接器的成功终态工具面记录。

这类连接器进入 `connectorHealthInconclusive`，并保留连接器 ID、探针状态和复核原因。它仍会阻止 `productionReady` 与 `executionReady`，所以“历史上授权/运行过”不会被错误升级成“当前已通过”，也不会被沙箱误报成“连接器已损坏”。本次真实用户数据结果为：Feishu `auth_required`、Pango `offline`，两者均有历史成功运行证据，均被归类为当前环境不可复核。

## 后续复核

需要确认当前 Feishu/Pango 是否可执行时，应在 KnowMe Electron 正常运行环境中由用户完成一次真实任务复核；不要在沙箱中重复扫码或重新录入密钥。

## RQA179：专业资格接入生产门禁

审计新增可选 `--qualification-report` 输入。未提供时，审计明确输出 `qualification.status=not_provided` 和 6 个缺失专家，不影响静态 `packageReady` 判断，但 `productionReady` 保持 false。

资格报告只有在每个当前保留专家都具备以下条件时才可通过：

- 当前 Agent 配置身份匹配；
- normal×2、edge、retry、revision、reopen 场景完整；
- 生命周期通过；
- 独立语义评审通过；
- 硬断言和 `certificationEligible` 均通过。

该门禁把“包结构可加载”“可以进入真实执行”和“专家专业合格”明确拆开。当前真实用户审计未提供完整资格报告，故 `qualificationGatePassed=false`。

## RQA180：分批资格报告合并

`--qualification-report` 现在同时接受单个 JSON 文件和报告目录。目录中的 JSON 按文件名稳定排序合并，忽略 AgentEvals 的派生汇总文件，并保留 `sourceReports`、最新 `generatedAt` 与完整 `tasks`。如果不同文件出现相同 `evalId`，审计返回 `invalid_report` 错误，不继续计算资格，避免重复样本把覆盖率或场景通过数虚高。

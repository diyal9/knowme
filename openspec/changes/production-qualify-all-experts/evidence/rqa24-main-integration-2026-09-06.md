# RQA24 — 生图真实闭环与通用工具发现修复

2026-09-06。24 专家总体目标保持 ACTIVE；本轮没有专家获得生产资格。两次实际生图分别为首次生成和用户确认后的参考图编辑，不是旧/新 Skill 对照。

## 已证实的根因与修复

同一任务 `task-mtphk5gg-jinbr` 首次 createStart 返回 needs_input / capability_unavailable，缺少 generate_image；没有进入模型，没有付费生成。之后实际检查发现两条不同链路，不能混为服务离线：

1. 正式 connectorsStatus 使用已保存凭据，盘古在线且发现 **93** 个工具。connectorsTools 的 projectedAllowlist 包含 list_paint_models/generate_image，但 availableTools 只取前 **64** 项，selected 为空。previewMcpTools 的展示截断污染了供预检使用的完整目录。
2. 旧 Hub connector-health / connector-tools-preview IPC 没有传入主机解析的凭据。真实未认证响应是 HTTP200、顶层 code/msg、code=10001100，提示缺少或非法 Bearer token；HTTP adapter 将它进一步表现为 invalid tools。这个旧入口错误不能证明正式认证链路同样失败。

修复仅涉及通用连接器代码：connector-capabilities.ts 移除 DTO 中的 64 行截断，保留原 allowlist/selected/投影规则；capability-hub/ipc.ts 两入口使用主机按已存连接器解析的运行选项，不接受渲染层传入凭据，也不把凭据扩入响应。缺少可选 resolver 时保持原无凭据探测能力，不能伪造认证或将服务拒绝转为成功。HTTP 非标准错误体的更精确分类本轮未修改。

新测试 connector-discovery-completeness.test.js 为 6 项，实际 DTO 接通用 preflight；内存恢复旧截断后 3 红/3 绿，当前 6 绿，权限拒绝控制保持拒绝。capability-hub-connector-auth.test.js 初版 15 项红12/绿15，覆盖 bearer/header/env、轮换、失败、未找到、渲染层伪造凭据及 DTO 不泄漏；主线消费者审查又发现可选 API 的空值兼容边界，追加测试与修复。未对生图专家 ID 加预检豁免，没有扩大白名单。

## 真实运行与范围隔离

只重启自有 QA Electron：PID9072 → 27096，同一 `knowme-expert-qualification-e3808573825e42908aef0a0f2d0f20de` 临时 profile，CDP9223/Vite5173。重启前无 running/starting/revising 任务；未触及日常 APPDATA 或 CDP9222。冷启动后的 Hub health、Hub preview、正式 tools DTO 均正常，目录93项、两个目标均 selected。正常 retry 同一已有确认任务，未直接调用生图绕过编排。

实际安装 image-producer 的 entry=3.1.0、E/L/C=3.2.0；当前仓库 E/L=3.3.0、C=3.2.0、catalog=3.1.0，版本不一致仍是待修项。三个 th-art 方法实际来自用户确认的外部 linked repository，不是本地 managed 目录中的短内置方法；无目录副本不等于没装 Skill。本轮没有覆盖 linked Skill，也没有把仓库3.3 SOP算成已安装执行证据。未捕获两轮完整 L1 装配，不能认证方法遵循程度。

| 版本 | 真实 run | 工具 | 保存图片实际尺寸 |
|---|---|---|---|
| v1 | expert_task-mtphk5gg-jinbr_mtpi45c0 | list_paint_models 一次、generate_image 一次；task_id307050 | JPEG，896×1200 |
| v2 | expert_task-mtphk5gg-jinbr_mtpidoxs | generate_image 一次，带 v1 真实字节引用 | PNG，1088×1440 |

两轮均回到 review，未点击接受成果。v1 文件 SHA256 为 `6c8124d9d8735d9b3133e402172fe7096fd3e52a9bbe474c90394aa86582ff33`；v2 为 `b35a1e161e1cbf3d2c666c9abeaaba726156ba1d408135ddbedd2848f9b30129`。v2 请求参考图 data 字节的 hash 与 v1 一致；previousVersionId 指回 v1，旧文件仍在。仅在 v2 临时观察自有进程的 fetch，原样传递所有请求，只存盘古业务参数和参考图摘要，未保存凭据；执行结束已恢复原 fetch。模型传输没有经过该观察点，未观察到模型 HTTP 不等于没有视觉输入，视觉自查声明保持缺证。

## 用户体验与专业判断

- 退回修改只聚焦唯一主输入框。通过该输入框发送“只改杯身、保留杯盖”的意见，用户文字在任务/对话中保留，自动进入 v2，不再要求第二次按钮确认。
- v1、v2 本地图均能在真实 UI 加载；大图 object-fit=contain，在1280×820视口完整呈现四边，未裁切。刷新经工作台重开，v2图片、意见、一个可用主输入框保留。首张重开截图停在历史 v1 文本，另存滚到 v2 缩略图的截图，不能用上方旧文本误判版本丢失。
- 缩略图仍偏小：容器约180×120，竖图实际显示约91×120。当前“可显示”和“预览精细好用”不是同一结论；本轮未修改 UI 样式。
- v1 实际银色杯、墨绿背景和右侧留白方向可辨，但分辨率没有达到1080×1440，实际比率也不是精确3:4。v2同样未精确满足像素要求。专家如实未宣称实际像素已达标，但应由通用图片回执提供可用尺寸，而非让用户再自行查文件。
- v1 交付说明832字符，明显超过简洁两三句话。独立评审确认v2为289字符、三句，简洁性子项通过；不能因主线觉得仍偏长而追加冻结标准之外的失败。
- v2 有真实参考编辑，并非纯文生图冒充。但实际 prompt 主动添加“Same applies to the lid ... whole bottle ... matte black”，实图杯盖也变黑，违反用户仅改杯身并保留杯盖的指示。生成成功不能替代精确执行。
- “工具已成功”“review”“有图”“工程绿测”均不足以证明专家级专业性。独立冻结标准的逐项评审另存 rqa24 专业评分；不因看到失败而降低验收门槛。

## 工程检查与剩余工作

初版完整 npm run check，session70247，exit0；renderer85文件597项通过，test/lint/typecheck各阶段成功。此完整运行在可选 resolver 补充修正之前，最终检查以补充记录为准，不冒称旧检查覆盖后改源码。旧stdout较长而截断，未编造 backend 精确计数。主线另复跑相关81项、完整目录6项、初版认证15项均通过。

GitNexus previewMcpTools 影响 HIGH：直接调用者为 buildMcpAllowlistDto、registerCapabilityHubIpc；已告知用户并检查消费者。IPC注册函数影响 LOW。传输函数曾评估 CRITICAL，但最终未修改传输。整树 detect_changes 为321文件/700符号/172affected、CRITICAL，含大量既有共享改动，不表示本轮全部写入或全部审查。未提交或覆盖其他改动。

最终增量：可选 resolver 修正后，独立执行完整 check94873 exit0，backend3294 pass/51 skip、renderer597 pass，lint/typecheck通过；主线复跑本轮29项全部通过。真实冷启动/生图发生于这一空值兼容修正之前，正常有 resolver 的路径与最终版一致，但不声称已用最终hash再次收费生成。最终IPC SHA256为171b191889ccece5641966ddfaa88fe8097dfb11ebd9e6b19e0774c024bdde7e。

独立专业评审已逐项阅读：v1为7通过/2失败/1不可评；v2为7通过/3失败/1不可评。v1失败是尺寸与冗长交付；v2失败为尺寸、编辑指令与保留项。首句格式和改黑杯盖并非两个独立视觉缺陷。v2简洁性通过，视觉输入过程仍缺证；v1没有单独缩略图截图，P1不可评，而非图像加载失败。该评审非盲，标准作者已看过主线反馈后独立打开原图，不包装为盲审。没有资格放行总分。

下一步：以真实失败改进通用图片元数据回执和预览，再对齐专家包版本、明确编辑保留项与交付长度约束，检查实际方法装配并做冻结新题/独立评估。保护外部 linked Skill 的来源与内容；不通过专家 ID 特判兼容专业差异。24专家全集、异常恢复、安装升级与专业质量仍未完成。

证据：rqa24-baseline-discovery-v1.json、rqa24-v2-reference-edit.json、rqa24-v1-preview.png、rqa24-v2-preview.png、rqa24-v2-reopen.png、rqa24-v2-reopen-image.png，以及预先冻结标准和两份路径/覆盖审查。原始图片保存在隔离 QA profile，路径见 JSON，不将缩略图截图替代原始字节。

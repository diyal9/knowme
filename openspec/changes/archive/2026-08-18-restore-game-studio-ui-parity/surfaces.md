# 界面一比一清单（对照 `f6ad048`）

状态：`缺` = React 明显简化或未接；`薄` = 有壳、缺交互/IPC；`有` = 主干已在；`退役` = 故意不还原。

## A. 独立窗口

| ID | 界面 | 基线入口 | 须还原 | 现状 |
|----|------|----------|--------|------|
| W-workspace | 主工作台 | Vite workspace | 壳+全部内嵌面 | 薄 |
| W-settings | 设置 | `openSettingsWindow` | 7 Tab + 保存 + 飞书授权轮询/scope | 薄（Tab/保存/授权有；文案对齐基线） |
| W-memory | 记忆 | `openMemoryPanel` | 近期列表、点击回跳 | 薄（不回跳便签） |
| W-logs | 日志中心 | FAB / 打开日志 | 日期/级别/搜索/合并/统计/清空/目录 | 有（核） |
| W-toast | 注意力通知 | `attention-toast.html` | 弹出、点击 | 有（可保留 HTML） |
| W-note | 独立便签 | 多窗 | **不还原** | 退役 |
| W-list | 便签总览 | list.html | **不还原** | 退役 |

## B. 主壳 / Rail / 文件中心

| ID | 界面 | 交互与特效 | 现状 |
|----|------|------------|------|
| S-rail | 侧栏 Rail | 文件展开、助理、工作台、专家库、管线、知识网、设置；active / 图标 / 字号 | 有 |
| S-title | 顶栏品牌 | 拖拽区、BrandMark | 有 |
| S-files | 文件中心 | 源切换、刷新、树、搜索、新建、折叠、右键、外链、分屏、版本、飞书链接菜单 | 薄（新建/折叠/打开源/读预览/只读分屏已接；**版本对比 disabled 退役**，非基线双编辑器） |
| S-drawer | 通用抽屉 | backdrop、标题、surface tabs、关闭 | 有 |
| S-ctx | 右键菜单 | `#ctxMenu` | 有 |
| S-toast | 页内 toast | `#toastWrap` | 有 |
| S-fab | 日志 FAB | 徽章、通知、打开日志目录 | 有（`km-fab-notify` 通知流/徽章/needs-attention；日志/目录已接） |

## C. 工作台 surfaces

| ID | 界面 | 交互 / 动作 | 现状 |
|----|------|-------------|------|
| WB-tabs | 模式 Tab | 专家协作 / 工作流 / 管线服务 | 有 |
| WB-search | 顶栏搜索 | 搜工作流 | 有（货架/管理/TaskHome 客户端过滤；placeholder 对齐 f6ad048） |
| WB-taskhome | 专家协作 | 快捷网格、最近任务、新建、进入专家任务房 | 薄（`wb-task-quick-*` + `ExpertAvatarMark` + version/badge 已对齐 f6ad048） |
| WB-expert-room | 专家任务房 | 标题/状态/对话体、返回 | 薄（`wb-expert-task-room` + `wb-side-stack` 侧栏结构已对齐；管理面板交互仍简） |
| WB-shelf | 工作流货架 | 网格/列表切换、卡片徽章、开始、管理、最近、锁定态、空态 | 薄（React DOM/class 已对齐 f6ad048 `workbench-shelf.css`；图标经 `StickyIcons`；最近运行有预览/更多） |
| WB-wf-manage | 管理工作流 | 列表、新建、删除确认、返回、进 Studio | 有（删除经 `confirm-modal` 确认后 archive） |
| WB-manage | 管线服务首页 | 工作模式列表、创建任务文案、任务轨搜索 | 薄（`wb-daemon-compose-*` + linkbar/filters 已对齐 f6ad048；compose 提交/材料 IPC 仍简） |
| WB-auto-page | 自动化页 | 模板、新建、列表、立即跑 | 薄（独立页已接；模板依赖 IPC 返回） |
| WB-auto-modal | 自动化编辑弹层 | 保存/取消、飞书目标 | 有（schedule daily/interval/once/**cron**、connector、permissionMode、管线 select + 飞书推送） |
| WB-daemon-review | 管线详情/审核 | 身份、工作流名、Tab、刷新、日志 | 有（Run live/done 内 `wb-daemon-review` 五步 Tab） |
| WB-studio | Studio | 组件库、画布拖拽平移、四向端口连线、工具条、标题、inspector 表单、保存脏标记、右键、返回来源（货架 vs 管理） | 有（图标工具栏/轻量步骤/专家选择器/滚轮缩放/检查流程；IO 入出参；knowledge provider） |
| WB-run | 任务房间 | 顶栏返回、目标/状态/进度、图、专家列、产物、过程日志、HITL、再跑、trace | 有（`wbRunAgents`/`wbRunGraph`/daemon-review 分区已接） |
| WB-run-input | 启动表单 | 标题、专家、取消、开始 | 有（`wb-run-stage[data-run-stage=input]` 顶对齐，不再垂直居中留白） |
| WB-modals | 通用确认 / 离开 / 删除工作流 / 工作区树弹层 | 蒙层、Esc | 有（`confirm-modal` 离开 Studio + 删除工作流；`wb-ws-mask` 代码工作区壳） |
| WB-ws | 工作区仓库树 | repo 选择、刷新、关闭 | 薄（弹层 DOM/class 已接；依赖 daemon 在线才有树数据） |

## D. 助理

| ID | 界面 | 交互 | 现状 |
|----|------|------|------|
| A-empty | 空态主页 | 快捷开场 | 有（composer 居中、快捷卡文案/图标对齐 f6ad048） |
| A-tabs | Session 标签 | 新建/切换/关闭/右键（重命名/复制记录/关闭） | 有（plus=专家；⋯ 新对话；右键不再含 Pin/分叉/关闭左中右） |
| A-history | 历史弹出 | 搜索历史会话 | 有（搜索+pop-meta/已打开；**ModeAvatarMark 按 agent/expert**） |
| A-model | 模型切换 | 菜单、用量 | 有（分组列表+Context Usage；**发送后接 ai-stream-event contextInfo**，非独立 token IPC） |
| A-expert | 专家弹出 | 选专家 | 薄（顶栏 plus） |
| A-knowledge | 本会话知识 | 菜单勾选 refs | 有（跟随默认 + **providers + wiki/okf**；打开菜单时 loadKnowledge） |
| A-at | @ 文件 | 菜单、键盘、插入引用 | 有（键盘导航+空态） |
| A-slash | 斜杠技能 | 菜单 | 有（基线 slash-item class） |
| A-quick | 快捷指令 | 搜索、空态 | 有（agent-quick-menu 密度+Ctrl+K） |
| A-more | 更多菜单 | 当前工作动作 | 有（新对话/在新对话继续/复制总结；有错误才显示复制错误信息） |
| A-attach | 附件 | 文件 input | 有（FileReader + `agent-attachment` chips；发送时附带文本） |
| A-stream | 流式对话 | chunk、状态条、daemon process feed、返回工作台 | 有（过程摘要+运行日志；**stream-in/chunk 动画**；throttle 时关 blur） |
| A-apply | 写回文件 | 产物卡接受 | 有（气泡不再挂「应用到文件」；写入走 `editor_patch` 产物卡） |
| A-artifacts | 会话产物卡 | 接受/拒绝 | 有（`run.artifacts` + AgentArtifactCards） |
| A-image | 图片查看器 | 放大关闭 | 有（`agent-image-viewer` 蒙层） |
| A-topic | 话题导航 | 滚动定位 | 有（左目录短横线；右侧极细滚动条仅滚动时显示；hover 预览；点击跳转） |

## E. 专家库 overlay

| ID | 界面 | 交互 | 现状 |
|----|------|------|------|
| H-tabs | 专家 / 技能 / MCP | 切换 | 有（顶栏对齐工作台下划线 Tab；无覆盖层关闭钮，离开走 rail） |
| H-search | 搜索 + chips + 仅已装 | | 有 |
| H-featured | 精选行 | | 有 |
| H-grid | 目录卡 | 打开抽屉 | 有（卡头/描述/徽章结构） |
| H-drawer | 详情抽屉 | 启用/配置/关闭 | 薄（hub-drawer 视觉已接） |
| H-add | 添加能力 | 文件夹 / Cursor 仓 / ZIP / URL / 自定义 | 有（`hub-dialog` + `hub-add-layout` 五 Tab） |
| H-expert-dlg | 自建专家 | 头像、Agentic、摘要 chips、空态引导、删除、保存 | 有（对齐 refine-expert-editor-ux） |
| H-picker | 选择器弹层 | 搜索/全选可见项/仅看已选/分类 | 有（`HubPickerDialog`） |

## F. 知识网

| ID | 界面 | 交互 | 现状 |
|----|------|------|------|
| K-list | 知识列表/检索 | 单层顶栏三 Tab + 统计/重读；左树（嵌套默认折叠）右读；空库首触 | 有 |
| K-io | 导入导出 / steward / fabric / obsidian | 来源页导入导出；待我确认提案；更多菜单 Obsidian / 体检 | 有 |

## G. 设置 Tab 细项（W-settings 展开）

| Tab | 须还原 |
|-----|--------|
| 内容源 | 本地/GitLab/GitHub/Web 绑定、同步、树预览 |
| AI 接口 | 模型目录、密钥、保存 |
| 助手模式 | 助手相关开关 |
| 系统配置 | 启动、更新等 |
| 连接器 | 飞书状态、授权轮询、scope 确认 |
| 我的记忆 | 学习开关、巩固、清空、状态 |
| 关于 | 版本与开发者信息 |

## H. 底层能力对照（相对 `f6ad048` IPC，不是 git main）

| 能力 | 主进程 | React | 动作 |
|------|--------|-------|------|
| workbench load/launch/mode/automation | 有 | 部分 | 接线 |
| daemon overview/logs/gate/cancel/artifacts | 有 | 几乎无 | 接线 |
| agent session CRUD | 有 | 几乎无 | 接线 |
| sources tree/CRUD | 有 | 设置有、文件树薄 | 接线 |
| capability/skill 写 | 有 | 只读 | 接线 |
| notes* | 基线有 | 已删 | 保持退役；清 preload 死通道 |
| agentFileCatalog | 无 | 类型有 | 改为 sources |

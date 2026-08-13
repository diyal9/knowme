# 开发自测 — polish-expert-editor-dialog

日期：2026-08-11

## 变更范围

- `src/capability-hub.js`：专家编辑弹窗改为分组表单 + 卡片式多选（`editorPickerGroup`），新增分组计数、全选/清空、底栏选择摘要（`updateExpertEditorSelection`）与必填字段高亮（`markExpertFieldInvalid`）。
- `src/capability-hub.css`：补齐弹窗正文内边距，新增分组头、计数徽标、卡片多选、占位提示、必填与失焦校验样式，以及窄窗口断点。
- `src/capability-hub.html`：底栏新增 `#hubExpertSummary` 摘要与 `.hub-dialog-foot-actions` 按钮组。
- `tests/capability-hub.test.js`：新增专家编辑弹窗静态契约用例。

## 自动化

| 检查 | 命令 | 结果 |
|---|---|---|
| 单元/集成测试 | `npm test` | PASS — 1575/1575 |
| Lint | `npm run lint` | PASS（lint ok / script-scope ok） |
| OpenSpec | `npx openspec validate polish-expert-editor-dialog --strict` | PASS |

## 大目录浏览（第二轮）

真实环境下已安装 Skill 可达 44 个，首版把它们全部平铺，Skills 分组内容高度约 1184px，Tool 与知识库被挤出屏幕。改为浏览模式后：

| 指标 | 平铺 | 浏览模式 |
|---|---|---|
| Skills 分组占位高度 | ~1184px | 354px（内部滚动区 244px） |
| 弹窗正文总高度 | ~1950px | 1014px |
| 一屏可见分组 | 1 | 3 |

| 场景 | 结果 |
|---|---|
| 44 个 Skill 按分类分节 | PASS — 6 个分类小节，组内滚动 |
| 搜索 `feishu` | PASS — 命中 4 项，其余隐藏 |
| 筛选后点「全选」 | PASS — 只勾选 4 个可见项，徽标 `4/44` |
| 「仅看已选」复核 | PASS — 仅显示 4 个已选项 |
| 少量候选（3 个连接器 / 3 个知识源） | PASS — 保持直接平铺，不出现搜索与滚动 |

## 交互自测

在本地静态服务（`http-server ./src`）中以 Chromium 打开 `capability-hub.html`，注入 mock capability bridge（7 个 Skill / 3 个 Connector / 3 个知识源）后打开「添加自己的专家」：

| 场景 | 结果 |
|---|---|
| 桌面 1280×860 分组与对齐 | PASS — 四个分组、正文与标题栏/底栏同左缘，Skills 三列卡片 |
| 勾选 2 个 Skill | PASS — 徽标 `2/7`，底栏「已选 2 Skill」 |
| Tool 分组「全选」 | PASS — 徽标 `3/3`，底栏同步 |
| 知识库勾选 1 项 | PASS — 徽标 `1/3`，摘要「已选 2 Skill · 3 Tool · 1 知识源」 |
| 窄窗口 700×780 | PASS — 表单单列、卡片自适应、底栏摘要与按钮分层，无横向溢出 |
| ID 为空点保存 | PASS — 保存被阻止，ID 字段红框并获得焦点 |
| 控制台错误 | 0（仅目录加载所需 bridge 缺失的既有降级路径） |

## 应用启动

`npm start` 主进程正常启动（`INFO system/app-start KnowMe 主进程启动`），Electron 进程存活。

## 证据

- `evidence/screenshots/expert-dialog-desktop.png`
- `evidence/screenshots/expert-dialog-selected.png`
- `evidence/screenshots/expert-dialog-narrow.png`
- `evidence/screenshots/expert-dialog-large-catalog.png`（44 个 Skill 的分类 + 限高浏览）
- `evidence/screenshots/expert-dialog-skill-filter.png`（搜索 + 仅看已选）

## 备注

界面交互验证在 Chromium（与 Electron 同渲染引擎）中通过本地静态服务完成，未走 Electron 内嵌 Hub 的真实 bridge 数据；保存链路（`expert.save` / `agentProfileSave`）逻辑未改动，仅在校验前新增必填字段高亮。

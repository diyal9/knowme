# Tasks: agent-capability-hub

## 0. 沙箱禁网加固（前置）

- [x] 0.1 审计现有 `run_python`/`run_shell` 实现，记录 urllib/requests/socket 与 node -e 绕过路径
- [x] 0.2 Python：启用 `-I` 隔离 + import denylist 或 AST 预扫描拦截 networking modules
- [x] 0.3 Node：禁止 `-e`/`--eval`；仅允许 `node <script.js>` 且路径必须在 workspace 内
- [x] 0.4 Shell：扩充 denylist（curl/wget/nc/powershell IWR 等）
- [x] 0.5 新增 tests：Python urllib、requests、socket 与 node -e fetch 回归用例全部 blocked
- [x] 0.6 定义 run 级 `permissions: { network, write, dangerous }` 结构并接入 tool loop

## 1. 存储与 Install Store

- [x] 1.1 创建 `src/lib/capability-store.js`：`capabilities/` 根路径、`install-store.json` 读写（atomic rename）
- [x] 1.2 定义 catalog schema 与内置精选 `catalog.json`（bundled seed + 本地 overlay）
- [x] 1.3 实现 install / uninstall / enable / disable / update 状态机
- [x] 1.4 启动迁移：现有 connector settings → `capabilities/connectors/`（一次性，带 `.bak`）
- [x] 1.5 单元测试：install store CRUD、atomic write、enabled 过滤

## 2. 导入安全

- [x] 2.1 实现 ZIP 解压 staging：traversal 检测、大小/文件数上限、symlink skip
- [x] 2.2 实现 HTTPS 下载（仅 https://）+ 信任来源确认对话框
- [x] 2.3 实现本地文件夹导入与 manifest/SKILL.md/EXPERT.md 校验
- [x] 2.4 secret 扫描：拒绝明文 token，仅允许 `env:VAR_NAME`
- [x] 2.5 单元测试：恶意 ZIP（../）、超大包、http URL、secret 字段

## 3. IPC 层

- [x] 3.1 注册 `capability:list|install|uninstall|enable|disable|update|import` IPC handlers（main）
- [x] 3.2 注册 `skill:list|load|readResource|runScript` IPC（或合入 agent tool 路由）
- [x] 3.3 注册 `expert:list|get|save|tryChat|snapshot` IPC
- [x] 3.4 preload 暴露类型安全 API，renderer 禁止 direct fs

## 4. Skill Runtime

- [x] 4.1 创建 `src/lib/skill-runtime.js`：SKILL.md frontmatter 解析（name/description/disable-model-invocation）
- [x] 4.2 实现 L0–L3 渐进披露与四个 Agent tools 注册
- [x] 4.3 实现 description 本地自动匹配（keyword/TF-IDF，无网络）
- [x] 4.4 扩展 `/slash` picker：合并 SKILL.md + legacy OKF
- [x] 4.5 legacy OKF 扫描 `%APPDATA%\KnowMe\knowledge\` 双轨映射
- [x] 4.6 Hub「迁移为标准技能」导出 SKILL.md 向导
- [x] 4.7 单元测试：parse、list_skills 预算、disable-model-invocation、path traversal on read_skill_resource

## 5. Expert Runtime

- [x] 5.1 创建 `src/lib/expert-runtime.js`：EXPERT.md + manifest 解析
- [x] 5.2 实现 skills/connectors 绑定校验
- [x] 5.3 Session snapshot：创建/切换时写入 `snapshots/<sessionId>/manifest.json`
- [x] 5.4 persona 注入 hook 对接 `agent-context-assembly`
- [x] 5.5 ephemeral 试聊 Session（不进入主 Tab 列表）
- [x] 5.6 单元测试：snapshot 冻结、Hub 更新不漂移已开 Session

## 6. Connector Runtime 扩展

- [x] 6.1 内置 curated templates（feishu、mcp-generic）写入 bundle catalog
- [x] 6.2 Hub 连接器 CRUD 对接 capability-store
- [x] 6.3 `agent-mcp-host` 多 client Map + `mcp.<id>.` 工具前缀
- [x] 6.4 enable/disable 时 connect/disconnect lifecycle
- [x] 6.5 Hub health probe + tools preview + allowlist 编辑器
- [x] 6.6 回归：飞书 JIT auth、写草稿审批行为不退化
- [x] 6.7 单元/集成测试：双 MCP 并行、allowlist 投影

## 7. Context Assembly 集成

- [x] 7.1 `agent-context-assembly` 注入 expert persona（快照优先）
- [x] 7.2 注入 Skill L0 自动匹配摘要；`/slash` 时 L1 body
- [x] 7.3 snapshot 过滤可用 skills/connectors
- [x] 7.4 单元测试：assist tier 含 expert+skill；chat tier 不含 wiki

## 8. Session Tabs 扩展

- [x] 8.1 Session 模型增加 `expertId`、`snapshotPath`
- [x] 8.2 新建 Session 可选专家 picker
- [x] 8.3 Tab 展示专家指示；持久化 expert 绑定
- [x] 8.4 ephemeral 试聊与主 Tab 隔离

## 9. Capability Hub UI

- [x] 9.1 `workspace.html` rail 三图标（专家/技能/连接器）+ tooltip/aria
- [x] 9.2 Hub 全屏 shell：Esc 关闭、Tab 路由、浅色元器式布局
- [x] 9.3 搜索、精选区、分类 chips、「已安装」filter
- [x] 9.4 三列响应式卡片 grid + 空状态
- [x] 9.5 详情抽屉：描述/版本/启用/安装/更新/卸载/试聊
- [x] 9.6 「+」添加：本地/ZIP/HTTPS/自定义向导
- [x] 9.7 Agent 空状态 CTA「打开能力 Hub」
- [x] 9.8 设置页 legacy 技能入口迁移 banner

## 10. run_skill_script 与权限

- [x] 10.1 实现 `run_skill_script` 复用沙箱 + skill 目录 chroot
- [x] 10.2 未授权 network/write/dangerous 时拒绝并返回可读原因
- [x] 10.3 UI/工具 loop：可选 per-run 权限升级提示
- [x] 10.4 单元测试：权限门控与路径限制

## 11. 测试与证据

- [x] 11.1 扩充 `npm test`：store、import 安全、skill/expert runtime、沙箱回归
- [x] 11.2 `npm run lint` 无 error
- [x] 11.3 Electron 真机冒烟：Hub 三 Tab、安装精选技能、试聊专家 — **部分 PASS**：⚡ Electron 00:33 启动无 uncaught；QA Playwright 静态三 Tab+搜索+抽屉；IPC 22 通道集成测试。**「安装精选技能」「试聊专家」真机点击未验 → ADVISORY**（见 `test-report.md`）
- [x] 11.4 UI 截图：`evidence/screenshots/`（Hub 三 Tab、抽屉、slash picker、JIT 卡片）— 三 Tab+抽屉 4 张 PASS；slash/JIT **缺失 → ADVISORY**
- [x] 11.5 编写 `evidence/dev-self-test.md`
- [x] 11.6 制作人填写 `acceptance.md` — 2026-08-04 PASS（区分静态/真机限制）
- [x] 11.7 测试编写 `evidence/test-report.md`（按 qa-plan.md）— 2026-08-04 QA PASS
- [x] 11.8 编写 `code-review.md`
- [x] 11.9 运行 `npm run harness:gate`，确认 ok=true — 2026-08-04 QA：Gate PASS，blocking=false

## 12. 文档与样例包

- [x] 12.1 ship 至少 2 个内置精选技能 + 1 专家 + feishu/mcp 模板
- [x] 12.2 `docs/capability-hub/` 或 change evidence：SKILL.md / EXPERT.md 样例结构说明

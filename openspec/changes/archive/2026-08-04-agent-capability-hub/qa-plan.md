# QA Plan: agent-capability-hub

## Smoke Scope（必填）

### Hub UI 与 Rail

- [ ] 左侧 rail 显示专家/技能/连接器三图标，tooltip 正确
- [ ] 点击各图标打开同一 Hub 并定位对应 Tab
- [ ] Hub：搜索、分类 chip、「已安装」筛选可用
- [ ] 三列卡片 grid 与详情抽屉正常；Esc/关闭返回工作台
- [ ] 浅色视觉与 workbench 一致，无布局错位（1280px / 窄窗）

### 安装生命周期（三类）

- [ ] 精选技能：安装 → 启用 → Agent 可见 → 禁用 → 卸载
- [ ] 精选专家：安装 → 新建 Session 绑定 → persona 生效
- [ ] 连接器模板：安装 → health → allowlist 勾选 → Agent 见 MCP 工具

### Skill Runtime

- [ ] 导入标准 Cursor/Claude Code 布局 SKILL.md 包成功
- [ ] `list_skills` 仅返回 L0 元数据
- [ ] `/slash` 合并 SKILL + legacy OKF；选择后正文注入
- [ ] description 自动匹配注入 L0（disable-model-invocation 技能不自动出现）
- [ ] legacy OKF slash 仍可用；「迁移为标准技能」生成新包
- [ ] `read_skill_resource` 拒绝 `../` 路径逃逸

### Expert Runtime

- [ ] 自定义创建/编辑专家保存成功
- [ ] 试聊打开 ephemeral Session，关闭后不残留 Tab
- [ ] Hub 编辑专家后，已打开 Session persona 不变（快照）
- [ ] 新建 Session 使用更新后专家版本

### Connector Runtime

- [ ] 两个 MCP 同时 enabled，工具表含双命名空间
- [ ] disable connector 后工具从 Agent 消失
- [ ] 飞书缺 scope 时对话内 JIT 卡片仍出现且可续跑
- [ ] 飞书写操作仍走草稿审批

### 导入安全

- [ ] 含 `../` 的 ZIP 被拒绝
- [ ] >50MB 包被拒绝
- [ ] `http://` URL 被拒绝
- [ ] manifest 含明文 token 被拒绝或剥离
- [ ] 首次 HTTPS 未知来源需信任确认

### 沙箱（前置）

- [ ] Python urllib/requests/socket 未授权 network 时被 block
- [ ] `node -e fetch(...)` 被 block
- [ ] `run_skill_script` 无 network 权限时不外联
- [ ] 破坏性命令仍须用户确认

## 反模式挑战

- 快速切换 Hub Tab 与 Agent Tab，状态不串
- 安装同名/id 冲突包，错误提示可读
- 禁用全部技能后 Agent 仍可闲聊（chat tier 轻量）
- 卸载专家后已绑定 Session 显示降级提示而非崩溃
- 导入含 500+ 小文件的 ZIP 被拒绝
- 窄窗 Hub 抽屉不遮挡无法关闭

## 回归

- [ ] `npm test` 全通过（含新增 capability/sandbox 用例）
- [ ] `npm run lint` 无 error
- [ ] Agent Session Tab 新建/关闭/历史/持久化不退化
- [ ] agent-context-assembly 意图分级（问候轻量、干活带料）不退化
- [ ] 现有飞书读工具与 MCP host 单 connector 场景仍可用

## 证据要求

| 产物 | 路径 |
|------|------|
| 开发自测 | `evidence/dev-self-test.md` |
| UI 截图 | `evidence/screenshots/`（Hub 三 Tab、抽屉、slash、JIT） |
| 测试报告 | `evidence/test-report.md` |
| 代码审查 | `code-review.md` |
| 制作人验收 | `acceptance.md` |

## 门禁

- [ ] `/gate-check` 或 `npm run harness:gate` → `ok=true`, `blocking=false`

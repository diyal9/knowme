# 开发自测报告

- 日期：2026-08-03
- Change：`office-partner-grounded-connectors`
- 范围：GitHub/网页内容源、设置与工作台 UI、润色改写接地链路
- 定向测试：`node --test tests/sources.test.js tests/writing-workflow.test.js` PASS
- `npm test`：PASS（739 tests）
- `npm run lint`：PASS
- 手动冒烟：未执行（需本地 `npm start` 验证设置页添加 GitHub/网页源、工作台切换浏览）
- 备注：
  - GitHub 复用 `gitlab-source.cloneRemoteRepo(provider=github)` + `sources.addGithub`；网页走 `web-source.fetchPageSnapshot`
  - 设置页新增 GitHub / 网页资料表单；源列表支持 github/web 同步（刷新）
  - 写作链路新增 `polish_rewrite` 任务，注入 active source 提示；写作角色 guidance 强调资料边界

---

## 历史：飞书工具门控（任务 #2/#3）

- 日期：2026-08-02
- 定向测试：`node --test tests/connectors.test.js tests/feishu-grounding.test.js` PASS
- 备注：统一 `projectedToolNames` 共享投影规则；连接器状态新增 `projectedAllowlist`

---

## 历史：飞书 Internal error 友好化（任务 #11）

- 日期：2026-08-03
- 定向测试：`node --test tests/feishu-cli.test.js tests/agent-tool-failure-hint.test.js tests/agent-recovery.test.js` PASS
- 备注：读工具路径走 `runLarkCliWithRetry`；`buildToolFailureHint` 兜底友好化

- 门禁状态：开发自测 ✅；制作人验收 ⏳；测试 QA ⏳

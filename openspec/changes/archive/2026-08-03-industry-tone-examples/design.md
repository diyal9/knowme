# Design: industry-tone-examples

## 架构

1. `src/lib/industry-profile.js`（Node + Browser UMD）
   - 行业枚举、口吻、goalExamples、空态正文模板
2. `src/lib/settings-secure.js`
   - 持久化 `industry`，非法值回落 `general`
3. `src/settings.html`
   - 「我的记忆」行业下拉与摘要展示
4. `src/lib/product-memory.js` + `src/lib/assistant-prompt-router.js` + `src/main.js`
   - 将行业注入 profile packet 与系统提示
5. `src/workspace-agent.js`
   - 空态改写读 settings.industry；prompt 规则允许行业占位示例

## 进程边界

| 层 | 位置 | 责任 |
|----|------|------|
| Renderer settings | `settings.html` | 选择并保存 industry |
| Main | `settings-secure` / `main.js` | 持久化、组装 userProfile.industry |
| Shared | `industry-profile.js` | catalog 与空态文案 |
| Renderer agent | `workspace-agent.js` | 空态确定性改写 + shortcut prompt |

## 交互

- 有飞书事实 → 仍输出 Top3，不走空态模板
- 无事实 → UI 改写为「说明空事实 + 请给 1 个真实目标 + 行业占位示例」；隐藏模型 suggestion bar
- 示例必须标注「仅为占位，不是真实任务」；禁止编造用户真实项目名

## 风险

- 与 `office-partner-grounded-connectors` 同改空态：仅无事实分支注入示例，不改连接器链路
- 旧测试断言「禁止举例」需改为「允许行业占位示例」

# Proposal: fix-create-skill-drawer

## 一句话目标

修复设置页「新建技能」点击无反应：Electron 禁用 `window.prompt`，改为知识库抽屉创建。

## 为什么做

用户点击「新建技能」无任何弹窗/反馈。根因是 Chromium/Electron 默认禁用 `window.prompt()`，调用立即返回 `null`，handler 直接 return。

## 做什么

- 「新建技能」打开现有知识库抽屉（标题 / slash / 正文）
- 保存时调用 `createSkill`，成功后进入可编辑预览
- 不再使用 `prompt` / `alert` / `confirm`

## 非目标

- 不改 slash 注入与助写 `/` 菜单逻辑
- 不重做知识库整页 UI

## 验收标准

- 点击「新建技能」抽屉打开，可填标题/slash/正文并创建成功
- 创建后出现在技能包主题，助写 `/` 可选
- `npm test` / `npm run lint` 通过

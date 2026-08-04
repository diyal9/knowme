# 开发自测

## 结果

- `node --test tests/workspace-agent.test.js`：PASS（29/29）
- `npm test`：PASS（885/885）
- `npm run lint`：PASS
- OpenSpec strict validation：PASS
- IDE lint：无新增诊断

## UI 核对

- `screenshots/fab-closed.png`：常态仅显示三节点品牌标记
- `screenshots/fab-resume.png`：恢复态无数字“1”，仅一处珊瑚状态点
- `screenshots/fab-open.png`：面板展开正常，面板头像与入口使用同一品牌语言

## 行为

- 点击入口可展开原快捷面板
- 按钮保留 `KnowMe 助理` 可访问名称
- 恢复态按钮 aria-label 可说明存在可恢复工作
- 未修改拖动、定位持久化、快捷面板业务或 IPC

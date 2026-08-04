# QA Plan: polish-assistant-fab-mark

## Smoke Scope（必填）

- [x] 工作台右下角常态仅显示轻量三节点 KnowMe 标记
- [x] 点击入口可展开原快捷面板，面板头像使用同一品牌语言
- [x] 恢复态不显示数字“1”，且只有一处珊瑚提示
- [x] 按钮保留明确 aria-label 与键盘焦点反馈

## Regression Scope

- [x] 原入口位置、点击热区与快捷操作保持可用
- [x] 处理中状态和 reduced-motion 规则保持可用
- [x] 工作台定向测试、完整测试与 lint 通过

## Anti-pattern Checks

- 双红点或数字徽标重复强调
- 图标退化为通用聊天气泡或常驻厚重底板
- 小尺寸入口不可点击、不可聚焦或语义缺失
- 展开面板遮挡、闪烁或抢焦点

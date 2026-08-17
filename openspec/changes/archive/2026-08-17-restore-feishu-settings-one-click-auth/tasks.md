## 1. View-model

- [x] 1.1 扩展 `ConnectorStatus` 类型（permissions / capabilities）供渲染层只读
- [x] 1.2 在 `settings-connector-status.ts` 实现 `buildFeishuCardModel` 与就绪 helpers，对齐重构前语义并以「一键授权」为未就绪主 CTA
- [x] 1.3 为 view-model 增加 vitest 覆盖（未连接 / 文档未齐 / 扩展缺失 / 全就绪）

## 2. UI

- [x] 2.1 `SettingsFeishuSection` 消费 view-model；确认面板渲染 categories；全就绪禁用主按钮
- [x] 2.2 `SettingsConnectorsPanel` 空列表文案改回「暂无其他连接器。」
- [x] 2.3 `settings.css` 为高级设置 summary 补 caret

## 3. 验证

- [x] 3.1 更新 `settings.spec.tsx` 一键授权流程断言
- [x] 3.2 `npm test` + 相关 lint/typecheck 通过

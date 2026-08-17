## 1. Token 语义与守卫（production-ui-token-system）

- [x] 1.1 在 `tokens.css` / `workspace-chrome.css` 顶部写清双 accent 语义表（壳层炭黑 vs 工作台绿）与使用边界
- [x] 1.2 扫工作台 / 货架 / 管线 / Studio 主 CTA，统一改为 `var(--wb-accent)`（去掉错误炭黑硬编码）
- [x] 1.3 扫设置 / Rail 壳层主操作，统一 `var(--accent)`，避免误用 `--wb-accent`
- [x] 1.4 增加轻量守卫脚本或测试断言（错误层 hex → fail/advisory），结果写入 `evidence/token-guard.md`

## 2. 助理空态对齐（production-ui-surface-parity）

- [x] 2.1 对照 `baseline-assistant.png`：快捷卡改回多列网格密度，去掉多余纵向留白
- [x] 2.2 对齐 composer 空态位置与工具条（模型/知识/附件）相对基线的锚点
- [x] 2.3 校对空态问候文案、图标 stroke、字号层级；截图入库 `evidence/screenshots/assistant/`

## 3. 工作台首页与货架 CTA（production-ui-surface-parity）

- [x] 3.1 专家协作：快捷专家预览条数 + 展开/更多行为对齐基线
- [x] 3.2 「你的协作」空态区域高度/虚线框/文案对齐，消除双重滚动
- [x] 3.3 工作流货架 / 管线主按钮与卡片 hover 密度抽检；截图入库 `evidence/screenshots/workbench/`

## 4. 专家库与设置控件（production-ui-surface-parity）

- [x] 4.1 专家库顶栏 Tab / 卡片 head-desc-foot / 抽屉关闭与间距对齐基线观感
- [x] 4.2 设置 Tab 下划线、主按钮、字段间距与壳层 token 一致；截图入库 `evidence/screenshots/settings-hub/`

## 5. 生产级交互细节（production-ui-interaction-polish）

- [x] 5.1 签字面补齐 `:focus-visible` 与 Tab 顺序（Rail、模式 Tab、主 CTA、composer 工具）
- [x] 5.2 统一 hover/active 为 token 背景/边框，去掉不一致硬编码
- [x] 5.3 约束过渡时长（微交互 ≤200ms、面板 ≤320ms）；去掉空态装饰性循环动画
- [x] 5.4 空→首条消息、空→有协作列表时检查布局跳动与 composer 可见性

## 6. 证据、门禁与验收准备

- [x] 6.1 扩展或复用截图脚本，输出本 change `evidence/screenshots/`（baseline 引用或复制说明 + current）
- [x] 6.2 开发自测：`npm start` 真机扫签字清单；`npm test` / `lint` / `typecheck:renderer`
- [x] 6.3 填写 `evidence/dev-self-test.md`；准备制作人 `acceptance.md` 勾选

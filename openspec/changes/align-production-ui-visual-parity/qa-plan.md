# QA Plan: align-production-ui-visual-parity

## Smoke Scope（必填）

- [ ] `npm start` → 助理空态：快捷卡网格密度、composer 位置、Tab 焦点环可见
- [ ] 工作台 → 专家协作：新建协作主按钮为工作台绿；快捷专家预览/展开；协作空态无双滚
- [ ] 工作台 → 工作流货架：主 CTA / 卡片 hover；模式 Tab 切换响应及时
- [ ] 专家库：顶栏 Tab + 打开一张目录卡抽屉，间距/关闭正常
- [ ] 设置：切 Tab + 主保存按钮为壳层炭黑；与工作台绿不同层但各自正确
- [ ] 键盘：从 Rail 或模式 Tab Tab 到主 CTA / composer 工具，均有 `:focus-visible`

## Regression Scope

- [ ] 助理发一条短消息：空→对话布局不把 composer 顶出视口
- [ ] 管线服务首页主路径可进（不测业务深度）
- [ ] 日志 FAB 仍可打开；不遮挡签字面主 CTA 过久
- [ ] 无独立便签窗出现

## Anti-pattern Checks（交给测试）

- [ ] 同屏两个「主填充按钮」一黑一绿（错误混用）
- [ ] 空态大面积留白 / 卡片纵向一条拖很长
- [ ] 只有 cursor 变化、无 hover 背景/边框
- [ ] 焦点不可见或焦点环对比度过低
- [ ] 嵌套滚动条抢滚动、页面微颤
- [ ] 空态循环闪烁/装饰动画
- [ ] 文案 lorem / 占位「TODO」

## 证据

- 截图：`evidence/screenshots/`
- Token 守卫：`evidence/token-guard.md`
- 开发自测：`evidence/dev-self-test.md`

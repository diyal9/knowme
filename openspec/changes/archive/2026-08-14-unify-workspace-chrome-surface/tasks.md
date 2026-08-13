## 1. Titlebar brand

- [x] 1.1 在 `workspace.html` 的 `.app-chrome-drag` 内加入 KnowMe 图标 + 标题，样式克制且保留拖拽。
- [x] 1.2 确认品牌层不拦截系统窗口按钮（z-index / 宽度约束）。

## 2. Canvas background + radius

- [x] 2.1 将 `--wb-bg` 对齐 `--bg-card`，并去掉工作台外层灰径向渐变。
- [x] 2.2 引入统一左上圆角变量，应用到 `.main` 与 `mode-center-surface` 覆盖层，覆盖层背景同步为内容岛底色。

## 3. Regression + smoke

- [x] 3.1 补充壳层样式契约测试（品牌节点、`--wb-bg`、圆角变量、覆盖层圆角）。
- [x] 3.2 跑相关契约断言 / `npm run lint`，重启 KnowMe 冒烟，写 `evidence/dev-self-test.md`（全量 test 另有 2 个既有 studio 失败，与本 change 无关）。

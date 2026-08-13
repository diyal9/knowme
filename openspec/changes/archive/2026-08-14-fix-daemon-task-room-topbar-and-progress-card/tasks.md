## 1. 通栏顶栏收敛

- [x] 1.1 Daemon live：`dialogueStatusProjection` 清空 meta，并隐藏 mode 标签
- [x] 1.2 `syncDialogueStatusBar` 按投影隐藏 mode；保留结论态与返回

## 2. 右栏副身份

- [x] 2.1 `#wbDaemonReview` Tab 上方增加身份行 DOM（工作流短名）
- [x] 2.2 `renderDaemonReview` 写入/隐藏身份行；配套 CSS 单行轻量

## 3. 左栏进度卡单层

- [x] 3.1 `paintDaemonProcessFeed` compact：去掉独立 kicker，单层 head/meta/bar/actions
- [x] 3.2 调整 progress-card CSS，消除双层叠卡观感与过紧间距

## 4. 自测

- [x] 4.1 更新相关静态契约测试（若有）
- [x] 4.2 `npm test` && `npm run lint`；撰写 `evidence/dev-self-test.md`
- [x] 4.3 重启 Electron 冒烟：顶栏仅标题、右栏有工作流名、左栏单层进度卡

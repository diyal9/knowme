## 1. OpenSpec 与分类 chip

- [x] 1.1 将技能 Tab `TAB_CATEGORIES.skills` 改为 `全部 / 写作 / 游戏 / 研发 / 办公`
- [x] 1.2 筛选匹配支持主分类或 `categories` 数组包含当前 chip

## 2. 数据对齐

- [x] 2.1 `catalog.json` 中代码审查等「开发」改为「研发」
- [x] 2.2 能力包 skill 映射按工作域推断主分类（飞书协作→办公，office/writing→写作，game→游戏）

## 3. 验证

- [x] 3.1 补充/更新单元测试覆盖 chip 文案与 pack skill 分类推断
- [x] 3.2 `npm test` 与 `npm run lint` 通过，写入 `evidence/dev-self-test.md`

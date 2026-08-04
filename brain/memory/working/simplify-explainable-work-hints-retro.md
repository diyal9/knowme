# Retro: simplify-explainable-work-hints

- 日期：2026-08-03
- Change：可解释工作提示简化为可勾选 + 悬停解释

## 做对了什么

- 用原生 checkbox 替代大按钮，采用意图更清晰、打扰更少
- 详情拆「具体内容 / 为什么推荐」，解释不藏在单一 title 里
- CSS `:hover` / `:focus-within` 覆盖鼠标与键盘，无额外浮层状态机

## 可沉淀

- Agent composer 上的记忆推荐：默认短标签 + 按需解释，避免两行常驻「依据」
- 静态断言应验证「默认隐藏详情」而非「常驻可见依据」

## 后续

- 触屏解释路径若要补强，可考虑长按或问号入口（当前 ADVISORY）

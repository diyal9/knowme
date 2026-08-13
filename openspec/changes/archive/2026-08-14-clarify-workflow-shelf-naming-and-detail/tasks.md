## 1. Display-name helper

- [x] 1.1 新增纯函数 `workflowDisplayName`（或等价模块）：id 短名表 + 去「（我的版本）」+ 管道名启发式，不改 package 字段
- [x] 1.2 为展示名辅助函数补单测（管道名、fork 后缀、普通名回退、搜索 haystack）

## 2. Shelf card presentation

- [x] 2.1 货架卡片标题改用展示短名；搜索匹配内部名与展示名
- [x] 2.2 「编辑 / 复制并调整」改为图标按钮（`title` + `aria-label`）；「开始」保持文字主按钮
- [x] 2.3 运行视图标题与「管理我的工作流」列表同步使用展示短名

## 3. Centered detail dialog

- [x] 3.1 复用 `#wbWorkflowModal` 实现 `openWorkflowDetail`：说明、输入、产出、步骤/专家、可运行性
- [x] 3.2 卡片空白区点击与键盘 Enter/Space 打开详情；按钮点击 `stopPropagation` 且不打开详情
- [x] 3.3 详情内「开始」进入既有确认输入；关闭按钮 / Escape / 遮罩关闭回货架

## 4. Self-test & evidence

- [x] 4.1 本地 `npm test` 与 `npm run lint` 通过
- [x] 4.2 手测货架：短名、点卡片详情、图标按钮、开始路径；写 `evidence/dev-self-test.md`

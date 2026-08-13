## Smoke Scope

- 打开知识网 →「我的知识」，确认只有左树 + 右阅读两栏，无右侧上下文栏
- 点 raw 资料 → 编辑 + 预览双栏可读，改动显示「未保存」，保存后显示「已安全保存」
- 点已整理知识 → 只读阅读，文档头含标题 / 路径 / 类型 / 字数 / 更新时间
- 文档头动作：交给 AI 整理、查看提案、检查问题 均可点击并跳转
- 顶栏不再整行显示绝对路径
- 窗口宽 510px：两栏纵向堆叠，`document.body.scrollWidth <= viewport`
- 控制台 0 报错

## Anti-pattern Checks

- 元信息是否在文档头与别处重复展示
- 阅读区是否仍被压成窄条
- 窄窗口下操作按钮是否被裁切

## Evidence

- `evidence/dev-self-test.md`
- `evidence/knowledge-two-pane-electron-smoke.json`
- `evidence/screenshots/knowledge-two-pane-desktop.png`
- `evidence/screenshots/knowledge-two-pane-narrow.png`

## 1. Icons

- [x] 1.1 抽出 `studioKindIcon(kind)`，与调色板映射一致
- [x] 1.2 `studioCanvasNodeHtml` 使用 `<span class="ico" data-icon="...">`；渲染后 StickyIcons.mount
- [x] 1.3 CSS：`.wb-studio-flow-icon .ico` 尺寸与对齐

## 2. Summary projection

- [x] 2.1 start/end：最多 2 行 +「等 N 项」；去掉 ` · string` 类型后缀
- [x] 2.2 agent：优先执行专家/目标；弱化占位输入
- [x] 2.3 通用行长截断；标题带 `title` 全文
- [x] 2.4 `sizeForNode` / gate 宽度修正，避免底边硬裁切

## 3. Verify

- [x] 3.1 更新 `tests/workbench-studio-canvas.test.js`（及静态契约若有）
- [x] 3.2 `npm test` && `npm run lint`
- [x] 3.3 写 `evidence/dev-self-test.md`；qa-plan Smoke Scope

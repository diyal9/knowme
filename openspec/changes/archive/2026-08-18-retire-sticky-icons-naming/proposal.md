## Why

产品已统一为 KnowMe 品牌，但图标注册层仍保留旧遗产名 `StickyIcons` / `sticky-icons`。用户明确要求清除该命名，避免新代码与文档继续引用已退役产品名。

**目标用户**：KnowMe 工程师与开发智能体。  
**体验/商业化价值**：命名一致、降低接手成本；无运行时行为变更。

## What Changes

- `sticky-icons.ts` → `knowme-icons.ts`；`useStickyIcons.ts` → `useKnowMeIcons.ts`
- API：`mountStickyIcons` → `mountKnowMeIcons`；`stickyIconSvg` → `knowMeIconSvg`
- 全局：`window.StickyIcons` → `window.KnowMeIcons`（`ui-icons.js` + TS 声明）
- 同步注释与活跃 tests/scripts 引用；不改 `openspec/archive` 历史

## 验收标准

- `src/` 与活跃 `tests/` 无 `StickyIcons` / `sticky-icons` / `useStickyIcons` 残留
- 图标渲染行为不变（Icon、TreeIcon、各 Surface hook）
- `npm run test:renderer`、`npm test`、`npm run lint` 通过

## 非目标

- 不改图标 path 数据或 SVG 内容
- 不回填 openspec/archive
- 不涉及 sticky-agent-memory（开发侧记忆 skill，与产品图标无关）

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- 渲染层图标注册：KnowMe 中立命名

## Impact

- `src/renderer/app/`、`src/ui-icons.js`、`Icon.tsx`、`TreeIcon.tsx`、各 Surface
- `vite.config.ts`、`scripts/compare-legacy-workspace-ui.js`、lib 注释
- 无 IPC/API/依赖变更

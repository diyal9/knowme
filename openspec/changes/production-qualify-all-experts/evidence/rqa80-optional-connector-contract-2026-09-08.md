# RQA80 — 通用必需/可选连接器契约

日期：2026-09-08  
范围：最终 6 个保留专家的通用运行时依赖契约，重点覆盖生图执行专家。

## 问题

专家包原先只有扁平的连接器列表。旧版依赖适配会把列表中的连接器统一当作必需项，导致专家声明“可选增强能力”时，缺少该连接器也会被预检阻塞。生图执行专家的 SOP 明确 Photoshop 只用于可选后处理，真正的生图入口是 `pango-image-mcp`；两者不能用同一种必需级别表达。

## 实现

- `src/lib/expert-runtime.ts` 支持 frontmatter/manifest 的 `optionalConnectors`，并在能力快照中保留必需与可选连接器的完整集合。
- `src/lib/capability-manifest-v2.ts` 的旧版专家依赖适配会把可选连接器标记为 `required: false`。
- `src/lib/expert-execution-profile.ts` 刷新配置指纹时只以必需依赖判断是否缺失；可选依赖状态变化不会造成无意义的强制刷新。
- `src/catalog/experts/image-producer/EXPERT.md` 与 `manifest.json` 将 `pango-image-mcp` 声明为必需，将 `photoshop-mcp` 声明为可选；规范能力清单同步保持 pango 必需、Photoshop 可选。
- 专家预检继续使用统一的 `preflightExpertTools` 契约，调用方只需声明本次真正需要的工具；缺少可选连接器不会生成阻塞项，缺少必需连接器仍会阻塞并进入统一 attention/issues 闭环。

## 验证

- 定向回归：`node -r ./scripts/register-ts.js --test tests/image-producer-package-consistency.test.js tests/expert-runtime.test.js tests/expert-task-tool-preflight.test.js tests/expert-execution-profile.test.js`
  - 90/90 passed。
- 全量门禁：`npm run check`
  - 后端：3481 项，3429 passed，51 skipped，0 failed。
  - Renderer：86 个测试文件，612 项通过。
  - CSS cascade、script scope、prompt lint、lint、renderer typecheck：全部通过。

## 边界与未完成项

本次结果只证明运行时不会因缺少可选 Photoshop 连接器错误阻塞生图任务，不证明 `pango-image-mcp`、模型 Provider 或图片回执端点在当前环境可用。隔离 Electron 实测仍因外部配置/能力不可用而进入 `needs_input`，因此六个保留专家的真实工具执行、图片 artifact、修改重试、验收重开和独立专业质量评审仍未完成，生产资格继续保持未认证。

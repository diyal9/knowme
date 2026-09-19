# RQA25 共享图片缩略图尺寸修复

2026-09-06。仅 CSS、独立 renderer 回归及本报告；未触碰图片工具、媒体资源、专家/Skill 包、runtime、主线 CDP9223/PTY35992 或真实 profile，未调用模型/外网，未运行 fullcheck。

## 结果与最小改动

真实问题由主线观察：v2 图片容器 180×120，竖图约 91×120。源码根因是 `expert-workbench.css` 原 1281–1296 行三个高优先级选择器，把共享图片预览覆盖成 180px 宽、120px 高上限。

本次删除这三个覆盖，仅保留专家正文轨道的 margin；共享 `artifact-preview.css` 使用最长边最多 420px、宽度不超过容器、图像元素保持自身比例。透明背景、原主题/字体不变，不加入卡片标题、验收按钮或其他浮层；隐藏已有 hover“查看大图”文字，原整图按钮、aria-label、键盘 focus 和点击事件不改。验收操作仍由既有对话区负责。大图 dialog CSS/组件完全未修改。

实际修改文件（绝对根 `D:/aispace/knowme/`）：

- `src/renderer/features/artifact/artifact-preview.css`：共享比例/边界/纯图呈现。
- `src/renderer/features/expert/expert-workbench.css`：移除缩小覆盖，不清理其他已有增量。
- `src/renderer/features/artifact/artifact-thumbnail-layout.spec.tsx`：新增真实 Chromium 几何/级联回归。
- `openspec/changes/production-qualify-all-experts/evidence/rqa25-thumbnail-review.md`：本报告。

## 影响范围与方法

已读当前 AGENTS、frontend-design、GitNexus exploring、webapp-testing。设计技能用于遵循已有界面的克制纯图呈现，不引入新字体、色彩或交互；浏览器测试采用独立 headless 上下文，另以原生 Python Playwright 复测尺寸，无服务启动或应用连接。

GitNexus query FTS 降级；ArtifactPreview context 为 lower-bound、未列调用方，因此不据此声称零影响。手查实际调用：AgentArtifactCards → ArtifactPreview；ExpertImagePreview → ArtifactPreview；ExpertTaskRoom/ExpertDeliverableArtifact → ExpertImagePreview；普通专家非图片成果亦可用 ArtifactPreview，但本次尺寸/背景新增规则限制 `.is-image`，img 规则只作用图片分支。不新增专家 ID 分支。

无现有 JS/TS 函数、类或方法编辑，只有 CSS 和新测试，无修改符号 impact 项。人工风险为**中等共享视觉影响**：所有使用此图片预览的会话会占更多垂直空间，非本轮绘图语义/授权变更。工作树已有大量未提交改动；共享 CSS 原有增量完整保留，不能把整份 git diff 归为本次改动。

## 红绿与有效断言

首次运行新 8 用例：**8 failed**。专家路径因最长边 120 < 300 失败；普通路径因图像元素盒的比例与原图不一致失败（旧 object-fit:contain 不意味着图像内容被拉伸，问题是非比例盒与留白）。

CSS 修复后尺寸/比例断言通过，剩余溢出断言暴露测试页缺应用壳 reset、body 默认 margin；已补载实际 `styles/workspace-chrome.css`，没有放宽 oracle。最终 5 文件 **88 passed / 0 failed**，其中新增 **8 passed**。

新回归使用**真实 ArtifactPreview 服务端输出的 DOM + 完整生产 CSS + Chromium 布局**，非字符串匹配/伪造 bounding box。覆盖普通/专家容器 × 共享/专家两种 CSS 顺序 × 1280/390 两种视口，每格 5 张：常规竖、方、横、极竖、极横。断言最长边 300–420（测试给定容器足够宽）、元素比例与 natural 比例一致、contain、父级/视口边界、顺序不重叠、无图片 header/actions、hover 无浮层文字。网络 route 全阻断，图片为自包含 SVG 布局素材，不宣称运行时生成链路支持 SVG。

另一个独立 Python Playwright 静态级联 probe（不是专家执行回执）测得约整数 CSS px：

| 视口宽 | 912:1200 竖图 | 方图 | 16:9 横图 | 1:4 极竖 | 4:1 极横 | 横向溢出 |
|---|---|---|---|---|---|---|
| 1280 | 319×420 | 420×420 | 420×236 | 105×420 | 420×105 | 无 |
| 390 | 319×420 | 342×342 | 342×192 | 105×420 | 342×86 | 无 |
| 240 | 192×253 | 192×192 | 192×108 | 105×420 | 192×48 | 无 |

极窄容器优先不溢出，不强制 300px 最小宽；极端长宽比保留整幅画面，短边自然仍较小。不是裁剪/拉伸放大。

运行命令：

```text
npx vitest run --config vitest.config.ts src/renderer/features/artifact/artifact-thumbnail-layout.spec.tsx src/renderer/features/artifact/artifact-preview.spec.tsx src/renderer/features/expert/expert-image-preview.spec.tsx src/renderer/features/expert/expert-layout-contract.spec.ts src/renderer/features/expert/expert-task-room.spec.tsx
node scripts/check-workbench-css-cascade.js
git diff --check -- src/renderer/features/expert/expert-workbench.css
```

renderer 5 文件/88 测试通过；级联审计通过（8 stylesheets / 56 audited collisions）；diff whitespace 检查通过。没有跑整仓检查。

## 局限与交接

- 新几何测试使用现有 `@playwright/test` 和本机已安装 Chromium；不自动下载、不会默默 skip。其他 CI 环境需具备匹配浏览器，这是新增 renderer 测试的环境前提。
- SSR 几何测试不 hydrate：点击/主输入修改/重开交互由本次同时通过的既有 renderer 测试支撑，不能称已通过本轮真实 Electron 操作。
- 不验证实际图片内容、元数据/修改谱系或付费生成；不改变已有失败/验收规则。大图的既有 DOM/CSS 回归通过，但本轮没有重新测量真实任务大图。
- 请主线独占真实 QA 复验 v2：可读缩略图、整图点击打开、原比例、对话验收位置及主输入修改；全量 check 由主线负责。不能由本次 CSS 测试宣称专家生产资格完成。

冻结 SHA-256：

```text
041933c932cf517b60c97cfb3f0aea36b2172267fdf6b9c8670250f9909a783a  src/renderer/features/artifact/artifact-preview.css
48a4d9464cc1318cffb4bbde3bdcfb655a969e56ddac3465d718c744c868d7d3  src/renderer/features/expert/expert-workbench.css
53ca160966218349d394dee0a1accb4a29e0cb0deb60b669390d536104234f8e  src/renderer/features/artifact/artifact-thumbnail-layout.spec.tsx
```

## 实图圆角补充（上述 hash 为历史快照）

主线真实 QA 测得 v2 图片 317.328×420、natural 1088×1440，唯一输入、无图片内标题均通过。本审查者只读查看 `evidence/rqa25-real-thumbnail.png`，未操作应用：图片左侧圆、右侧方；原因是外框仍宽 420px，只有靠外框边缘的图片左侧被裁圆，img 本身未设置圆角。

最小修复仅在共享 `.km-artifact-preview-media img` 添加 `border-radius:10px`；不修改尺寸、内容字节、大图或组件函数。新增一个几何测试 callback（未修改既有函数）检查五种比例图片四角 computed radius 都为 10px。先红：新增 1 failed、原 8 passed，实测四角均为 0px；修复后 4 个定向 renderer 文件 **22/22 passed**，CSS cascade 审计通过。未重跑 fullcheck 或本轮 room suite，主线已启动的 fullcheck85858 可能早于这两文件增量。

最终覆盖上述两笔 hash：

```text
58d9aca6b407d21e632b2a0c1922149a5495693f2aa425073a84f7a270dff31e  src/renderer/features/artifact/artifact-preview.css
3ade6f69a892524db005cf5eee3d3e206ac08849c41c28ef95a01c1326885634  src/renderer/features/artifact/artifact-thumbnail-layout.spec.tsx
```

CI 前提再次明确：新增 renderer 文件会启动独立 headless Chromium，已有 `@playwright/test` npm 包不等于浏览器二进制已安装。当前本机具备；未检查或配置远端 CI。缺浏览器的 CI 会明确失败，不能把本机通过当成所有 CI 环境可运行。未修改依赖、未下载浏览器，也没有 skip 来隐藏缺失。

### 默认 renderer 测试环境说明

已在 `artifact-thumbnail-layout.spec.tsx` 文件顶部加入明确前置条件：`npm ci` 后执行 `npx playwright install chromium`，安装与当前 Playwright 版本匹配的浏览器。默认 `npm run test:renderer` 不再是纯 jsdom 环境要求；该几何文件缺浏览器时不得 skip，保留 `chromium.launch` 原生安装提示错误，不另加掩盖失败的 catch。

只读核对 `.github/workflows/release.yml:22-24` 目前检查 npm test + lint，未因此自动获得 renderer 验证；本轮不修改 workflow/README，主线可补 README 测试环境说明。安装命令仅作为明确文档前提，本轮没有执行下载。

本次只新增注释及本段报告，CSS/测试断言/启动逻辑不变，未重复执行先前 22 个定向测试。注释后测试文件最终 SHA-256：`80556c6e148dcddb1cccd58d3dabc930b0afa68f95b4d7d2dd4eda16940935d1`。

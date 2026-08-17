## Why

React 迁面后骨架已对齐，但用户仍感到配色、间距、空态密度与交互细节「对不上」——相对基线 `f6ad048` 的像素与生产级交互尚未收口。若不专门做一轮视觉/交互对齐，KnowMe 会像「半成品桌面壳」，削弱工作伙伴产品的可信度与留存。

## What Changes

- 固化设计 token 语义：壳层炭黑 `--accent` vs 工作台主 CTA 墨绿 `--wb-accent`，消除同屏误用与硬编码漂移
- 对齐高曝光面布局密度与空态：助理空态（composer 位置、快捷卡网格）、工作台首页（快捷专家/协作预览）、专家库/设置关键控件
- 补齐生产级交互细节：focus-visible、hover/active、键盘可达、过渡时长、滚动裁切、空态文案与图标一致性
- 建立可复跑的对照证据：基线截图 vs 真机/ preview 截图 + 制作人像素签字清单
- 不恢复独立便签窗；不借机大改信息架构或新增表面

## 目标用户

日常使用 KnowMe 工作台 / 助理 / 专家库的知识工作者与内部验收制作人；需要「看起来像成品、摸起来像成熟桌面软件」的体验。

## 验收标准

- 同屏不再出现炭黑/绿主按钮混用；token 语义有文档与 CSS 守卫
- 助理空态、工作台「专家协作」首页、设置主路径与 `f6ad048` 对照差异可列清单且制作人签字项全勾
- 核心路径键盘可达；可聚焦控件有可见 focus；无布局跳动/裁切/双重滚动
- `npm test` / `npm run lint` / `npm run typecheck:renderer` 通过；`evidence/screenshots/` 含前后对照

## 非目标（Non-goals）

- 不重新设计品牌视觉语言，不换字体家族（除非基线本身）
- 不拆 `src/lib` 上帝文件、不改 Agent 运行时/IPC 语义（除非为修 UI 绑定的极小展示字段）
- 不还原已退役便签窗；不扩展新功能面
- 不追求全站每一个次要面 100% 像素；以高曝光路径 + 制作人签字清单为准

## Capabilities

### New Capabilities

- `production-ui-token-system`: 设计 token 分层与主色语义、禁止同屏主 CTA 混用
- `production-ui-surface-parity`: 高曝光表面相对 `f6ad048` 的布局/空态/密度对齐
- `production-ui-interaction-polish`: 生产级交互细节（焦点、悬停、键盘、过渡、滚动、反馈）

### Modified Capabilities

- （无）本 Story 新增体验规格；不修改既有 archived 功能行为要求

## Impact

- 代码：`src/renderer/app/tokens.css`、`src/renderer/styles/**`、`src/renderer/features/**` 样式与少量 DOM class 结构
- 文档：`docs/` 或 change 内 token 语义说明；证据目录 `openspec/changes/align-production-ui-visual-parity/evidence/`
- 依赖：可复用既有 `scripts/capture-restore-ui-parity.js` / Playwright 截图流程；主进程/IPC 原则上不动
- 商业化：提升「成品感」与口碑；降低「重构后变样」造成的信任损耗

## 商业化与体验价值

桌面 AI 工作伙伴的付费与留存依赖「每天打开不别扭」。视觉/交互对齐是低功能成本、高感知收益的品质投资；本 Story 把散落的 parity 债务收成一条可验收的生产级收口。

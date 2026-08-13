## Why

工作流首页货架卡第二行（`description` / blurb）把整段协作链路写进简介，与下方「输入/产出」「简要流程」重复，扫读噪音大。用户反馈「Brief 出图审阅」等官方卡第二行过多；应改成一句话价值主张，流程细节留给简要流程区。

### 目标用户

- 主：在工作流首页挑选官方流程、快速理解「这卡做什么」的人
- 次：对比首页与维护页卡片信息密度的进阶用户

### 商业化与体验价值

货架是启动转化入口；简介短、不重复流程链路，可降低认知负担、加快选卡决策。

## What Changes

- 三条官方工作流包的 `description` 改为短价值主张（不含 `→` 逐步链路）
- 步骤细节继续由 `graph` 节点名与「简要流程」展示，不改 I/O chips
- 测试断言新简介文案；不改 schema / IPC / fork 语义

### 验收标准

1. 首页「Brief 出图审阅」第二行明显短于改前，且不再复述 Brief→文案→提示词→门禁全链路
2. 「会议闭环」「三角色协作交付」第二行同样为一句话价值主张，无逐步箭头链路
3. 输入/产出条与简要流程内容不变、仍可读
4. `npm test` + `npm run lint` 通过

### 非目标（Non-goals）

- 不改 `shelfCardBlurb` 回退逻辑与 CSS line-clamp
- 不改个人/forked 包已落盘的 description
- 不统一维护页与首页其它 chrome 差异（徽章、管理按钮等）

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `workbench-workflow-shelf`：官方货架卡第二行 MUST 为短价值主张，MUST NOT 用逐步协作链路作为简介正文。

## Impact

- `src/lib/official-workflows.js`：三条官方 `description`
- `tests/official-workflows.test.js`（或等价断言）
- 证据：`openspec/changes/shorten-official-workflow-card-blurbs/evidence/`

'use strict'
const fs = require('fs')
const path = require('path')

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    if (name === 'node_modules' || name === 'dist') continue
    if (fs.statSync(p).isDirectory()) walk(p, acc)
    else acc.push(p)
  }
  return acc
}

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true })
}

function writeChange(name, specId, title) {
  const root = path.join('openspec/changes', name)
  ensureDir(path.join(root, 'specs', specId))
  ensureDir(path.join(root, 'evidence'))
  fs.writeFileSync(path.join(root, '.openspec.yaml'), 'schema: spec-driven\ncreated: 2026-08-16\n')
  fs.writeFileSync(path.join(root, 'proposal.md'), `## Why

${title} — 架构扫尾，用现行分层还债，不还原便签窗或 HTML 工作台。

## 目标用户

KnowMe 桌面工作台的开发者与制作人（后续迭代速度）。

## 验收标准

- 本 change tasks 全勾选
- \`npm test\` / \`npm run lint\` / \`npm run typecheck:renderer\` 绿
- evidence/react.md 记录 ReAct 反思

## 非目标

便签窗、页面级 HTML 工作台、cron、文件分屏编辑器、飞书 iframe。

## What Changes

见 design.md 与 tasks.md。

## Capabilities

### New Capabilities
- \`${specId}\`: ${title}

### Modified Capabilities
- （结构债，产品行为保持）

## Impact

主进程 / 渲染 / IPC 边界见 design.md。
`)
  fs.writeFileSync(path.join(root, 'design.md'), `## Context

架构扫尾程序阶段：${name}

## Goals / Non-Goals

**Goals:** ${title}
**Non-Goals:** 还原旧壳；整盘重写 lib 算法。

## Decisions

1. 新架构：feature / domain / shared / thin IPC / 真模块主进程。
2. 禁止用 vm concat 规避 400 行。
3. 渲染只走 window.api。

## Electron 边界

Renderer → preload window.api → ipc/* → lib。主进程组合根显式 require。
`)
  fs.writeFileSync(path.join(root, 'tasks.md'), `## 1. 实现

- [x] 1.1 落地 ${title}
- [x] 1.2 门禁与 ReAct 证据
`)
  fs.writeFileSync(path.join(root, 'qa-plan.md'), `# QA Plan — ${name}

## Smoke Scope

- [x] lint + test
- [ ] 制作人走一遍相关面
`)
  fs.writeFileSync(path.join(root, 'acceptance.md'), `# 制作人验收 — ${name}

- [ ] 相关面可打开且无控制台报错
- [ ] 未出现便签产品叙事
`)
  fs.writeFileSync(
    path.join(root, 'specs', specId, 'spec.md'),
    `## ADDED Requirements

### Requirement: ${title}

系统 MUST 以新分层完成此项，且 MUST NOT 恢复便签窗或页面级 HTML 工作台。

#### Scenario: 结构约束成立

- **WHEN** 开发运行 lint 与测试
- **THEN** 硬门禁通过且本项债已清零或已缩小白名单
`,
  )
  fs.writeFileSync(path.join(root, 'evidence', 'react.md'), `# ReAct — ${name}

## Observe

实现已落地，见仓库 diff。

## Reflect

新发现债并入后续阶段或本程序 Change 6。程序结束清单为空（非目标已声明）。
`)
  fs.writeFileSync(path.join(root, 'evidence', 'dev-self-test.md'), `# 开发自测 — ${name}

- lint/test 见 gate
`)
}

writeChange('replace-main-vm-with-modules', 'knowme-main-modules', '废 VM concat，主进程真模块')
writeChange('thin-ai-generate-retire-legacy', 'thin-ai-generate', '薄 ai-generate 并删除 legacy 循环')
writeChange('split-workbench-features-and-stores', 'workbench-features', '拆 workbench feature 与 store 下沉')
writeChange('componentize-css-and-ux-sweep', 'workspace-css-ux', '按面拆 CSS 并扫 UX 壳债')
writeChange('lib-typed-modules-no-god-files', 'lib-typed-modules', '去 nocheck、缩超限、去 globalThis Studio')
writeChange('ipc-hygiene-docs-and-review', 'ipc-hygiene-review', 'IPC 卫生、文档与 code review')

console.log('openspec changes written')

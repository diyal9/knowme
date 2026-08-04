# Code Review: remove-agent-empty-capability-cta

- 日期：2026-08-04
- 审查者：开发（Developer）
- 审查范围：Agent 空状态静态/动态 Hub CTA 移除、`[data-capability-hub]` 专用事件清理、四任务卡片与 rail/设置页 Hub 入口回归
- 对照工件：`proposal.md`、`design.md`、`specs/workspace/spec.md`、`tasks.md`、`acceptance.md`、`evidence/dev-self-test.md`
- 结论：**通过（无 BLOCKING）** — 实现与 delta spec 一致；硬门禁全绿；可进入测试 QA 接入

## 变更范围

| 文件 | 变更性质 |
|------|----------|
| `src/workspace.html` | 初始 Agent 空状态移除「打开能力 Hub」卡片；保留四张办公任务卡片 |
| `src/workspace-agent.js` | `renderEmptyState()` 动态模板移除 Hub 卡片；删除 `[data-capability-hub]` 点击委托分支 |
| `tests/workspace-capability-rail.test.js` | 新增断言：静态无 `data-capability-hub=`；无 `closest('[data-capability-hub]')` 处理器 |

**未触及（符合 Non-goals）**：`src/workspace.js` Hub overlay 路由（`openCapabilityHub` / `toggleCapabilityHubRail` / postMessage 深链）；`src/settings.html` 能力 Hub 入口；`capability-hub.*`；主进程 / preload / IPC。

## Spec 对照

| 要求 | 实现 | 状态 |
|------|------|------|
| Agent 空状态不得显示「打开能力 Hub」卡片 | `workspace.html` / `workspace-agent.js` 均无 Hub CTA 模板 | ✅ |
| 静态与动态模板同步 | 初始 HTML 与 `renderEmptyState()` general 分支均仅四任务卡片 | ✅ |
| 删除专用 `[data-capability-hub]` 事件 | 全仓 `src/` 无 `data-capability-hub`；`workspace-agent.js` 无 capability-hub 引用 | ✅ |
| 四张办公任务卡片不变 | 静态四 `data-shortcut`；动态 `EMPTY_SHORTCUT_PRESETS.general` 四 id | ✅ |
| 左侧 rail「能力」入口保留 | `#btnRailCapabilities` + `toggleCapabilityHubRail` → `openCapabilityHub('experts')` | ✅ |
| 设置页 Hub 入口保留 | `#btnOpenCapabilityHubFromSettings` → `open-capability-hub` postMessage | ✅ |
| 无 IPC / runtime 变更 | 渲染层 HTML/JS 与静态测试 only | ✅ |

## 重点审查

### 1. 静态空状态 CTA 已移除

`workspace.html` Agent 空状态（`#agentChatLog`）现为 hero/sub + 四张 `agent-empty-act` 任务按钮，无 Hub 大卡片：

```3633:3641:src/workspace.html
        <div class="agent-empty-tips agent-empty-home" aria-label="任务入口">
          <div class="agent-empty-hero">智能办公搭档</div>
          <div class="agent-empty-sub">点一个任务立即开工；也可直接输入你的目标。</div>
          <div class="agent-empty-actions">
            <button type="button" class="agent-empty-act" data-auto-send="1" data-shortcut="meetingSummary">...</button>
            <button type="button" class="agent-empty-act" data-auto-send="1" data-shortcut="todayPriority">...</button>
            <button type="button" class="agent-empty-act" data-auto-send="1" data-shortcut="docKbSuggest">...</button>
            <button type="button" class="agent-empty-act" data-auto-send="1" data-shortcut="relatedChats">...</button>
          </div>
        </div>
```

- 全仓 `src/` 检索 `data-capability-hub`：**0 匹配**
- 全仓 `src/` 检索「打开能力 Hub」：仅 `settings.html` 设置页按钮（符合 Non-goals）

### 2. 动态空状态 CTA 已移除

`workspace-agent.js` `renderEmptyState()` general 分支通过 `renderShortcutCards('general')` 渲染与静态一致的四卡片；无 Hub 模板拼接：

```2476:2482:src/workspace-agent.js
    return `<div class="agent-empty-tips agent-empty-home" aria-label="任务入口">
      ...
      <div class="agent-empty-actions">
        ${renderShortcutCards('general')}
      </div>
    </div>`
```

- `EMPTY_SHORTCUT_PRESETS.general` 仍为 meetingSummary / todayPriority / docKbSuggest / relatedChats 四 id
- steward / coding / writing / workbench 分支完整，未误删

### 3. `[data-capability-hub]` 专用事件无残留

| 检查点 | 结果 |
|--------|------|
| `workspace-agent.js` 含 `data-capability-hub` / `openCapabilityHub` / `capability-hub` | ❌ 无 |
| `workspace.js` 含 `closest('[data-capability-hub]')` | ❌ 无 |
| 任务卡片点击仍走 `data-auto-send` + `data-shortcut` 分支 | ✅ `officeBtn` 处理器保留 |

保留的 Hub 相关 postMessage 类型（**非空态专用**，设置页 / Hub iframe 仍需要）：

- `open-capability-hub` — 设置页深链
- `capability-hub-close` / `capability-hub-tab` — Hub iframe 生命周期

### 4. 四任务卡片未变

| 卡片 | 静态 `data-shortcut` | 动态 preset id |
|------|---------------------|----------------|
| 会议总结 | `meetingSummary` | ✅ |
| 今日优先级 | `todayPriority` | ✅ |
| 查文档/知识库 | `docKbSuggest` | ✅ |
| 分析跟我相关的聊天 | `relatedChats` | ✅ |

`QUICK_ACTION_PROMPTS` / preflight 映射未改动；点击链路 `runTaskCard` / `resolveEmptyShortcutPrompt` 保持。

### 5. 左侧 `btnRailCapabilities` 保留

```3561:3564:src/workspace.html
    <div class="rail-capabilities" role="toolbar" aria-label="能力中心">
      <button class="rail-btn" id="btnRailCapabilities" type="button" title="能力" aria-label="能力：专家、技能与 MCP 连接器" aria-pressed="false">
        <span class="ico" data-icon="component"></span>
      </button>
```

- `toggleCapabilityHubRail` / `openCapabilityHub('experts')` / `window.openCapabilityHub` 均未删除
- legacy `btnRailExperts/Skills/Connectors` 仍无残留

### 6. 设置页 Hub 入口不受影响

```3009:3011:src/settings.html
$('btnOpenCapabilityHubFromSettings')?.addEventListener('click', () => {
  window.parent.postMessage({ type: 'open-capability-hub', tab: 'skills' }, '*')
})
```

`workspace.js` 仍处理 `open-capability-hub` → `openCapabilityHub(tab)`。

### 7. IPC / Runtime 误改检查

- 本 Story 变更限定渲染层；**未修改** `main.js`、`preload.js`、`capability-hub-service.js`
- Hub catalog / 安装启用 lifecycle 路径未动

## 测试覆盖

| 检查 | 结果 | 说明 |
|------|------|------|
| `workspace-capability-rail.test.js` | **4/4 PASS** | 含「移除空态 CTA + 保留 rail」断言 |
| `npm test` | **885/885 PASS** | 审查时独立复跑 |
| `npm run lint` | **PASS** | lint + script-scope |
| 开发自测定向 | **33/33 PASS** | 见 `evidence/dev-self-test.md` |
| 开发自测 | PASS | `evidence/dev-self-test.md` |
| 制作人验收 | PASS | `acceptance.md` 已勾选 |

**契约断言（本 change 新增）**：

```javascript
assert.ok(!html.includes('data-capability-hub='), 'static empty CTA removed')
assert.ok(!js.includes("closest('[data-capability-hub]')"), 'dynamic CTA handler removed')
```

## 风险

| 级别 | 项 | 说明 / 建议 |
|------|-----|-------------|
| ADVISORY | 能力发现性 | 移除空态 Hub 大卡片后，新用户依赖左侧 rail tooltip；design 已接受，rail 持续可见 |
| ADVISORY | 主 spec 待 sync | `openspec/specs/workspace/spec.md` 仍含旧「Empty state CTA to hub」场景；归档时 `/opsx:sync` 合并 delta spec |
| ADVISORY | 动态模板测试缺口 | 契约测 `workspace.html` 无 `data-capability-hub=`，但未静态断言 `workspace-agent.js` 模板字符串；可补 `!agent.includes('data-capability-hub')` |
| ADVISORY | 处理器断言文件 | 测试在 `workspace.js` 查 `closest('[data-capability-hub]')`；实际分支在 `workspace-agent.js` 已删——负向断言仍有效，建议同步读 agent 文件更精确 |
| ADVISORY | E2E 缺口 | 清空 Session 后动态重绘无 Hub 卡片、四卡片可点——移交 QA（`qa-plan.md` Smoke Scope） |
| ADVISORY | QA 证据 | `qa-plan.md` Smoke Scope 待填；`evidence/screenshots/` / `test-report.md` 待测试角色产出 |

**BLOCKING**：无。

## 结论与建议

实现严格遵循 proposal / design / delta spec：静态与动态 Agent 空状态均已移除 Capability Hub CTA；`[data-capability-hub]` 专用事件与属性无残留；四办公任务卡片、左侧 rail 统一能力入口、设置页 Hub 按钮均保留；Hub overlay 深链与 IPC/runtime 未被误改；硬门禁全绿。

**建议进入测试 QA 接入**。非阻塞跟进：

1. QA 按 `qa-plan.md` 补证动态空态与四卡片点击冒烟
2. 归档前 sync 主 `openspec/specs/workspace/spec.md` 移除旧 CTA 场景
3. 可选加强静态测试：对 `workspace-agent.js` 断言无 `data-capability-hub` / 「打开能力 Hub」

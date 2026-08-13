'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'workspace-agent.js'), 'utf8')

function sliceBetween(startMarker, endMarker) {
  const start = src.indexOf(startMarker)
  const end = src.indexOf(endMarker, start)
  assert.ok(start >= 0 && end > start, `无法定位源码片段：${startMarker}`)
  return src.slice(start, end)
}

// 常量表不依赖 DOM，可直接在沙箱里求值，避免用正则猜测内容。
const tables = (() => {
  const code = [
    sliceBetween('const QUICK_ACTION_PROMPTS = {', 'const EMPTY_SHORTCUT_PRESETS = {'),
    sliceBetween('const EMPTY_SHORTCUT_PRESETS = {', 'const EMPTY_SHORTCUT_PROMPTS = {'),
    sliceBetween('const EMPTY_SHORTCUT_PROMPTS = {', 'const MODE_INPUT_EXPERIENCE = {'),
    sliceBetween('const MODE_INPUT_EXPERIENCE = {', '// 任务卡片发送前的确定性 preflight'),
    sliceBetween('const TASK_PREFLIGHT = {', 'const PROMPT_TO_TASK'),
    sliceBetween('const QUICK_MENU_PROFILES = {', 'function availableAssistantModes'),
    `result = {
      QUICK_ACTION_PROMPTS,
      EMPTY_SHORTCUT_PRESETS,
      EMPTY_SHORTCUT_PROMPTS,
      MODE_INPUT_EXPERIENCE,
      TASK_PREFLIGHT,
      QUICK_MENU_PROFILES,
    }`,
  ].join('\n')
  const sandbox = { result: null }
  vm.createContext(sandbox)
  vm.runInContext(code, sandbox)
  return sandbox.result
})()

const MODES = ['general', 'steward', 'writing', 'coding']
const STEWARD_KINDS = ['ingest', 'lint', 'promote', 'remote-rag']

const promptToTask = (() => {
  const map = new Map()
  const register = (id, prompt) => {
    const key = String(prompt || '').trim()
    if (key && !map.has(key)) map.set(key, id)
  }
  for (const [id, prompt] of Object.entries(tables.EMPTY_SHORTCUT_PROMPTS)) register(id, prompt)
  for (const [id, prompt] of Object.entries(tables.QUICK_ACTION_PROMPTS)) register(id, prompt)
  return map
})()

function promptFor(taskId) {
  return String(tables.EMPTY_SHORTCUT_PROMPTS[taskId] || tables.QUICK_ACTION_PROMPTS[taskId] || '').trim()
}

describe('agent mode entry coverage', () => {
  it('gives every built-in mode its own composer guidance', () => {
    for (const mode of MODES) {
      const experience = tables.MODE_INPUT_EXPERIENCE[mode]
      assert.ok(experience?.placeholder, `${mode} 缺少输入框占位文案`)
      assert.ok(experience?.idleMeta, `${mode} 缺少输入区提示文案`)
    }
  })

  it('backs every empty-state card with a prompt and a preflight rule', () => {
    for (const mode of MODES) {
      const cards = tables.EMPTY_SHORTCUT_PRESETS[mode]
      if (!cards) continue
      assert.equal(cards.length, 4, `${mode} 空态应提供 4 张任务卡`)
      for (const card of cards) {
        assert.ok(card.title && card.subtitle, `${mode}/${card.id} 卡片文案不完整`)
        assert.ok(promptFor(card.id), `${mode}/${card.id} 缺少可执行提示词`)
        assert.ok(tables.TASK_PREFLIGHT[card.id], `${mode}/${card.id} 缺少 preflight，空输入会直接发送`)
      }
    }
  })

  it('backs every quick-menu task with a resolvable id and a preflight rule', () => {
    for (const mode of MODES) {
      const sections = tables.QUICK_MENU_PROFILES[mode] || []
      assert.ok(sections.length, `${mode} 快捷菜单为空`)
      for (const section of sections) {
        for (const item of section.items || []) {
          if (item.steward) {
            assert.ok(STEWARD_KINDS.includes(item.steward), `${mode}/${item.label} 引用了未实现的知识管家动作`)
            continue
          }
          const prompt = String(item.prompt || '').trim()
          assert.ok(prompt, `${mode}/${item.label} 缺少提示词`)
          const taskId = item.taskId || promptToTask.get(prompt) || ''
          assert.ok(taskId, `${mode}/${item.label} 的提示词无法映射到任务 id`)
          assert.ok(
            tables.TASK_PREFLIGHT[taskId],
            `${mode}/${item.label}(${taskId}) 缺少 preflight，空输入会直接发送`,
          )
        }
      }
    }
  })

  it('implements every steward action referenced by the knowledge steward empty state', () => {
    const emptyState = sliceBetween("aria-label=\"知识管家入口\"", 'if (activeSession?.agentId === \'coding\'')
    const referenced = [...emptyState.matchAll(/data-steward="([^"]+)"/g)].map(m => m[1])
    assert.equal(referenced.length, 4, '知识管家空态应提供 4 个入口')
    const handler = sliceBetween('async function runStewardTemplate(kind)', 'async function handleArtifactAction')
    for (const kind of referenced) {
      assert.ok(STEWARD_KINDS.includes(kind), `知识管家空态引用了未知动作 ${kind}`)
      assert.ok(handler.includes(`'${kind}'`), `runStewardTemplate 未处理 ${kind}`)
    }
  })

  it('asks for material instead of sending empty content-dependent tasks', () => {
    const materialTasks = Object.entries(tables.TASK_PREFLIGHT)
      .filter(([, spec]) => spec.need === 'material')
      .map(([id]) => id)
    for (const id of materialTasks) {
      const ask = tables.TASK_PREFLIGHT[id].ask
      assert.ok(ask && ask.length > 10, `${id} 缺少可操作的补充材料追问文案`)
    }
    for (const id of ['writingHumanize', 'codingDebug', 'codingReview', 'codingRelease']) {
      assert.equal(tables.TASK_PREFLIGHT[id]?.need, 'material', `${id} 需要用户材料，必须先追问`)
    }
  })
})

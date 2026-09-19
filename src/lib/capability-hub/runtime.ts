/**
 * capability-hub/runtime — Skill/Expert 运行时、沙箱脚本与 install store 投影。
 * 不负责：IPC、目录列表映射（见 map / lifecycle）。
 */
'use strict'

const path = require('path')
const { resolvePaths } = require('../capability-store')
const { createSkillRuntime } = require('../skill-runtime')
const { mergeSkillTaskCatalog } = require('../skill-task-catalog')
const { createExpertRuntime } = require('../expert-runtime')
const { fail } = require('./map')

function serializeSkillScriptArgs(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, code: 'invalid_args', message: '技能脚本 args 必须是对象' }
  }
  const stringify = (value) => {
    if (typeof value === 'string') return value
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
    if (value && typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }
  if (Object.prototype.hasOwnProperty.call(input, 'argv')) {
    if (!Array.isArray(input.argv)) return { ok: false, code: 'invalid_args', message: 'args.argv 必须是数组' }
    return { ok: true, argv: input.argv.map(stringify) }
  }

  const argv = []
  for (const [rawKey, rawValue] of Object.entries(input)) {
    const key = String(rawKey || '').trim()
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(key)) {
      return { ok: false, code: 'invalid_args', message: `无效的技能脚本参数名: ${key || '(空)'}` }
    }
    if (rawValue == null) continue
    const flag = `--${key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`
    const values = Array.isArray(rawValue) ? rawValue : [rawValue]
    for (const value of values) {
      if (value === true) argv.push(flag)
      else if (value === false) argv.push(`${flag}=false`)
      else argv.push(flag, stringify(value))
    }
  }
  return { ok: true, argv }
}

/**
 * 构建 Hub 内 skill/expert runtime 与相关 helper。
 */
function createCapabilityRuntime(deps) {
  const {
    getUserData,
    getKnowledgeDir,
    store,
    unifiedConnectors,
    getPackSkillSources,
    getPackEmptyStateGroups,
    getPackScenesForUi,
    getConnectorStatus,
    getExpertSnapshotRoot,
  } = deps

  function capabilitiesRoot() {
    return resolvePaths(getUserData()).root
  }

  function buildInstallStoreMap() {
    const loaded = store.loadInstallStore()
    const map = { skills: {}, experts: {}, connectors: {} }
    for (const entry of Object.values(loaded.entries || {})) {
      if (entry.kind === 'skill') map.skills[entry.id] = entry
      if (entry.kind === 'expert') map.experts[entry.id] = entry
      if (entry.kind === 'connector') map.connectors[entry.id] = entry
    }
    return map
  }

  async function runSkillScriptInSandbox(ctx = {}) {
    const agentSandbox = require('../agent-sandbox')
    const permissions = agentSandbox.normalizeSandboxPermissions(ctx.permissions || {}, {})
    const scriptsRoot = String(ctx.scriptsRoot || ctx.skillRoot || '').trim()
    if (!scriptsRoot) return fail('invalid_path', '技能 scripts 目录无效')

    const scriptAbs = String(ctx.scriptAbs || '').trim()
    const rel = path.relative(scriptsRoot, scriptAbs)
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      return fail('invalid_path', '脚本必须在技能 scripts/ 目录内')
    }

    const sandboxTools = agentSandbox.buildSandboxTools({
      workdir: scriptsRoot,
      permissions,
    })
    const serialized = serializeSkillScriptArgs(ctx.args || {})
    if (!serialized.ok) return fail(serialized.code, serialized.message)
    return sandboxTools.runScriptFile({ scriptAbs, argv: serialized.argv })
  }

  function skillRuntime() {
    return createSkillRuntime({
      capabilitiesRoot: capabilitiesRoot(),
      knowledgeDir: getKnowledgeDir(),
      getInstallStore: buildInstallStoreMap,
      getPackSkillSources: getPackSkillSources || undefined,
      getConnectorStatus: getConnectorStatus || undefined,
      runScript: (ctx) => runSkillScriptInSandbox(ctx),
    })
  }

  function findPackOwnedSkill(skillId) {
    if (!getPackSkillSources) return null
    const payload = getPackSkillSources()
    const sources = Array.isArray(payload) ? payload : (payload?.sources || [])
    return sources.find((item) => item.id === String(skillId || '').trim()) || null
  }

  function listSkillTasks(options = {}) {
    const dynamic = skillRuntime().listSkillTasks(options)
    return mergeSkillTaskCatalog({
      skillTasksResult: dynamic,
      emptyStateGroups: getPackEmptyStateGroups(),
      packScenes: getPackScenesForUi(),
    })
  }

  function expertRuntime() {
    const rt = createSkillRuntime({
      capabilitiesRoot: capabilitiesRoot(),
      knowledgeDir: getKnowledgeDir(),
      getInstallStore: buildInstallStoreMap,
    })
    return createExpertRuntime({
      capabilitiesRoot: capabilitiesRoot(),
      snapshotRoot: typeof getExpertSnapshotRoot === 'function' ? getExpertSnapshotRoot() : '',
      getSkillHashes: (ids) => {
        const out = {}
        for (const id of ids) {
          const rec = rt.findSkillRecord(id)
          if (rec) out[id] = rec.contentHash || ''
        }
        return out
      },
      getConnectorHashes: (ids) => Object.fromEntries(ids.map((id) => [id, `connector:${id}`])),
      getAvailableSkillIds: () => rt.scanAllSkills()
        .filter(item => rt.isSkillEnabled(item.id))
        .map(item => item.id),
      getAvailableConnectorIds: () => unifiedConnectors.loadConnectors()
        .filter(item => item.enabled !== false)
        .map(item => item.id),
    })
  }

  return {
    capabilitiesRoot,
    buildInstallStoreMap,
    runSkillScriptInSandbox,
    skillRuntime,
    expertRuntime,
    findPackOwnedSkill,
    listSkillTasks,
  }
}

module.exports = {
  createCapabilityRuntime,
  serializeSkillScriptArgs,
}

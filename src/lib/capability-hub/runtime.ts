/**
 * capability-hub/runtime — Skill/Expert 运行时、沙箱脚本与 install store 投影。
 * 不负责：IPC、目录列表映射（见 map / lifecycle）。
 */
'use strict'

const fs = require('fs')
const path = require('path')
const { resolvePaths } = require('../capability-store')
const { createSkillRuntime } = require('../skill-runtime')
const { mergeSkillTaskCatalog } = require('../skill-task-catalog')
const { createExpertRuntime } = require('../expert-runtime')
const { fail } = require('./map')

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

    const ext = path.extname(scriptAbs).toLowerCase()
    const sandboxTools = agentSandbox.buildSandboxTools({
      workdir: scriptsRoot,
      permissions,
    })

    if (ext === '.py') {
      const code = fs.readFileSync(scriptAbs, 'utf8')
      return sandboxTools.handlers.run_python({ code })
    }
    if (ext === '.js' || ext === '.mjs') {
      const command = process.platform === 'win32'
        ? `node "${scriptAbs.replace(/"/g, '\\"')}"`
        : `node ${JSON.stringify(scriptAbs)}`
      return sandboxTools.handlers.run_shell({ command })
    }
    if (ext === '.sh' || ext === '.bash') {
      const command = process.platform === 'win32'
        ? `bash "${scriptAbs.replace(/"/g, '\\"')}"`
        : `bash ${JSON.stringify(scriptAbs)}`
      return sandboxTools.handlers.run_shell({ command })
    }
    return fail('unsupported_script', `不支持的脚本类型: ${ext || '(无扩展名)'}`)
  }

  function skillRuntime() {
    return createSkillRuntime({
      capabilitiesRoot: capabilitiesRoot(),
      knowledgeDir: getKnowledgeDir(),
      getInstallStore: buildInstallStoreMap,
      getPackSkillSources: getPackSkillSources || undefined,
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
}

'use strict'

const path = require('path')
const fs = require('fs')

const userData = process.env.APPDATA + '/KnowMe'
const root = fs.realpathSync(path.join(__dirname, '..', '..', '..', '..'))
// evidence -> change -> changes -> openspec -> repo root (4 up). Fallback realpath of cwd.
const resolvedRoot = fs.existsSync(path.join(root, 'src', 'catalog'))
  ? root
  : fs.realpathSync(process.cwd())
const CATALOG_ROOT = path.join(resolvedRoot, 'src/catalog')

const { createCapabilityPackRuntime } = require(path.join(resolvedRoot, 'src/lib/capability-pack-runtime.js'))
const { createSkillRuntime } = require(path.join(resolvedRoot, 'src/lib/skill-runtime.js'))
const { createCapabilityStore } = require(path.join(resolvedRoot, 'src/lib/capability-store.js'))
const { createCapabilityHubService } = require(path.join(resolvedRoot, 'src/lib/capability-hub-service.js'))
const official = require(path.join(resolvedRoot, 'src/lib/official-workflows.js'))

const capStore = createCapabilityStore({ getUserData: () => userData })
const packRt = createCapabilityPackRuntime({
  userData,
  trustedCatalogRoot: CATALOG_ROOT,
  getOccupiedSkillIds: () => (capStore.listEntries({ kind: 'skill' }).entries || []).map((e) => e.id),
})
try {
  packRt.ensureDefaultPacks()
} catch (error) {
  console.error('ensureDefaultPacks', error.message)
}

const skillSources = packRt.listSkillSources()
const skillRt = createSkillRuntime({
  getUserData: () => userData,
  knowledgeDir: path.join(userData, 'knowledge'),
  catalogSkillsRoot: path.join(CATALOG_ROOT, 'skills'),
  getPackSkillSources: () => skillSources,
})

const hub = createCapabilityHubService({
  getUserData: () => userData,
  getKnowledgeDir: () => path.join(userData, 'knowledge'),
  bundledRoot: CATALOG_ROOT,
  getPackSkillSources: () => skillSources,
  getPackEmptyStateGroups: () => packRt.listEmptyStateGroups(),
})

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

async function main() {
  const all = await hub.listCapabilities({})
  const items = all.items || all.entries || []
  const experts = items.filter((i) => i.kind === 'expert')
  const skills = items.filter((i) => i.kind === 'skill')

  const install = capStore.loadInstallStore()
  const installedExperts = Object.values(install.entries || {}).filter((e) => e.kind === 'expert')

  const catalogExperts = fs.readdirSync(path.join(CATALOG_ROOT, 'experts'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)

  const expertRt = hub.expertRuntime()
  const loadMap = {}
  const ids = [...new Set([
    ...catalogExperts,
    ...experts.map((e) => e.id),
    ...installedExperts.map((e) => e.id),
  ])]

  for (const id of ids) {
    try {
      const r = expertRt.loadExpert(id)
      if (r.ok === false) {
        loadMap[id] = { ok: false, code: r.code, message: r.message }
        continue
      }
      const expert = r.expert || r
      loadMap[id] = {
        ok: true,
        name: expert.name || r.name || id,
        skills: expert.skills || r.skills || [],
        tools: expert.tools || r.tools || [],
        source: experts.find((e) => e.id === id)?.source || installedExperts.find((e) => e.id === id)?.source || 'catalog',
        bodyLen: String(expert.body || expert.content || r.body || '').length,
        hasManifest: !!(expert.manifest || r.manifest),
      }
    } catch (error) {
      loadMap[id] = { ok: false, error: error.message }
    }
  }

  const skillLoad = {}
  for (const entry of Object.values(loadMap)) {
    for (const skill of entry.skills || []) {
      const sid = typeof skill === 'string' ? skill : skill.id
      if (!sid || skillLoad[sid]) continue
      const lr = skillRt.loadSkillL1(sid)
      skillLoad[sid] = lr.ok === false
        ? { ok: false, code: lr.code, message: lr.message }
        : { ok: true }
    }
  }

  const workflowList = []
  if (typeof official.listOfficialWorkflowPackages === 'function') {
    workflowList.push(...(official.listOfficialWorkflowPackages() || []))
  } else if (typeof official.listOfficialWorkflows === 'function') {
    workflowList.push(...(official.listOfficialWorkflows() || []))
  } else {
    for (const key of ['OFFICE_MEETING_LOOP', 'ENGINEERING_TEAM_DELIVERY', 'VISUAL_BRIEF_REVIEW']) {
      if (official[key]) workflowList.push(official[key])
    }
    if (Array.isArray(official.OFFICIAL_WORKFLOWS)) workflowList.push(...official.OFFICIAL_WORKFLOWS)
  }

  const wfIssues = []
  for (const wf of workflowList) {
    const id = wf.id || wf.name
    for (const ref of wf.agentRefs || []) {
      const eid = ref.id || ref
      if (!loadMap[eid]?.ok) wfIssues.push({ workflow: id, type: 'missing_expert', expertId: eid })
    }
    for (const ref of wf.skillRefs || []) {
      const sid = ref.id || ref
      const lr = skillRt.loadSkillL1(sid)
      if (lr.ok === false) wfIssues.push({ workflow: id, type: 'missing_skill', skillId: sid, code: lr.code })
    }
  }

  const sceneIssues = []
  for (const packId of ['game-studio', 'office-partner']) {
    const rec = packRt.loadPackRecord(packId)
    const scenes = rec?.scenes?.scenes || (Array.isArray(rec?.scenes) ? rec.scenes : [])
    for (const sc of scenes) {
      if (sc.expertId && !loadMap[sc.expertId]?.ok) {
        sceneIssues.push({ packId, scene: sc.id, expertId: sc.expertId, issue: 'expert_unloadable' })
      }
      if (sc.skillId) {
        const lr = skillRt.loadSkillL1(sc.skillId)
        if (lr.ok === false) {
          sceneIssues.push({ packId, scene: sc.id, skillId: sc.skillId, issue: 'skill_unloadable', code: lr.code })
        }
      } else if (Object.prototype.hasOwnProperty.call(sc, 'skillId') && !sc.skillId) {
        sceneIssues.push({ packId, scene: sc.id, issue: 'skillId_null' })
      }
    }
  }

  const modeIssues = []
  const modes = readJson(path.join(userData, 'workbench-modes.json'))
  if (modes) {
    for (const [modeId, bindings] of Object.entries(modes.bindings || {})) {
      for (const binding of bindings || []) {
        const eid = binding.expertId || binding.id
        if (eid && !loadMap[eid]?.ok) modeIssues.push({ modeId, expertId: eid, issue: 'ghost_binding' })
      }
    }
  }

  const taskGhosts = []
  const tasksFile = readJson(path.join(userData, 'workbench-tasks.json'))
  const taskList = Array.isArray(tasksFile) ? tasksFile : (tasksFile?.tasks || [])
  for (const task of taskList) {
    const eid = task.expertId
    if (eid && !loadMap[eid]?.ok) {
      taskGhosts.push({ taskId: task.id, title: task.title || task.name, expertId: eid })
    }
  }

  const diskExperts = fs.existsSync(path.join(userData, 'capabilities/experts'))
    ? fs.readdirSync(path.join(userData, 'capabilities/experts'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
    : []
  const installedIds = new Set(installedExperts.map((e) => e.id))
  const orphanDirs = diskExperts.filter((id) => !installedIds.has(id))

  const hubExpertIds = new Set(experts.map((e) => e.id))
  const catalogMissingFromHub = catalogExperts.filter((id) => !hubExpertIds.has(id))

  const byName = {}
  for (const expert of experts) {
    const name = String(expert.name || expert.id).toLowerCase()
    byName[name] = byName[name] || []
    byName[name].push(expert.id)
  }
  const nameCollisions = Object.entries(byName).filter(([, list]) => list.length > 1)

  const emptySkillExperts = Object.entries(loadMap)
    .filter(([, value]) => value.ok && (!value.skills || value.skills.length === 0))
    .map(([id, value]) => ({ id, name: value.name, bodyLen: value.bodyLen }))

  const thinBodyExperts = Object.entries(loadMap)
    .filter(([, value]) => value.ok && value.bodyLen < 80)
    .map(([id, value]) => ({ id, name: value.name, bodyLen: value.bodyLen }))

  const brokenExpertSkills = Object.entries(skillLoad)
    .filter(([, value]) => !value.ok)
    .map(([id, value]) => ({ skillId: id, ...value }))

  const report = {
    packs: packRt.listEnabledPacks().map((p) => p.id || p),
    catalogExperts,
    hubExperts: experts.map((e) => ({
      id: e.id,
      name: e.name,
      source: e.source,
      status: e.status,
    })),
    installedExperts: installedExperts.map((e) => ({
      id: e.id,
      source: e.source,
      status: e.status,
      enabled: e.enabled,
    })),
    loadFailures: Object.entries(loadMap)
      .filter(([, value]) => !value.ok)
      .map(([id, value]) => ({ id, ...value })),
    skillLoadFailures: brokenExpertSkills,
    workflows: workflowList.map((wf) => ({
      id: wf.id,
      name: wf.name,
      agents: (wf.agentRefs || []).map((ref) => ref.id || ref),
      skills: (wf.skillRefs || []).map((ref) => ref.id || ref),
    })),
    wfIssues,
    sceneIssues,
    modeIssues,
    taskGhostCount: taskGhosts.length,
    taskGhosts: taskGhosts.slice(0, 25),
    orphanDirs,
    catalogMissingFromHub,
    nameCollisions,
    emptySkillExperts,
    thinBodyExperts,
    hubSkillCount: skills.length,
    emptyScenes: packRt.listEmptyStateGroups().flatMap((group) => (group.scenes || []).map((scene) => ({
      pack: group.packId,
      id: scene.id,
      label: scene.title || scene.label,
      skillId: scene.skillId,
      expertId: scene.expertId,
    }))),
    summary: {
      expertLoadOk: Object.values(loadMap).filter((v) => v.ok).length,
      expertLoadFail: Object.values(loadMap).filter((v) => !v.ok).length,
      wfIssueCount: wfIssues.length,
      sceneIssueCount: sceneIssues.length,
      modeIssueCount: modeIssues.length,
      orphanDirCount: orphanDirs.length,
      emptySkillExpertCount: emptySkillExperts.length,
    },
  }

  const outPath = path.join(__dirname, 'expert-antipattern-audit.json')
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8')
  console.log(JSON.stringify(report, null, 2))
  console.error('wrote', outPath)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

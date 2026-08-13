'use strict'

/**
 * 货架供给探针：用仓库真实工作流定义跑一遍供给管道，输出改造前后的对比事实。
 * 改造前基线由本脚本内的 legacyProjection() 复刻（只取 index 元数据，不读正文）。
 *
 * 用法：node openspec/changes/rebuild-workbench-workflow-shelf/evidence/shelf-supply-probe.js
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../../../..')
const workflowPackage = require(path.join(ROOT, 'src/lib/workflow-package'))
const workbenchConsoleModel = require(path.join(ROOT, 'src/lib/workbench-console-model'))
const workflowSupply = require(path.join(ROOT, 'src/lib/workflow-supply'))

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function loadRepoWorkflows() {
  const dir = path.join(ROOT, '.cursor', 'workflows')
  const index = readJsonSafe(path.join(dir, 'index.json'))
  const entries = Array.isArray(index?.workflows) ? index.workflows : []
  return entries.map(entry => ({
    id: entry.id,
    name: entry.name,
    description: entry.description || '',
    tags: entry.tags || [],
    path: entry.path || '',
    catalog: entry.catalog || null,
    definition: entry.path ? readJsonSafe(path.join(dir, entry.path)) : null,
  }))
}

/** 改造前的投影逻辑：只取 index 元数据，graph 与 agentRefs 全空。 */
function legacyProjection(workflows, daemon, verticals) {
  const packages = []
  const seen = new Set()
  for (const item of workflows) {
    if (!item.id || seen.has(item.id)) continue
    seen.add(item.id)
    const normalized = workflowPackage.normalizeWorkflowPackage({
      id: item.id,
      name: item.name || item.id,
      description: item.description || '',
      source: 'team',
      status: 'published',
      goalTypes: item.tags || [],
      executionBackends: ['daemon', 'local-team'],
      provenance: { path: item.path || '', kind: 'professional' },
    })
    if (normalized.ok) packages.push(normalized.package)
  }
  for (const item of daemon.workflows || []) {
    if (!item.id || seen.has(item.id)) continue
    seen.add(item.id)
    const normalized = workflowPackage.normalizeWorkflowPackage({
      id: item.id,
      name: item.name || item.id,
      source: 'official',
      status: 'published',
      executionBackends: ['daemon'],
    })
    if (normalized.ok) packages.push(normalized.package)
  }
  for (const resolved of verticals) {
    const seed = resolved.package
    if (seen.has(seed.id)) continue
    seen.add(seed.id)
    const normalized = workflowPackage.normalizeWorkflowPackage(seed)
    if (normalized.ok) packages.push(normalized.package)
  }
  return packages
}

function validityOf(pkg) {
  const result = workflowPackage.validateWorkflowPackage(pkg)
  return result.ok ? 'valid' : result.issues.map(issue => issue.code).join(',')
}

function describe(pkg) {
  return {
    id: pkg.id,
    origin: pkg.origin || pkg.source,
    nodes: (pkg.graph?.nodes || []).length,
    agents: (pkg.agentRefs || []).length,
    runnable: pkg.readiness ? pkg.readiness.runnable : null,
    blockers: pkg.readiness ? pkg.readiness.blockers.map(item => item.code) : [],
    validity: validityOf(pkg),
  }
}

function run(daemonOverview, agents, label) {
  const repoWorkflows = loadRepoWorkflows()
  const facts = workbenchConsoleModel.buildVerticalPipelineFacts({
    daemon: daemonOverview,
    agents,
    availableExperts: agents.map(agent => agent.id),
    localTeamEnabled: true,
  })
  const verticals = workbenchConsoleModel.resolveVerticalPipelines(facts)

  const legacy = legacyProjection(repoWorkflows, daemonOverview, verticals)
  const next = workflowSupply.buildWorkflowSupply({
    repoWorkflows,
    daemon: daemonOverview,
    personal: [],
    verticals,
    agents,
    repoActive: true,
    localTeamEnabled: true,
  })

  console.log(`\n===== ${label} =====`)
  console.log(`改造前 packages: ${legacy.length}`)
  console.table(legacy.map(describe))
  console.log(`改造后 packages: ${next.packages.length}（可运行 ${next.stats.runnable}）`)
  console.table(next.packages.map(describe))
  console.log('诊断:')
  console.table(next.diagnostics)
  return { legacy, next }
}

const REPO_AGENTS = [{ id: 'producer' }, { id: 'developer' }, { id: 'tester' }, { id: 'office-partner' }]

run({ online: false, workflows: [] }, REPO_AGENTS, 'Daemon 离线')

run({
  online: true,
  workflows: [
    { id: 'team-run', name: '三角色协作开发', agentIds: ['producer', 'developer', 'tester'] },
    { id: 'daily-summary', name: '每日总结', agentIds: ['office-partner'], catalog: { visibility: 'primary' } },
    { id: 'internal-debug', name: '内部调试', agentIds: [], catalog: { visibility: 'internal' } },
  ],
}, REPO_AGENTS, 'Daemon 在线（含内部流程）')

'use strict'

const fs = require('fs')
const path = require('path')

const DESIGN_WEIGHTS = { identity: 20, contract: 20, boundaries: 15, skills: 20, grounding: 15, package: 10 }
const RUNTIME_WEIGHTS = { completion: 30, quality: 25, evidence: 20, efficiency: 15, fit: 10 }
const RUNTIME_DIMENSIONS = Object.keys(RUNTIME_WEIGHTS)
const QUALIFICATION_SCENARIOS = ['edge', 'retry', 'revision', 'reopen']
const QUALIFICATION_MIN_SAMPLES = 6
const QUALIFICATION_MIN_SCORE = 85
const EXCEPTIONS = new Set(['external-capability-importer'])

function list(value) {
  return Array.isArray(value) ? value.map(String).map(item => item.trim()).filter(Boolean) : []
}

function parseFrontmatter(text) {
  const match = String(text || '').match(/^---\r?\n([\s\S]*?)\r?\n---/)
  const out = {}
  if (!match) return out
  let active = null
  for (const line of match[1].split(/\r?\n/)) {
    const item = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/)
    if (item) {
      active = item[1]
      out[active] = item[2].replace(/^['"]|['"]$/g, '')
      if (!out[active]) out[active] = []
      continue
    }
    const listItem = line.match(/^\s+-\s+(.*)$/)
    if (listItem && active) {
      if (!Array.isArray(out[active])) out[active] = []
      out[active].push(listItem[1].replace(/^['"]|['"]$/g, '').trim())
    }
  }
  return out
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null }
}

function scoreCheck(passed, score, message, severity = 'warning') {
  return { score: passed ? score : 0, issues: passed ? [] : [{ severity, message }] }
}

function evaluateExpertPackage({ id, dir, availableSkills = [] }) {
  const mdPath = path.join(dir, 'EXPERT.md')
  const manifestPath = path.join(dir, 'manifest.json')
  const md = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf8') : ''
  const front = parseFrontmatter(md)
  const manifest = readJson(manifestPath) || {}
  const skills = list(manifest.skills)
  const connectors = list(manifest.connectors)
  const issues = []
  const add = (result) => issues.push(...result.issues)

  let identity = 0
  if (String(front.name || '').trim()) identity += 50
  if (String(front.description || '').trim()) identity += 50
  add(scoreCheck(identity === 100, identity, '缺少 name 或 description'))

  const useCases = list(front.useCases)
  const inputs = list(front.inputContract)
  const outputs = list(front.outputContract)
  const contract = (inputs.length ? 50 : 0) + (outputs.length ? 50 : 0)
  add(scoreCheck(contract === 100, contract, 'inputContract 或 outputContract 不完整'))

  const boundaries = list(front.boundaries)
  add(scoreCheck(boundaries.length > 0, Math.min(100, boundaries.length * 50), '未声明专家边界'))

  const knownSkills = new Set(availableSkills)
  const invalidSkills = skills.filter(skill => !knownSkills.has(skill))
  if (invalidSkills.length) issues.push({ severity: 'error', message: `引用不存在的技能：${invalidSkills.join('、')}` })
  const skillScore = skills.length ? (invalidSkills.length ? 0 : 100) : (EXCEPTIONS.has(id) ? 75 : 0)
  add(scoreCheck(skillScore > 0, skillScore, '未绑定技能；若专家有稳定工作流，建议补充专用技能'))

  const fullText = `${md}\n${JSON.stringify(manifest)}`.toLowerCase()
  const groundingSignals = /(证据|来源|资料|数据|知识|不确定|假设|可复核|引用|因果)/.test(fullText)
  add(scoreCheck(groundingSignals, groundingSignals ? 100 : 0, '缺少证据、来源、数据或不确定性策略'))

  const packageOk = fs.existsSync(mdPath) && fs.existsSync(manifestPath)
    && String(manifest.id || id) === id && String(manifest.kind || 'expert') === 'expert'
  add(scoreCheck(packageOk, packageOk ? 100 : 0, '专家包文件、ID 或 kind 不一致', 'error'))

  const dimensions = { identity, contract, boundaries: Math.min(100, boundaries.length * 50), skills: skillScore, grounding: groundingSignals ? 100 : 0, package: packageOk ? 100 : 0 }
  const designScore = Math.round(Object.entries(DESIGN_WEIGHTS).reduce((sum, [key, weight]) => sum + dimensions[key] * weight / 100, 0))
  return {
    agentId: id,
    name: String(front.name || manifest.name || id),
    description: String(front.description || ''),
    useCases,
    skills,
    connectors,
    dimensions,
    designScore,
    issues,
  }
}

function configurationIdOf(task) {
  return String(task?.configurationId || task?.qualificationContext?.configurationId || '').trim()
}

function aggregateRuntimeTasks(runtimeTasks) {
  const sums = {}
  const counts = {}
  for (const task of runtimeTasks) {
    for (const dimension of RUNTIME_DIMENSIONS) {
      const value = Number(task?.[dimension])
      if (!Number.isFinite(value)) continue
      sums[dimension] = (sums[dimension] || 0) + Math.max(0, Math.min(100, value))
      counts[dimension] = (counts[dimension] || 0) + 1
    }
  }
  const dimensions = {}
  let weighted = 0
  let totalWeight = 0
  for (const [dimension, weight] of Object.entries(RUNTIME_WEIGHTS)) {
    if (!counts[dimension]) continue
    dimensions[dimension] = Math.round(sums[dimension] / counts[dimension])
    weighted += dimensions[dimension] * weight
    totalWeight += weight
  }
  const rawScore = totalWeight ? Math.round(weighted / totalWeight) : null
  return {
    dimensions,
    rawScore,
    missing: RUNTIME_DIMENSIONS.filter(dimension => !counts[dimension]),
  }
}

function scenarioCoverage(runtimeTasks) {
  const scenarioCounts = runtimeTasks.reduce((acc, task) => {
    const scenario = String(task?.scenario || '').trim().toLowerCase()
    if (scenario) acc[scenario] = (acc[scenario] || 0) + 1
    return acc
  }, {})
  const missingScenarios = []
  if ((scenarioCounts.normal || 0) < 2) missingScenarios.push('normal:2')
  for (const scenario of QUALIFICATION_SCENARIOS) {
    if (!scenarioCounts[scenario]) missingScenarios.push(scenario)
  }
  return { scenarioCounts, missingScenarios }
}

function scoreRuntimeTasks(tasks = [], options = {}) {
  const runtimeTasks = Array.isArray(tasks) ? tasks : []
  const configurationGroups = new Map()
  const unscopedTasks = []
  for (const task of runtimeTasks) {
    const configurationId = configurationIdOf(task)
    if (!configurationId) {
      unscopedTasks.push(task)
      continue
    }
    const group = configurationGroups.get(configurationId) || []
    group.push(task)
    configurationGroups.set(configurationId, group)
  }
  const configurationIds = [...configurationGroups.keys()].sort()
  const mixedConfigurations = configurationIds.length > 1
  const requestedCurrentConfigurationId = String(options.currentConfigurationId || '').trim()
  const currentConfigurationId = requestedCurrentConfigurationId && configurationGroups.has(requestedCurrentConfigurationId)
    ? requestedCurrentConfigurationId
    : configurationIds.length === 1 ? configurationIds[0] : ''
  const scopedTasks = currentConfigurationId
    ? configurationGroups.get(currentConfigurationId)
    : configurationIds.length === 0
      ? unscopedTasks
      : []
  const aggregate = aggregateRuntimeTasks(scopedTasks)
  const { missingScenarios } = scenarioCoverage(scopedTasks)
  const isHardFailure = task => (
    task?.hardFailure === true
    || task?.hardAssertionsPassed === false
    || String(task?.status || '').toLowerCase() === 'failed'
  )
  const hardFailures = scopedTasks.filter(isHardFailure).length
  const observedHardFailures = runtimeTasks.filter(isHardFailure).length
  const weakTasks = scopedTasks.filter(task => ['completion', 'quality', 'evidence', 'fit'].some(dimension => {
    const value = Number(task?.[dimension])
    return Number.isFinite(value) && value < 80
  })).length
  const sampleCount = scopedTasks.length
  const configurationSummaries = configurationIds.map(configurationId => {
    const group = configurationGroups.get(configurationId)
    const groupAggregate = aggregateRuntimeTasks(group)
    const groupCoverage = scenarioCoverage(group)
    const groupHardFailures = group.filter(isHardFailure).length
    const groupWeakTasks = group.filter(task => ['completion', 'quality', 'evidence', 'fit'].some(dimension => {
      const value = Number(task?.[dimension])
      return Number.isFinite(value) && value < 80
    })).length
    const groupState = groupHardFailures > 0 || groupWeakTasks > 0
      || (group.length >= QUALIFICATION_MIN_SAMPLES && !groupAggregate.missing.length && groupAggregate.rawScore < QUALIFICATION_MIN_SCORE)
      ? 'failed'
      : (group.length < QUALIFICATION_MIN_SAMPLES || groupAggregate.missing.length || groupCoverage.missingScenarios.length
          ? 'insufficient_evidence'
          : 'qualified')
    return {
      configurationId,
      current: configurationId === currentConfigurationId,
      sampleCount: group.length,
      dimensions: groupAggregate.dimensions,
      rawScore: groupAggregate.rawScore,
      missingScenarios: groupCoverage.missingScenarios,
      hardFailures: groupHardFailures,
      weakTasks: groupWeakTasks,
      state: groupState,
    }
  })
  const qualificationBase = {
    requiredSampleCount: QUALIFICATION_MIN_SAMPLES,
    minimumScore: QUALIFICATION_MIN_SCORE,
    missingScenarios,
    hardFailures,
    weakTasks,
    configurationId: currentConfigurationId || null,
    configurationIds,
    unscopedSamples: unscopedTasks.length,
    mixedConfigurations,
    observedHardFailures,
    requiredConfigurationIdentity: 'agent+skills+connectors+model',
  }
  if (aggregate.rawScore == null) {
    return {
      sampleCount,
      observedSampleCount: runtimeTasks.length,
      dimensions: aggregate.dimensions,
      rawScore: null,
      displayScore: null,
      confidence: sampleCount >= 6 ? 'high' : sampleCount >= 3 ? 'medium' : sampleCount ? 'low' : 'unverified',
      missing: aggregate.missing,
      configurationSummaries,
      qualification: {
        ...qualificationBase,
        state: hardFailures > 0 || (!currentConfigurationId && observedHardFailures > 0)
          ? 'failed'
          : runtimeTasks.length ? 'insufficient_evidence' : 'unverified',
      },
    }
  }
  const rawScore = aggregate.rawScore
  const displayScore = Math.round((sampleCount / (sampleCount + 5)) * rawScore + (5 / (sampleCount + 5)) * 70)
  const hasStableConfiguration = Boolean(currentConfigurationId)
  const qualificationState = hardFailures > 0 || weakTasks > 0 || (sampleCount >= QUALIFICATION_MIN_SAMPLES && !aggregate.missing.length && rawScore < QUALIFICATION_MIN_SCORE)
    ? 'failed'
    : (!hasStableConfiguration || sampleCount < QUALIFICATION_MIN_SAMPLES || aggregate.missing.length || missingScenarios.length
        ? 'insufficient_evidence'
        : 'qualified')
  return {
    sampleCount,
    observedSampleCount: runtimeTasks.length,
    dimensions: aggregate.dimensions,
    rawScore,
    displayScore,
    confidence: sampleCount >= 6 ? 'high' : sampleCount >= 3 ? 'medium' : 'low',
    missing: aggregate.missing,
    configurationSummaries,
    qualification: {
      ...qualificationBase,
      state: qualificationState,
    },
  }
}

function expertTitleEligibility(qualification = {}) {
  const state = String(qualification.state || 'unverified')
  if (state === 'qualified') {
    return {
      eligible: true,
      state: 'eligible',
      reason: 'The current immutable Agent, Skill, connector and model configuration passed the production qualification gate.',
    }
  }
  if (state === 'failed') {
    return {
      eligible: false,
      state: 'not_eligible',
      reason: 'The current configuration has a package, professional-quality or lifecycle hard failure.',
    }
  }
  return {
    eligible: false,
    state: 'pending_evidence',
    reason: 'A valid package or installed Skill is not expert proof; configuration-scoped normal, edge, retry, revision and reopen evidence is still incomplete.',
  }
}

function lifecycleOf(entry = {}) {
  const lifecycle = entry.lifecycle && typeof entry.lifecycle === 'object' ? entry.lifecycle : {}
  return {
    state: String(lifecycle.state || 'active'),
    newTasks: lifecycle.newTasks !== false,
    successors: Array.isArray(lifecycle.successors)
      ? lifecycle.successors
          .filter(item => item && typeof item === 'object' && item.id)
          .map(item => ({ kind: String(item.kind || ''), id: String(item.id) }))
      : [],
  }
}

function evaluateAgents({ expertsRoot, catalogPath, results = null }) {
  const catalog = readJson(catalogPath) || { entries: [] }
  const availableSkills = catalog.entries.filter(item => item.kind === 'skill').map(item => String(item.id))
  const resultByAgent = new Map((results?.agents || []).map(item => [String(item.agentId), item]))
  const expertEntries = catalog.entries.filter(item => item.kind === 'expert')
  const installedPackageIds = new Set(fs.readdirSync(expertsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name))
  const activeExpertIds = new Set(expertEntries
    .filter(entry => lifecycleOf(entry).newTasks)
    .map(entry => String(entry.id)))
  const agents = [...installedPackageIds]
    .filter(id => activeExpertIds.has(id))
    .sort()
    .map(id => evaluateExpertPackage({ id, dir: path.join(expertsRoot, id), availableSkills }))
    .map(agent => {
      const runtimeEvidence = resultByAgent.get(agent.agentId) || {}
      const runtime = scoreRuntimeTasks(runtimeEvidence.tasks || [], {
        currentConfigurationId: runtimeEvidence.currentConfigurationId,
      })
      const packageErrorCount = agent.issues.filter(issue => issue.severity === 'error').length
      const packageGatePassed = packageErrorCount === 0 && agent.designScore >= 85
      const qualification = packageGatePassed
        ? { ...runtime.qualification, packageGate: { passed: true, designScore: agent.designScore, errorCount: 0 } }
        : {
            ...runtime.qualification,
            state: packageErrorCount ? 'failed' : 'insufficient_evidence',
            packageGate: { passed: false, designScore: agent.designScore, errorCount: packageErrorCount },
          }
      return {
        ...agent,
        runtime,
        overallScore: runtime.displayScore == null ? null : Math.round(agent.designScore * 0.3 + runtime.displayScore * 0.7),
        qualification,
        expertTitle: expertTitleEligibility(qualification),
        confidence: runtime.sampleCount ? runtime.confidence : 'unverified',
      }
    })
  const legacyAgents = expertEntries
    .filter(entry => !lifecycleOf(entry).newTasks)
    .map(entry => {
      const id = String(entry.id)
      const lifecycle = lifecycleOf(entry)
      const packageInstalled = installedPackageIds.has(id)
      const packageAudit = packageInstalled
        ? evaluateExpertPackage({ id, dir: path.join(expertsRoot, id), availableSkills })
        : null
      return {
        agentId: id,
        name: String(packageAudit?.name || entry.name || id),
        lifecycle,
        packageInstalled,
        designScore: packageAudit?.designScore ?? null,
        issues: packageAudit?.issues || [{ severity: 'error', message: '历史专家包缺失，旧任务可能无法重开' }],
      }
    })
    .sort((a, b) => a.agentId.localeCompare(b.agentId))
  const overallScores = agents.map(item => item.overallScore).filter(Number.isFinite)
  return {
    version: '3.2.0',
    rubric: 'AgentEvals v3.2 · lifecycle-scoped production candidates + configuration-scoped runtime evidence + legacy compatibility audit',
    evaluatedAt: new Date().toISOString(),
    source: path.relative(process.cwd(), expertsRoot).replace(/\\/g, '/'),
    total: agents.length,
    averageDesignScore: agents.length ? Math.round(agents.reduce((sum, item) => sum + item.designScore, 0) / agents.length) : 0,
    averageOverallScore: overallScores.length ? Math.round(overallScores.reduce((sum, score) => sum + score, 0) / overallScores.length) : null,
    qualificationSummary: {
      qualified: agents.filter(item => item.qualification.state === 'qualified').length,
      failed: agents.filter(item => item.qualification.state === 'failed').length,
      insufficientEvidence: agents.filter(item => item.qualification.state === 'insufficient_evidence').length,
      unverified: agents.filter(item => item.qualification.state === 'unverified').length,
    },
    expertTitleSummary: {
      eligible: agents.filter(item => item.expertTitle.eligible).length,
      notEligible: agents.filter(item => item.expertTitle.state === 'not_eligible').length,
      pendingEvidence: agents.filter(item => item.expertTitle.state === 'pending_evidence').length,
    },
    portfolioSummary: {
      productionCandidates: agents.length,
      legacyPackages: legacyAgents.length,
      legacyPackagesInstalled: legacyAgents.filter(item => item.packageInstalled).length,
      legacyPackagesWithErrors: legacyAgents.filter(item => item.issues.some(issue => issue.severity === 'error')).length,
    },
    agents,
    legacyAgents,
  }
}

function toMarkdown(report) {
  const lines = [
    '# AgentEvals Report', '',
    `- Rubric: ${report.rubric}`,
    `- Agents: ${report.total}`,
    `- Average package-contract score: ${report.averageDesignScore} (structure only; not professional qualification)`,
    `- Average overall score: ${report.averageOverallScore == null ? '— (no runtime evidence)' : report.averageOverallScore}`,
    `- Qualified experts: ${report.qualificationSummary.qualified}/${report.total}`,
    `- Expert-title eligible: ${report.expertTitleSummary?.eligible ?? report.agents.filter(item => item.qualification.state === 'qualified').length}/${report.total}`,
    `- Legacy packages retained for history: ${report.portfolioSummary?.legacyPackagesInstalled ?? 0}/${report.portfolioSummary?.legacyPackages ?? 0}`,
    '',
    '| Agent | Package contract | Runtime-backed overall | Qualification | Expert title | Confidence | Issues |',
    '|---|---:|---:|---|---|---|---:|',
  ]
  for (const agent of report.agents) {
    const titleState = agent.expertTitle?.state || expertTitleEligibility(agent.qualification).state
    lines.push(`| ${agent.name} (${agent.agentId}) | ${agent.designScore} | ${agent.overallScore == null ? '—' : agent.overallScore} | ${agent.qualification.state} | ${titleState} | ${agent.confidence} | ${agent.issues.length} |`)
  }
  lines.push('', '## Details', '')
  for (const agent of report.agents) {
    lines.push(`### ${agent.name} (${agent.agentId})`, '', `- Package-contract score: ${agent.designScore} (structure only)`, `- Runtime-backed overall score: ${agent.overallScore == null ? '—' : agent.overallScore}`, `- Qualification: ${agent.qualification.state}`, `- Skills: ${agent.skills.join(', ') || 'none'}`, `- Connectors: ${agent.connectors.join(', ') || 'none'}`)
    lines.push(`- Runtime configuration: ${agent.qualification.configurationId || 'unscoped / not recorded'}`)
    lines.push(`- Expert-title eligibility: ${(agent.expertTitle || expertTitleEligibility(agent.qualification)).state}`)
    lines.push(`- Observed samples: ${agent.runtime.observedSampleCount}; descriptively evaluated rows: ${agent.runtime.sampleCount}; unscoped (never qualifying) samples: ${agent.qualification.unscopedSamples}`)
    if (agent.qualification.mixedConfigurations) lines.push(`- Mixed configurations (not pooled): ${agent.qualification.configurationIds.join(', ')}`)
    if (agent.runtime.configurationSummaries.length) {
      lines.push('- Configuration evidence:')
      for (const summary of agent.runtime.configurationSummaries) {
        lines.push(`  - ${summary.current ? '[current] ' : ''}${summary.configurationId}: ${summary.sampleCount} samples; ${summary.state}; hard failures ${summary.hardFailures}; raw score ${summary.rawScore == null ? '—' : summary.rawScore}; missing scenarios ${summary.missingScenarios.join(', ') || 'none'}`)
      }
    }
    if (agent.issues.length) {
      lines.push('- Issues:')
      for (const issue of agent.issues) lines.push(`  - [${issue.severity}] ${issue.message}`)
    } else lines.push('- Issues: none')
    lines.push('')
  }
  if (report.legacyAgents?.length) {
    lines.push('## Legacy compatibility audit', '', '| Legacy role | Package retained | Successor | Package issues |', '|---|---|---|---:|')
    for (const agent of report.legacyAgents) {
      const successors = agent.lifecycle.successors.map(item => `${item.kind}:${item.id}`).join(', ') || 'none'
      lines.push(`| ${agent.name} (${agent.agentId}) | ${agent.packageInstalled ? 'yes' : 'no'} | ${successors} | ${agent.issues.length} |`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

module.exports = { DESIGN_WEIGHTS, RUNTIME_WEIGHTS, QUALIFICATION_SCENARIOS, parseFrontmatter, evaluateExpertPackage, scoreRuntimeTasks, evaluateAgents, toMarkdown }

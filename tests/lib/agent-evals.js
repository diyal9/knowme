'use strict'

const fs = require('fs')
const path = require('path')

const DESIGN_WEIGHTS = { identity: 20, contract: 20, boundaries: 15, skills: 20, grounding: 15, package: 10 }
const RUNTIME_WEIGHTS = { completion: 30, quality: 25, evidence: 20, efficiency: 15, fit: 10 }
const RUNTIME_DIMENSIONS = Object.keys(RUNTIME_WEIGHTS)
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
  const skillScore = skills.length ? Math.min(100, 50 + skills.length * 25) : (EXCEPTIONS.has(id) ? 75 : 0)
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

function scoreRuntimeTasks(tasks = []) {
  const sums = {}
  const counts = {}
  for (const task of Array.isArray(tasks) ? tasks : []) {
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
  if (!totalWeight) return { sampleCount: 0, dimensions: {}, rawScore: null, displayScore: null, confidence: 'unverified', missing: RUNTIME_DIMENSIONS }
  const rawScore = Math.round(weighted / totalWeight)
  const sampleCount = Array.isArray(tasks) ? tasks.length : 0
  const displayScore = Math.round((sampleCount / (sampleCount + 5)) * rawScore + (5 / (sampleCount + 5)) * 70)
  return {
    sampleCount,
    dimensions,
    rawScore,
    displayScore,
    confidence: sampleCount >= 6 ? 'high' : sampleCount >= 3 ? 'medium' : 'low',
    missing: RUNTIME_DIMENSIONS.filter(dimension => !counts[dimension]),
  }
}

function evaluateAgents({ expertsRoot, catalogPath, results = null }) {
  const catalog = readJson(catalogPath) || { entries: [] }
  const availableSkills = catalog.entries.filter(item => item.kind === 'skill').map(item => String(item.id))
  const resultByAgent = new Map((results?.agents || []).map(item => [String(item.agentId), item.tasks || []]))
  const catalogExpertIds = new Set(catalog.entries.filter(item => item.kind === 'expert').map(item => String(item.id)))
  const agents = fs.readdirSync(expertsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && catalogExpertIds.has(entry.name))
    .map(entry => evaluateExpertPackage({ id: entry.name, dir: path.join(expertsRoot, entry.name), availableSkills }))
    .map(agent => {
      const runtime = scoreRuntimeTasks(resultByAgent.get(agent.agentId) || [])
      return {
        ...agent,
        runtime,
        overallScore: runtime.displayScore == null ? agent.designScore : Math.round(agent.designScore * 0.3 + runtime.displayScore * 0.7),
        confidence: runtime.sampleCount ? runtime.confidence : 'unverified',
      }
    })
  return {
    version: '1.0.0',
    rubric: 'AgentEvals v1',
    evaluatedAt: new Date().toISOString(),
    source: path.relative(process.cwd(), expertsRoot).replace(/\\/g, '/'),
    total: agents.length,
    averageDesignScore: agents.length ? Math.round(agents.reduce((sum, item) => sum + item.designScore, 0) / agents.length) : 0,
    averageOverallScore: agents.length ? Math.round(agents.reduce((sum, item) => sum + item.overallScore, 0) / agents.length) : 0,
    agents,
  }
}

function toMarkdown(report) {
  const lines = [
    '# AgentEvals Report', '',
    `- Rubric: ${report.rubric}`,
    `- Agents: ${report.total}`,
    `- Average design score: ${report.averageDesignScore}`,
    `- Average overall score: ${report.averageOverallScore}`,
    '',
    '| Agent | Design | Overall | Confidence | Issues |',
    '|---|---:|---:|---|---:|',
  ]
  for (const agent of report.agents) lines.push(`| ${agent.name} (${agent.agentId}) | ${agent.designScore} | ${agent.overallScore} | ${agent.confidence} | ${agent.issues.length} |`)
  lines.push('', '## Details', '')
  for (const agent of report.agents) {
    lines.push(`### ${agent.name} (${agent.agentId})`, '', `- Design score: ${agent.designScore}`, `- Overall score: ${agent.overallScore}`, `- Skills: ${agent.skills.join(', ') || 'none'}`, `- Connectors: ${agent.connectors.join(', ') || 'none'}`)
    if (agent.issues.length) {
      lines.push('- Issues:')
      for (const issue of agent.issues) lines.push(`  - [${issue.severity}] ${issue.message}`)
    } else lines.push('- Issues: none')
    lines.push('')
  }
  return lines.join('\n')
}

module.exports = { DESIGN_WEIGHTS, RUNTIME_WEIGHTS, parseFrontmatter, evaluateExpertPackage, scoreRuntimeTasks, evaluateAgents, toMarkdown }

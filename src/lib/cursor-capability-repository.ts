'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { parseSkillFrontmatter } = require('./skill-runtime')
const { deriveExpertDisplayName } = require('./expert-display-name')
const { scanSecrets } = require('./capability-import')
const { resolvePaths } = require('./capability-store')
const { ARTBUNDLE_RECIPE_ID, enrichExternalWorkflowPackage } = require('./external-workflow-recipes')
const {
  SIDECAR_FILE,
  adaptLegacyCapability,
  serializeSidecar,
} = require('./capability-manifest-v2')

const LIMITS = Object.freeze({
  skills: 200,
  agents: 100,
  connectors: 64,
  workflows: 64,
  fileBytes: 2 * 1024 * 1024,
})

const KNOWLEDGE_EXTENSIONS = new Set(['.md', '.markdown', '.txt'])

function scanRepositoryKnowledge(root) {
  const files = []
  const roots = ['knowledge', 'docs', '.cursor/rules', '.cursor/skills']
  const visit = (dir, base, depth = 0) => {
    if (files.length >= 500 || depth > 6 || !fs.existsSync(dir)) return
    let entries = []
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      if (files.length >= 500 || entry.name.startsWith('.') && entry.name !== '.cursor') continue
      const abs = path.join(dir, entry.name)
      if (entry.isDirectory() && !['node_modules', '.git'].includes(entry.name)) visit(abs, base, depth + 1)
      else if (entry.isFile() && KNOWLEDGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        files.push({ path: path.relative(base, abs).replace(/\\/g, '/'), bytes: fs.statSync(abs).size })
      }
    }
  }
  visit(root, root)
  return files
}

function fail(code, error, extra = {}) {
  return { ok: false, code, error, ...extra }
}

function hashText(text) {
  return `sha256:${crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex')}`
}

function slug(value, fallback = 'cursor-repo') {
  const out = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return out || fallback
}

function safeReadText(file) {
  try {
    const stat = fs.statSync(file)
    if (!stat.isFile() || stat.size > LIMITS.fileBytes) return ''
    return fs.readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}

function safeReadJson(file) {
  const text = safeReadText(file)
  if (!text) return null
  try {
    const value = JSON.parse(text)
    return value && typeof value === 'object' ? value : null
  } catch {
    return null
  }
}

function pathInside(root, target) {
  const resolvedRoot = path.resolve(root)
  const resolvedTarget = path.resolve(target)
  const rel = path.relative(resolvedRoot, resolvedTarget)
  return rel === '' || rel === '.' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

function safeChildDirectories(parent, limit) {
  if (!fs.existsSync(parent)) return []
  try {
    return fs.readdirSync(parent, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink() && !entry.name.startsWith('.'))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit)
  } catch {
    return []
  }
}

function parseAgentMarkdown(content) {
  const text = String(content || '')
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return { frontmatter: {}, body: text.trim() }
  const lines = match[1].split(/\r?\n/)
  const frontmatter = {}
  let blockKey = ''
  let inPersona = false
  for (const raw of lines) {
    const top = raw.match(/^([a-zA-Z0-9_.-]+):\s*(.*)$/)
    if (top) {
      const key = top[1]
      const value = top[2].trim()
      inPersona = key === 'persona'
      blockKey = value === '>-' || value === '>' || value === '|' ? key : ''
      if (!blockKey && key !== 'persona') {
        frontmatter[key] = value.replace(/^["']|["']$/g, '')
      }
      continue
    }
    const nested = raw.match(/^\s+([a-zA-Z0-9_.-]+):\s*(.*)$/)
    if (inPersona && nested) {
      frontmatter.persona = frontmatter.persona || {}
      frontmatter.persona[nested[1]] = nested[2].trim().replace(/^["']|["']$/g, '')
      continue
    }
    if (blockKey && /^\s+/.test(raw)) {
      frontmatter[blockKey] = [frontmatter[blockKey], raw.trim()].filter(Boolean).join(' ')
    }
  }
  return { frontmatter, body: match[2].trim() }
}

function normalizeSkillGroups(manifest) {
  const raw = manifest?.skills
  if (Array.isArray(raw)) return { required: raw.map(String), optional: [] }
  if (!raw || typeof raw !== 'object') return { required: [], optional: [] }
  return {
    required: (Array.isArray(raw.required) ? raw.required : []).map(String),
    optional: (Array.isArray(raw.optional) ? raw.optional : []).map(String),
  }
}

function normalizeDeclaredSkills(manifest) {
  const groups = normalizeSkillGroups(manifest)
  return [...new Set([...groups.required, ...groups.optional])]
}

function repositoryIdentity(root) {
  const normalized = path.resolve(root)
  const key = process.platform === 'win32' ? normalized.toLowerCase() : normalized
  const suffix = crypto.createHash('sha256').update(key).digest('hex').slice(0, 10)
  return `${slug(path.basename(normalized))}-${suffix}`
}

function scanSkills(root, warnings) {
  const skillsDir = path.join(root, '.cursor', 'skills')
  const entries = safeChildDirectories(skillsDir, LIMITS.skills)
  const skills = []
  for (const entry of entries) {
    const dir = path.join(skillsDir, entry.name)
    const skillFile = path.join(dir, 'SKILL.md')
    const content = safeReadText(skillFile)
    if (!content) continue
    const parsed = parseSkillFrontmatter(content)
    if (!parsed.ok || !parsed.name) {
      warnings.push({ code: 'invalid_skill', path: path.relative(root, skillFile), message: `技能 ${entry.name} 缺少合法 frontmatter/name` })
      continue
    }
    skills.push({
      kind: 'skill',
      sourceId: entry.name,
      id: slug(entry.name, 'skill'),
      name: parsed.name,
      description: parsed.description || parsed.name,
      version: String(parsed.frontmatter.version || '1.0.0'),
      originPath: path.relative(root, dir).replace(/\\/g, '/'),
      contentHash: hashText(content),
      body: parsed.body,
    })
  }
  if (entries.length >= LIMITS.skills) {
    warnings.push({ code: 'skill_limit', message: `技能扫描最多 ${LIMITS.skills} 个目录` })
  }
  return skills
}

function scanAgents(root, skills, warnings) {
  const agentsDir = path.join(root, '.cursor', 'agents')
  const entries = safeChildDirectories(agentsDir, LIMITS.agents)
  const skillIds = new Set(skills.map((item) => item.sourceId))
  const agents = []
  for (const entry of entries) {
    const dir = path.join(agentsDir, entry.name)
    const markdown = safeReadText(path.join(dir, 'AGENT.md'))
    const manifest = safeReadJson(path.join(dir, 'agent.manifest.json')) || {}
    if (!markdown && !Object.keys(manifest).length) continue
    const parsed = parseAgentMarkdown(markdown)
    const skillGroups = normalizeSkillGroups(manifest)
    const declared = normalizeDeclaredSkills(manifest)
    const missingSkills = declared.filter((id) => !skillIds.has(id))
    if (missingSkills.length) {
      warnings.push({
        code: 'missing_agent_skills',
        path: path.relative(root, dir).replace(/\\/g, '/'),
        message: `${entry.name} 声明了未发现技能：${missingSkills.join(', ')}`,
      })
    }
    const originName = String(parsed.frontmatter.name || manifest.title || manifest.id || entry.name).trim()
    const description = String(
      parsed.frontmatter.description
      || manifest.display?.summary
      || parsed.frontmatter.persona?.role
      || originName,
    ).trim()
    const name = deriveExpertDisplayName({
      name: originName,
      description,
      persona: parsed.frontmatter.persona,
      frontmatter: { ...parsed.frontmatter, ...manifest },
    }).name
    const systemPrompt = parsed.body || description
    agents.push({
      kind: 'expert',
      sourceId: String(manifest.id || entry.name),
      id: slug(manifest.id || entry.name, 'expert'),
      name,
      originName,
      description,
      version: String(manifest.version || '1.0.0'),
      originPath: path.relative(root, dir).replace(/\\/g, '/'),
      systemPrompt,
      declaredSkills: declared.filter((id) => skillIds.has(id)),
      requiredSkills: skillGroups.required.filter((id) => skillIds.has(id)),
      optionalSkills: skillGroups.optional.filter((id) => skillIds.has(id)),
      missingSkills,
      declaredConnectors: Array.isArray(manifest.connectors)
        ? manifest.connectors.map(item => String(item?.id || item || '').trim()).filter(Boolean)
        : [],
      contentHash: hashText(`${markdown}\n${JSON.stringify(manifest)}`),
    })
  }
  if (entries.length >= LIMITS.agents) {
    warnings.push({ code: 'agent_limit', message: `专家扫描最多 ${LIMITS.agents} 个目录` })
  }
  return agents
}

function scanConnectors(root, warnings) {
  const file = path.join(root, '.cursor', 'mcp.json')
  const mcp = safeReadJson(file)
  if (!mcp) return []
  const servers = mcp.mcpServers && typeof mcp.mcpServers === 'object' ? mcp.mcpServers : {}
  const connectors = []
  for (const [sourceId, raw] of Object.entries(servers).slice(0, LIMITS.connectors)) {
    if (!raw || typeof raw !== 'object') continue
    const rawUrl = String(raw.url || '').trim()
    const transport = rawUrl
      ? (raw.type === 'sse' || /\/sse(?:[/?#]|$)/i.test(rawUrl) ? 'sse' : 'streamable-http')
      : 'stdio'
    if (transport === 'stdio' && !raw.command) {
      warnings.push({ code: 'invalid_mcp', path: `.cursor/mcp.json#${sourceId}`, message: `${sourceId} 缺少 stdio command` })
      continue
    }
    let cleanUrl = rawUrl
    const secretSlots = []
    if (rawUrl) {
      try {
        const parsed = new URL(rawUrl)
        if (parsed.username || parsed.password) {
          secretSlots.push({ key: 'url_credentials', label: 'URL credentials', required: true, target: 'header', name: 'Authorization' })
          parsed.username = ''
          parsed.password = ''
        }
        for (const key of [...parsed.searchParams.keys()]) {
          if (/(?:token|secret|password|api[_-]?key|auth)/i.test(key)) {
            secretSlots.push({ key: slug(key, 'url_secret'), label: key, required: true, target: 'header', name: key })
            parsed.searchParams.delete(key)
          }
        }
        cleanUrl = parsed.toString()
      } catch {
        warnings.push({ code: 'invalid_mcp_url', path: `.cursor/mcp.json#${sourceId}`, message: `${sourceId} URL 无效` })
        cleanUrl = ''
      }
    }
    const cleanEnv = {}
    for (const [key, value] of Object.entries(raw.env && typeof raw.env === 'object' ? raw.env : {})) {
      const sensitive = /(?:token|secret|password|api[_-]?key|authorization|credential)/i.test(key)
        || Boolean(scanSecrets({ [key]: value }))
      if (sensitive) secretSlots.push({ key: slug(key, 'env_secret'), label: key, required: true, target: 'env', name: key })
      else cleanEnv[key] = String(value || '').slice(0, 600)
    }
    for (const [key] of Object.entries(raw.headers && typeof raw.headers === 'object' ? raw.headers : {})) {
      const bearer = /^authorization$/i.test(key)
      secretSlots.push({ key: bearer ? 'access_token' : slug(key, 'header_secret'), label: key, required: true, target: bearer ? 'bearer' : 'header', name: key })
    }
    const uniqueSecretSlots = [...new Map(secretSlots.map(slot => [slot.key, slot])).values()]
    if (uniqueSecretSlots.length) {
      warnings.push({ code: 'mcp_secret_stripped', path: `.cursor/mcp.json#${sourceId}`, message: `${sourceId} 的敏感值已剥离；导入后需在能力中心重新配置` })
    }
    let cwd = String(raw.cwd || '').trim()
    if (cwd) {
      cwd = path.isAbsolute(cwd) ? path.resolve(cwd) : path.resolve(root, cwd)
      if (!pathInside(root, cwd)) {
        warnings.push({ code: 'mcp_cwd_escape', path: `.cursor/mcp.json#${sourceId}`, message: `${sourceId} 的 cwd 超出仓库，已阻止连接器注册` })
        cwd = ''
      }
    } else {
      cwd = root
    }
    connectors.push({
      kind: 'connector',
      sourceId,
      id: slug(sourceId, 'connector'),
      name: String(raw.name || sourceId),
      description: `来自 ${path.basename(root)} 的 MCP 连接器`,
      version: '1.0.0',
      originPath: `.cursor/mcp.json#${sourceId}`,
      blocked: !cwd || (transport !== 'stdio' && !cleanUrl),
      blockReason: !cwd ? 'cwd 超出仓库' : ((transport !== 'stdio' && !cleanUrl) ? 'MCP URL 无效' : ''),
      configState: uniqueSecretSlots.length ? 'needs_configuration' : 'ready',
      secretSlots: uniqueSecretSlots,
      mcp: {
        transport,
        command: String(raw.command || ''),
        args: Array.isArray(raw.args) ? raw.args.map(String).slice(0, 32) : [],
        cwd,
        url: cleanUrl,
        envKeys: Object.keys(cleanEnv).slice(0, 32),
        env: cleanEnv,
      },
      contentHash: hashText(JSON.stringify({
        transport,
        command: raw.command,
        args: raw.args,
        cwd,
        url: cleanUrl,
        envKeys: Object.keys(cleanEnv),
        secretKeys: uniqueSecretSlots.map(slot => slot.key),
      })),
    })
  }
  return connectors
}

function scanWorkflows(root, warnings) {
  const workflowsDir = path.join(root, '.cursor', 'workflows')
  if (!fs.existsSync(workflowsDir)) return []
  const index = safeReadJson(path.join(workflowsDir, 'index.json'))
  const indexed = Array.isArray(index?.workflows) ? index.workflows : []
  const candidates = indexed.length
    ? indexed.slice(0, LIMITS.workflows).map((item) => ({
        file: String(item?.path || '').trim(),
        catalog: item?.catalog && typeof item.catalog === 'object' ? item.catalog : {},
        indexed: item,
      }))
    : fs.readdirSync(workflowsDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name !== 'index.json' && entry.name.endsWith('.json'))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, LIMITS.workflows)
      .map((entry) => ({ file: entry.name, catalog: {}, indexed: {} }))

  const workflows = []
  for (const candidate of candidates) {
    const relativeFile = candidate.file.replace(/\\/g, '/')
    if (!relativeFile || path.isAbsolute(relativeFile) || relativeFile.split('/').includes('..')) {
      warnings.push({ code: 'invalid_workflow_path', path: relativeFile, message: '工作流路径必须位于 .cursor/workflows 内' })
      continue
    }
    const file = path.resolve(workflowsDir, relativeFile)
    if (!pathInside(workflowsDir, file)) {
      warnings.push({ code: 'workflow_path_escape', path: relativeFile, message: '工作流路径越界，已跳过' })
      continue
    }
    try {
      const stat = fs.lstatSync(file)
      if (!stat.isFile() || stat.isSymbolicLink()) {
        warnings.push({ code: 'unsafe_workflow_file', path: `.cursor/workflows/${relativeFile}`, message: '工作流必须是普通文件，已跳过' })
        continue
      }
    } catch {
      warnings.push({ code: 'missing_workflow_file', path: `.cursor/workflows/${relativeFile}`, message: '工作流文件不存在或不可读' })
      continue
    }
    const definition = safeReadJson(file)
    if (!definition || !Array.isArray(definition.nodes)) {
      warnings.push({ code: 'invalid_workflow', path: `.cursor/workflows/${relativeFile}`, message: '工作流缺少合法 nodes 数组' })
      continue
    }
    const sourceId = String(definition.id || candidate.indexed?.id || path.basename(relativeFile, '.json')).trim()
    if (!sourceId) continue
    const visibility = String(candidate.catalog?.visibility || 'primary').trim().toLowerCase()
    workflows.push({
      kind: 'workflow',
      sourceId,
      id: slug(sourceId, 'workflow'),
      name: String(definition.name || candidate.indexed?.name || sourceId).trim(),
      description: String(definition.description || candidate.indexed?.description || '').trim(),
      version: String(definition.version || definition.schema_version || '1.0.0'),
      originPath: `.cursor/workflows/${relativeFile}`,
      tags: Array.isArray(definition.tags) ? definition.tags.map(String) : [],
      visibility,
      blocked: visibility === 'deprecated' || visibility === 'hidden',
      blockReason: visibility === 'deprecated' ? '工作流已标记 deprecated' : (visibility === 'hidden' ? '工作流已隐藏' : ''),
      definition,
      contentHash: hashText(JSON.stringify(definition)),
    })
  }
  if (indexed.length > LIMITS.workflows) {
    warnings.push({ code: 'workflow_limit', message: `工作流扫描最多 ${LIMITS.workflows} 个条目` })
  }
  return workflows
}

function selectPrimarySkill(skills, repoName) {
  const repoSlug = slug(repoName)
  const ranked = [...skills].sort((a, b) => {
    function score(item) {
      const id = item.sourceId.toLowerCase()
      let value = 0
      if (id.includes('assistant')) value += 6
      if (id.includes('orchestrator')) value += 5
      if (id.includes(repoSlug)) value += 4
      if (id.includes('guide')) value += 2
      return value
    }
    return score(b) - score(a) || a.sourceId.localeCompare(b.sourceId)
  })
  return ranked[0] || null
}

function scanCursorRepository(folderPath) {
  const requested = String(folderPath || '').trim()
  if (!requested) return fail('invalid_path', '缺少 Cursor 仓库路径')
  let root
  try {
    root = fs.realpathSync(path.resolve(requested))
    const stat = fs.lstatSync(root)
    if (!stat.isDirectory() || stat.isSymbolicLink()) return fail('invalid_path', '仓库路径必须是普通目录')
  } catch {
    return fail('not_found', 'Cursor 仓库目录不存在或不可读')
  }
  const cursorDir = path.join(root, '.cursor')
  if (!fs.existsSync(cursorDir)) return fail('not_cursor_repo', '目录中未发现 .cursor')

  const warnings = []
  const skills = scanSkills(root, warnings)
  const experts = scanAgents(root, skills, warnings)
  const connectors = scanConnectors(root, warnings)
  const workflows = scanWorkflows(root, warnings)
  const knowledge = scanRepositoryKnowledge(root)
  if (!skills.length && !experts.length && !connectors.length && !workflows.length) {
    return fail('no_capabilities', '仓库中未发现可导入的 Cursor 能力')
  }

  const repositoryId = repositoryIdentity(root)
  if (!experts.length && skills.length) {
    const primary = selectPrimarySkill(skills, path.basename(root))
    const originName = primary?.name || path.basename(root)
    const description = primary?.description || `${path.basename(root)} 仓库专家`
    experts.push({
      kind: 'expert',
      sourceId: repositoryId,
      id: repositoryId,
      name: deriveExpertDisplayName({ name: originName, description }).name,
      originName,
      description,
      version: '1.0.0',
      originPath: primary?.originPath || '.cursor/skills',
      systemPrompt: primary?.body || primary?.description || `你是 ${path.basename(root)} 仓库专家。`,
      declaredSkills: skills.map((item) => item.sourceId),
      requiredSkills: skills.map((item) => item.sourceId),
      optionalSkills: [],
      missingSkills: [],
      generated: true,
      contentHash: hashText(`${primary?.contentHash || ''}:${skills.map((item) => item.contentHash).join(':')}`),
    })
  }

  return {
    ok: true,
    repositoryId,
    root,
    name: path.basename(root),
    skills,
    experts,
    connectors,
    workflows,
    knowledge,
    warnings,
    contentHash: hashText([
      ...skills.map((item) => item.contentHash),
      ...experts.map((item) => item.contentHash),
      ...connectors.map((item) => item.contentHash),
      ...workflows.map((item) => item.contentHash),
    ].join(':')),
  }
}

function publicPreview(preview, token = '') {
  if (!preview?.ok) return preview
  const counts = {
    experts: preview.experts.length,
    skills: preview.skills.length,
    connectors: preview.connectors.length,
    workflows: preview.workflows.length,
    knowledge: (preview.knowledge || []).length,
    blocked: [...preview.connectors, ...preview.workflows].filter((item) => item.blocked).length,
  }
  const project = (item) => ({
    kind: item.kind,
    sourceId: item.sourceId,
    id: item.id,
    name: item.name,
    originName: item.originName || '',
    description: item.description,
    version: item.version,
    originPath: item.originPath,
    blocked: item.blocked === true,
    blockReason: item.blockReason || '',
    generated: item.generated === true,
    missingSkills: item.missingSkills || [],
    requiredSkills: item.requiredSkills || [],
    optionalSkills: item.optionalSkills || [],
  })
  return {
    ok: true,
    previewToken: token,
    repositoryId: preview.repositoryId,
    root: preview.root,
    name: preview.name,
    preview: {
      name: preview.name,
      kind: 'cursor-repository',
      risk: {
        level: 'medium',
        reasons: [`专家 ${counts.experts} · 技能 ${counts.skills} · 连接器 ${counts.connectors} · 工作流 ${counts.workflows}`],
      },
      compatibility: { status: 'compatible' },
      estimatedCost: { level: 'medium', estimate: `将注册 ${counts.experts + counts.skills + counts.connectors + counts.workflows - counts.blocked} 项，知识资料 ${counts.knowledge} 份可选入库` },
      rollbackHint: '能力可逐项卸载；导入工作流可在工作流管理中归档。',
      counts,
    },
    counts,
    experts: preview.experts.map(project),
    skills: preview.skills.map(project),
    connectors: preview.connectors.map(project),
    workflows: preview.workflows.map(project),
    knowledge: (preview.knowledge || []).map(item => ({ path: item.path, bytes: item.bytes })),
    warnings: preview.warnings,
  }
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map(value => String(value || '').trim())
    .filter(Boolean))]
}

function planCursorRepositoryImport(preview, options = {}) {
  if (!preview?.ok) return fail('invalid_preview', 'Cursor 仓库预览无效')
  const requestedIds = uniqueStrings(options.workflowIds)
  if (!requestedIds.length) {
    return fail('missing_workflow_selection', '请至少选择一个要导入的工作流')
  }
  const workflowsById = new Map()
  for (const item of preview.workflows || []) {
    workflowsById.set(item.sourceId, item)
    workflowsById.set(item.id, item)
  }
  const skillsById = new Map()
  for (const item of preview.skills || []) {
    skillsById.set(item.sourceId, item)
    skillsById.set(item.id, item)
  }
  // Natural-language requests often list a target workflow followed by entry
  // Skills. Treat known Skill ids as explicit dependencies instead of failing
  // the entire plan because the model placed them in workflow_ids.
  const retypedSkillIds = requestedIds.filter(id => !workflowsById.has(id) && skillsById.has(id))
  const requestedWorkflowIds = requestedIds.filter(id => workflowsById.has(id))
  const workflows = requestedWorkflowIds.map(id => workflowsById.get(id)).filter(Boolean)
  const missingWorkflows = requestedIds.filter(id => !workflowsById.has(id) && !skillsById.has(id))
  if (missingWorkflows.length) {
    return fail('workflow_not_found', `未发现工作流：${missingWorkflows.join(', ')}`)
  }
  if (!workflows.length) return fail('missing_workflow_selection', '请求中没有可导入的工作流')
  const blockedWorkflows = workflows.filter(item => item.blocked)
  if (blockedWorkflows.length) {
    return fail('workflow_blocked', `工作流不可导入：${blockedWorkflows.map(item => item.sourceId).join(', ')}`)
  }

  const agentSourceIds = new Set()
  const workflowSkillIds = new Set()
  for (const workflow of workflows) {
    for (const node of workflow.definition?.nodes || []) {
      if (String(node?.type || 'agent') === 'agent') {
        const id = String(node.agent || node.agentPackageId || '').trim()
        if (id) agentSourceIds.add(id)
      }
      for (const value of [node?.skill, node?.skillId, node?.skill_ref, node?.skillRef]) {
        const id = String(value || '').trim()
        if (id) workflowSkillIds.add(id)
      }
    }
    const declaredWorkflowSkills = Array.isArray(workflow.definition?.skills)
      ? workflow.definition.skills
      : (Array.isArray(workflow.definition?.skill_refs) ? workflow.definition.skill_refs : [])
    for (const value of declaredWorkflowSkills) {
      const id = String(value?.id || value || '').trim()
      if (id) workflowSkillIds.add(id)
    }
  }

  const expertsById = new Map()
  for (const item of preview.experts || []) {
    expertsById.set(item.sourceId, item)
    expertsById.set(item.id, item)
  }
  const missingExperts = [...agentSourceIds].filter(id => !expertsById.has(id))
  if (missingExperts.length) {
    return fail('workflow_expert_missing', `工作流引用了未发现专家：${missingExperts.join(', ')}`)
  }
  const experts = [...new Set([...agentSourceIds].map(id => expertsById.get(id)))]

  const selectedSkillIds = new Set(uniqueStrings([...(options.additionalSkillIds || []), ...retypedSkillIds]))
  for (const id of workflowSkillIds) selectedSkillIds.add(id)
  for (const expert of experts) {
    for (const id of expert.requiredSkills || expert.declaredSkills || []) selectedSkillIds.add(id)
    if (options.includeOptionalSkills === true) {
      for (const id of expert.optionalSkills || []) selectedSkillIds.add(id)
    }
  }
  const missingSkills = [...selectedSkillIds].filter(id => !skillsById.has(id))
  if (missingSkills.length) {
    return fail('workflow_skill_missing', `规划引用了未发现技能：${missingSkills.join(', ')}`)
  }
  const skills = [...new Set([...selectedSkillIds].map(id => skillsById.get(id)))]
  const selectedSkillSourceIds = new Set(skills.map(item => item.sourceId))
  const scopedExperts = experts.map(item => ({
    ...item,
    declaredSkills: (item.declaredSkills || []).filter(id => selectedSkillSourceIds.has(id)),
    requiredSkills: (item.requiredSkills || []).filter(id => selectedSkillSourceIds.has(id)),
    optionalSkills: (item.optionalSkills || []).filter(id => selectedSkillSourceIds.has(id)),
    missingSkills: [],
  }))
  const connectors = options.includeConnectors === false ? [] : (preview.connectors || [])
  const scopedPreview = {
    ...preview,
    skills,
    experts: scopedExperts,
    connectors,
    knowledge: options.knowledgeMode === 'rag' ? (preview.knowledge || []) : [],
    workflows,
    selection: {
      workflowIds: workflows.map(item => item.sourceId),
      additionalSkillIds: uniqueStrings([...(options.additionalSkillIds || []), ...retypedSkillIds]),
      includeOptionalSkills: options.includeOptionalSkills === true,
      includeConnectors: options.includeConnectors !== false,
      knowledgeMode: ['rag', 'source'].includes(options.knowledgeMode) ? options.knowledgeMode : 'none',
    },
  }
  return {
    ok: true,
    preview: scopedPreview,
    plan: {
      repositoryId: preview.repositoryId,
      root: preview.root,
      workflows: workflows.map(item => ({ id: item.sourceId, name: item.name, nodes: item.definition?.nodes?.length || 0 })),
      experts: scopedExperts.map(item => ({ id: item.sourceId, name: item.name, requiredSkills: item.requiredSkills, optionalSkills: item.optionalSkills })),
      skills: skills.map(item => ({ id: item.sourceId, name: item.name })),
      connectors: connectors.map(item => ({ id: item.sourceId, name: item.name, blocked: item.blocked === true, blockReason: item.blockReason || '' })),
      counts: { workflows: workflows.length, experts: scopedExperts.length, skills: skills.length, connectors: connectors.length },
      selection: scopedPreview.selection,
      warnings: preview.warnings || [],
      knowledge: {
        mode: scopedPreview.selection.knowledgeMode,
        files: scopedPreview.knowledge.length,
      },
    },
  }
}

function chooseWorkflowId(item, repositoryId, workflowStore) {
  const base = slug(item.id || item.sourceId, 'workflow')
  const packages = workflowStore?.list?.().packages || []
  const existing = packages.find((pkg) => pkg.id === base)
  if (!existing || existing.provenance?.repositoryId === repositoryId) return base
  const byId = new Map(packages.map(pkg => [pkg.id, pkg]))
  let candidate = `${repositoryId}--${base}`.slice(0, 64)
  let suffix = 2
  while (byId.has(candidate) && byId.get(candidate)?.provenance?.repositoryId !== repositoryId) {
    const tail = `-${suffix}`
    candidate = `${repositoryId}--${base}`.slice(0, 64 - tail.length) + tail
    suffix += 1
  }
  return candidate
}

function inferWorkflowDomain(item = {}) {
  const explicit = String(item.domain || '').trim().toLowerCase()
  if (['office', 'engineering', 'visual'].includes(explicit)) return explicit
  const text = [item.name, item.description, ...(Array.isArray(item.tags) ? item.tags : [])]
    .map(value => String(value || '').toLowerCase())
    .join(' ')
  if (/(visual|design|image|\bui\b|\bux\b|\bart\b|graphic|psd|photoshop|sprite|artbundle|视觉|美术|设计|图像|生图|切图)/i.test(text)) return 'visual'
  if (/(office|meeting|minutes|calendar|mail|document|spreadsheet|办公|会议|纪要|日程|邮件|文档|表格)/i.test(text)) return 'office'
  if (/(engineering|\beng\b|\bdev\b|code|coding|test|release|deploy|研发|开发|代码|测试|发布|部署)/i.test(text)) return 'engineering'
  return ''
}

function mapWorkflowPackage(item, preview, idMaps) {
  const definition = item.definition || {}
  const nodes = []
  const edges = []
  const gates = []
  const edgeKeys = new Set()
  const expertIds = new Set()

  function addEdge(from, to, label) {
    const source = String(from || '').trim()
    const target = String(to || '').trim()
    if (!source || !target) return
    const key = `${source}->${target}:${label || ''}`
    if (edgeKeys.has(key)) return
    edgeKeys.add(key)
    edges.push({ from: source, to: target, label: String(label || '').trim() })
  }

  for (const raw of definition.nodes || []) {
    const id = String(raw?.id || '').trim()
    if (!id) continue
    const type = String(raw.type || 'agent').trim()
    if (type === 'agent') {
      const sourceAgent = String(raw.agent || raw.agentPackageId || '').trim()
      const agentPackageId = idMaps.experts[sourceAgent] || ''
      if (agentPackageId) expertIds.add(agentPackageId)
      nodes.push({
        id,
        type: 'agent',
        agentPackageId,
        agentOrigin: 'local',
        role: String(raw.role || raw.node_key || sourceAgent || id),
        intent: String(raw.intent || ''),
        name: String(raw.name || raw.node_key || sourceAgent || id),
        inputs: raw.input || {},
        outputs: raw.output || {},
      })
    } else if (type === 'gate') {
      const gateRef = String(raw.gate_id || raw.gateRef || id).trim()
      nodes.push({ id, type: 'gate', gateRef, intent: String(raw.intent || ''), name: String(raw.name || raw.intent || gateRef) })
      gates.push({
        id: gateRef,
        title: String(raw.name || raw.intent || gateRef),
        type: 'approval',
        description: String(raw.intent || ''),
        params: { requiresUserApproval: true },
      })
    } else {
      nodes.push({
        id,
        type: type === 'terminal' ? 'terminal' : type,
        status: String(raw.status || ''),
        actionRef: String(raw.action_ref || raw.actionRef || ''),
        humanRole: String(raw.human_role || raw.humanRole || ''),
        intent: String(raw.intent || ''),
        name: String(raw.name || raw.intent || id),
        inputs: raw.input || {},
        outputs: raw.output || {},
      })
    }
    addEdge(id, raw.next, '')
    addEdge(id, raw.on_approve, '通过')
    addEdge(id, raw.on_reject, '驳回')
    addEdge(id, raw.on_revise, '返工')
    addEdge(id, raw.on_fail_goto, '失败')
  }

  const skillIds = Object.values(idMaps.skills)
  const domain = inferWorkflowDomain(item)
  const importedConnectorDependencies = item.sourceId === ARTBUNDLE_RECIPE_ID
    ? Object.entries(idMaps.connectors).map(([sourceId, id]) => ({
        id,
        kind: 'connector',
        required: /photoshop/i.test(sourceId),
        reason: `由外部项目连接器 ${sourceId} 提供`,
      }))
    : []
  return enrichExternalWorkflowPackage({
    id: chooseWorkflowId(item, preview.repositoryId, preview.workflowStore),
    name: item.name,
    description: item.description,
    source: 'team',
    status: 'draft',
    version: item.version,
    goalTypes: uniqueStrings([...(item.tags || []), domain]),
    inputs: [{ id: 'request', label: '任务目标与源文件路径', required: true }],
    outputs: [{ id: 'delivery', label: '工作流交付物与验收证据' }],
    agentRefs: [...expertIds].map(id => ({ id })),
    skillRefs: skillIds.map(id => ({ id })),
    connectorDependencies: importedConnectorDependencies,
    executionBackends: ['local-team'],
    qualityGates: gates.map(gate => ({ id: gate.id, label: gate.title })),
    provenance: {
      kind: 'cursor-repository',
      repositoryId: preview.repositoryId,
      root: preview.root,
      ref: item.originPath,
      sourceId: item.sourceId,
      contentHash: item.contentHash,
      ...(domain ? { domain } : {}),
    },
    graph: {
      template: 'external-import',
      goal: item.description || item.name,
      members: nodes.filter(node => node.type === 'agent').map(node => ({
        id: node.id,
        agentPackageId: node.agentPackageId,
        expertId: node.agentPackageId,
        agentOrigin: 'local',
        role: node.role,
        intent: node.intent,
      })),
      nodes,
      edges,
      gates,
      parallelism: 1,
      joinStrategy: 'allSucceeded',
    },
  })
}

function chooseInstallId(desired, kind, originPath, repositoryId, entries, claimed) {
  const base = slug(desired, kind)
  const existing = entries[base]
  if (!claimed.has(base) && (!existing || (
    existing.repositoryId === repositoryId
    && existing.originPath === originPath
    && existing.kind === kind
  ))) return base
  let candidate = `${repositoryId}--${base}`.slice(0, 64)
  let suffix = 2
  while (claimed.has(candidate) || (entries[candidate] && !(
    entries[candidate].repositoryId === repositoryId
    && entries[candidate].originPath === originPath
    && entries[candidate].kind === kind
  ))) {
    const tail = `-${suffix}`
    candidate = `${repositoryId}--${base}`.slice(0, 64 - tail.length) + tail
    suffix += 1
  }
  return candidate
}

function writeConnectorManifest(userData, id, item) {
  const paths = resolvePaths(userData)
  const dir = path.join(paths.connectors, id)
  fs.mkdirSync(dir, { recursive: true })
  const manifest = {
    id,
    kind: 'connector',
    name: item.name,
    description: item.description,
    version: item.version,
    type: 'mcp',
    mcp: item.mcp,
    allowlist: [],
    secretSlots: item.secretSlots || [],
    configState: item.configState || 'ready',
    repositoryId: item.repositoryId,
    originPath: item.originPath,
  }
  fs.writeFileSync(path.join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
}

function buildRepositoryManifest(kind, id, item, preview, raw = {}) {
  return adaptLegacyCapability(kind, {
    ...raw,
    id,
    name: item.name,
    description: item.description,
    version: item.version,
  }, {
    id,
    name: item.name,
    description: item.description,
    version: item.version,
    source: 'local-repo',
    ref: `${preview.root}#${item.originPath}`,
    trust: 'user_confirmed',
    contentHash: item.contentHash,
    adaptedFrom: kind === 'skill' ? 'Cursor SKILL.md'
      : (kind === 'expert' ? 'Cursor AGENT.md' : 'Cursor mcp.json'),
    hasScripts: kind === 'skill' && fs.existsSync(path.join(preview.root, item.originPath, 'scripts')),
  })
}

function registerCursorRepository(preview, deps = {}) {
  if (!preview?.ok) return fail('invalid_preview', 'Cursor 仓库预览无效')
  const store = deps.store
  const catalog = deps.catalog
  const expertRuntime = deps.expertRuntime
  const connectorsApi = deps.connectorsApi
  const workflowStore = deps.workflowStore
  const userData = String(deps.userData || '')
  if (!store || !catalog || !expertRuntime) return fail('invalid_deps', '仓库注册服务未配置')

  const current = store.loadInstallStore()
  const entries = current.entries || {}
  const claimed = new Set()
  const idMaps = { skills: {}, experts: {}, connectors: {}, workflows: {} }
  const result = { installed: [], skipped: [], failed: [], idMaps }

  for (const item of preview.skills) {
    const id = chooseInstallId(item.id, 'skill', item.originPath, preview.repositoryId, entries, claimed)
    claimed.add(id)
    idMaps.skills[item.sourceId] = id
    const unified = buildRepositoryManifest('skill', id, item, preview)
    if (!unified.ok) {
      result.failed.push({ kind: 'skill', sourceId: item.sourceId, error: unified.issues?.[0]?.message || '统一声明无效' })
      continue
    }
    const stored = store.upsertEntry({
      id,
      kind: 'skill',
      source: 'local-repo',
      version: item.version,
      status: 'enabled',
      enabled: true,
      trust: 'user_confirmed',
      contentHash: item.contentHash,
      linked: true,
      originRoot: preview.root,
      originPath: item.originPath,
      repositoryId: preview.repositoryId,
      name: item.name,
      description: item.description,
      manifest: unified.manifest,
    })
    if (!stored.ok) {
      result.failed.push({ kind: 'skill', sourceId: item.sourceId, error: stored.error })
      continue
    }
    catalog.upsertOverlayEntry({
      id,
      kind: 'skill',
      name: item.name,
      description: item.description,
      version: item.version,
      source: 'local-repo',
      trust: 'user_confirmed',
      categories: ['研发'],
      tags: ['Cursor', preview.name],
      contentHash: item.contentHash,
      manifest: unified.manifest,
      dependencies: unified.manifest.dependencies,
      permissions: unified.manifest.permissions,
      inputs: unified.manifest.inputs,
      outputs: unified.manifest.outputs,
      risk: unified.manifest.risk,
      provenance: unified.manifest.provenance,
    })
    result.installed.push({ id, kind: 'skill', name: item.name })
  }

  for (const item of preview.connectors) {
    if (item.blocked) {
      result.skipped.push({ kind: 'connector', sourceId: item.sourceId, error: item.blockReason || '连接器已阻止' })
      continue
    }
    const id = chooseInstallId(item.id, 'connector', item.originPath, preview.repositoryId, entries, claimed)
    claimed.add(id)
    idMaps.connectors[item.sourceId] = id
    item.repositoryId = preview.repositoryId
    try {
      const unified = buildRepositoryManifest('connector', id, item, preview, {
        type: 'mcp',
        mcp: item.mcp,
        allowlist: [],
        secretSlots: item.secretSlots || [],
        configState: item.configState || 'ready',
      })
      if (!unified.ok) throw new Error(unified.issues?.[0]?.message || '统一声明无效')
      writeConnectorManifest(userData, id, item)
      connectorsApi?.upsertConnector?.({
        id,
        title: item.name,
        type: 'mcp',
        enabled: true,
        agentVisible: true,
        allowlist: [],
        mcp: item.mcp,
        secretSlots: item.secretSlots || [],
        configState: item.configState || 'ready',
        meta: { identityHint: `来自 Cursor 仓库 ${preview.name}；环境变量值不由 KnowMe 保存` },
      })
      store.upsertEntry({
        id,
        kind: 'connector',
        source: 'local-repo',
        version: item.version,
        status: 'enabled',
        enabled: true,
        trust: 'user_confirmed',
        contentHash: item.contentHash,
        originRoot: preview.root,
        originPath: item.originPath,
        repositoryId: preview.repositoryId,
        name: item.name,
        description: item.description,
        manifest: unified.manifest,
      })
      const connectorSidecar = serializeSidecar(unified.manifest)
      if (connectorSidecar.ok) {
        fs.writeFileSync(path.join(resolvePaths(userData).connectors, id, SIDECAR_FILE), connectorSidecar.content, 'utf8')
      }
      catalog.upsertOverlayEntry({
        id,
        kind: 'connector',
        name: item.name,
        description: item.description,
        version: item.version,
        source: 'local-repo',
        trust: 'user_confirmed',
        categories: ['MCP'],
        tags: ['Cursor', preview.name],
        contentHash: item.contentHash,
        manifest: unified.manifest,
        dependencies: unified.manifest.dependencies,
        permissions: unified.manifest.permissions,
        inputs: unified.manifest.inputs,
        outputs: unified.manifest.outputs,
        risk: unified.manifest.risk,
        provenance: unified.manifest.provenance,
      })
      result.installed.push({ id, kind: 'connector', name: item.name })
    } catch (err) {
      result.failed.push({ kind: 'connector', sourceId: item.sourceId, error: err.message || '连接器注册失败' })
    }
  }

  const allConnectorIds = Object.values(idMaps.connectors)
  for (const source of preview.experts) {
    const id = chooseInstallId(source.id, 'expert', source.originPath, preview.repositoryId, entries, claimed)
    claimed.add(id)
    idMaps.experts[source.sourceId] = id
    const previous = entries[id]
    const userNamed = previous?.nameSource === 'user' && previous.name
    const item = userNamed ? { ...source, name: previous.name } : source
    const originName = item.originName || previous?.originName || ''
    const boundSkills = (item.declaredSkills.length ? item.declaredSkills : preview.skills.map((skill) => skill.sourceId))
      .map((sourceId) => idMaps.skills[sourceId])
      .filter(Boolean)
    const boundConnectors = (item.declaredConnectors?.length
      ? item.declaredConnectors.map(sourceId => idMaps.connectors[sourceId])
      : allConnectorIds).filter(Boolean)
    const unified = buildRepositoryManifest('expert', id, item, preview, {
      skills: boundSkills,
      connectors: boundConnectors,
    })
    if (!unified.ok) {
      result.failed.push({ kind: 'expert', sourceId: item.sourceId, error: unified.issues?.[0]?.message || '统一声明无效' })
      continue
    }
    const saved = expertRuntime.saveExpert(id, {
      name: item.name,
      originName,
      description: item.description,
      avatar: '',
      skills: boundSkills,
      connectors: boundConnectors,
      systemPrompt: item.systemPrompt,
    })
    if (!saved.ok) {
      result.failed.push({ kind: 'expert', sourceId: item.sourceId, error: saved.message || '专家注册失败' })
      continue
    }
    store.upsertEntry({
      id,
      kind: 'expert',
      source: 'local-repo',
      version: item.version,
      status: 'enabled',
      enabled: true,
      trust: 'user_confirmed',
      contentHash: saved.contentHash,
      originRoot: preview.root,
      originPath: item.originPath,
      repositoryId: preview.repositoryId,
      name: item.name,
      originName,
      nameSource: userNamed ? 'user' : 'import',
      description: item.description,
      manifest: unified.manifest,
    })
    const expertSidecar = serializeSidecar(unified.manifest)
    if (expertSidecar.ok) {
      fs.writeFileSync(path.join(resolvePaths(userData).experts, id, SIDECAR_FILE), expertSidecar.content, 'utf8')
    }
    catalog.upsertOverlayEntry({
      id,
      kind: 'expert',
      name: item.name,
      originName,
      nameSource: userNamed ? 'user' : 'import',
      description: item.description,
      version: item.version,
      source: 'local-repo',
      trust: 'user_confirmed',
      categories: ['研发'],
      tags: ['Cursor', preview.name],
      contentHash: saved.contentHash,
      manifest: unified.manifest,
      dependencies: unified.manifest.dependencies,
      permissions: unified.manifest.permissions,
      inputs: unified.manifest.inputs,
      outputs: unified.manifest.outputs,
      risk: unified.manifest.risk,
      provenance: unified.manifest.provenance,
    })
    result.installed.push({ id, kind: 'expert', name: item.name })
  }

  for (const item of preview.workflows || []) {
    if (item.blocked) {
      result.skipped.push({ kind: 'workflow', sourceId: item.sourceId, error: item.blockReason || '工作流已阻止' })
      continue
    }
    if (!workflowStore || typeof workflowStore.save !== 'function') {
      result.failed.push({ kind: 'workflow', sourceId: item.sourceId, error: '工作流存储服务未配置' })
      continue
    }
    const packageInput = mapWorkflowPackage(item, { ...preview, workflowStore }, idMaps)
    const unresolved = packageInput.graph.nodes
      .filter(node => node.type === 'agent' && !node.agentPackageId)
      .map(node => node.id)
    if (unresolved.length) {
      result.failed.push({
        kind: 'workflow',
        sourceId: item.sourceId,
        error: `工作流引用了未导入专家节点：${unresolved.join(', ')}`,
      })
      continue
    }
    const saved = workflowStore.save(packageInput)
    if (!saved?.ok) {
      result.failed.push({ kind: 'workflow', sourceId: item.sourceId, error: saved?.error || saved?.issues?.[0]?.message || '工作流注册失败' })
      continue
    }
    idMaps.workflows[item.sourceId] = saved.package.id
    result.installed.push({ id: saved.package.id, kind: 'workflow', name: saved.package.name })
  }

  return {
    ok: result.installed.length > 0,
    repositoryId: preview.repositoryId,
    root: preview.root,
    ...result,
    counts: {
      installed: result.installed.length,
      skipped: result.skipped.length,
      failed: result.failed.length,
    },
  }
}

module.exports = {
  LIMITS,
  repositoryIdentity,
  scanCursorRepository,
  publicPreview,
  registerCursorRepository,
  selectPrimarySkill,
  pathInside,
  scanWorkflows,
  planCursorRepositoryImport,
  mapWorkflowPackage,
  inferWorkflowDomain,
}

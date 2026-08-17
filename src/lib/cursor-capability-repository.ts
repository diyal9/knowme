'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { parseSkillFrontmatter } = require('./skill-runtime')
const { deriveExpertDisplayName } = require('./expert-display-name')
const { scanSecrets } = require('./capability-import')
const { resolvePaths } = require('./capability-store')
const {
  SIDECAR_FILE,
  adaptLegacyCapability,
  serializeSidecar,
} = require('./capability-manifest-v2')

const LIMITS = Object.freeze({
  skills: 200,
  agents: 100,
  connectors: 64,
  fileBytes: 2 * 1024 * 1024,
})

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

function normalizeDeclaredSkills(manifest) {
  const raw = manifest?.skills
  if (Array.isArray(raw)) return raw.map(String)
  if (!raw || typeof raw !== 'object') return []
  return [...(Array.isArray(raw.required) ? raw.required : []), ...(Array.isArray(raw.optional) ? raw.optional : [])]
    .map(String)
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
      missingSkills,
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
    if (!raw.command || raw.url || raw.type === 'http' || raw.type === 'sse') {
      warnings.push({ code: 'unsupported_mcp', path: `.cursor/mcp.json#${sourceId}`, message: `${sourceId} 不是受支持的 stdio MCP 配置` })
      continue
    }
    const secretHit = scanSecrets(raw.env || {})
    const blocked = Boolean(secretHit)
    if (blocked) {
      warnings.push({ code: 'mcp_secret', path: `.cursor/mcp.json#${sourceId}`, message: `${sourceId} 含明文敏感字段，已阻止连接器注册` })
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
      blocked: blocked || !cwd,
      blockReason: blocked ? secretHit.error : (!cwd ? 'cwd 超出仓库' : ''),
      mcp: {
        command: String(raw.command),
        args: Array.isArray(raw.args) ? raw.args.map(String).slice(0, 32) : [],
        cwd,
        envKeys: raw.env && typeof raw.env === 'object' ? Object.keys(raw.env).slice(0, 32) : [],
      },
      contentHash: hashText(JSON.stringify({
        command: raw.command,
        args: raw.args,
        cwd,
        envKeys: raw.env && typeof raw.env === 'object' ? Object.keys(raw.env) : [],
      })),
    })
  }
  return connectors
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
  if (!skills.length && !experts.length && !connectors.length) {
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
    warnings,
    contentHash: hashText([
      ...skills.map((item) => item.contentHash),
      ...experts.map((item) => item.contentHash),
      ...connectors.map((item) => item.contentHash),
    ].join(':')),
  }
}

function publicPreview(preview, token = '') {
  if (!preview?.ok) return preview
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
  })
  return {
    ok: true,
    previewToken: token,
    repositoryId: preview.repositoryId,
    root: preview.root,
    name: preview.name,
    counts: {
      experts: preview.experts.length,
      skills: preview.skills.length,
      connectors: preview.connectors.length,
      blocked: preview.connectors.filter((item) => item.blocked).length,
    },
    experts: preview.experts.map(project),
    skills: preview.skills.map(project),
    connectors: preview.connectors.map(project),
    warnings: preview.warnings,
  }
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
  const userData = String(deps.userData || '')
  if (!store || !catalog || !expertRuntime) return fail('invalid_deps', '仓库注册服务未配置')

  const current = store.loadInstallStore()
  const entries = current.entries || {}
  const claimed = new Set()
  const idMaps = { skills: {}, experts: {}, connectors: {} }
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
    const unified = buildRepositoryManifest('expert', id, item, preview, {
      skills: boundSkills,
      connectors: allConnectorIds,
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
      connectors: allConnectorIds,
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
}

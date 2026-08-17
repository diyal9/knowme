'use strict'

/**
 * skill-runtime — SKILL.md 解析、L0–L3 渐进披露、legacy OKF 双轨与本地自动匹配。
 *
 * 纯 IO 经依赖注入；install store / 沙箱执行由调用方提供。
 */

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const knowledgeRank = require('./knowledge-rank')
const productKnowledge = require('./product-knowledge')
const {
  SIDECAR_FILE,
  adaptLegacyCapability,
  validateAndNormalizeManifest,
} = require('./capability-manifest-v2')
const groundingRuntime = require('./agent-grounding-runtime')
const {
  toDisplaySafeTask,
  computeTasksRevision,
} = require('./skill-experience')

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/
const DEFAULT_L1_BUDGET = 12000
const DEFAULT_AUTO_MATCH_TOPK = 3
const LEGACY_PREFIX = 'legacy-okf/'
const TRUNCATION_SUFFIX = '\n\n[正文已截断]'
const RESOURCE_DIRS = new Set(['references', 'assets'])
const SCRIPT_DIR = 'scripts'

function stripQuotes(value) {
  const v = String(value || '').trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1)
  }
  return v
}

function parseBool(value) {
  if (typeof value === 'boolean') return value
  const v = String(value || '').trim().toLowerCase()
  if (v === 'true' || v === '1' || v === 'yes') return true
  if (v === 'false' || v === '0' || v === 'no' || v === '') return false
  return Boolean(v)
}

function parseInlineList(value) {
  const raw = String(value || '').trim()
  if (!raw) return []
  if (raw.startsWith('[') && raw.endsWith(']')) {
    return raw
      .slice(1, -1)
      .split(',')
      .map((s) => stripQuotes(s.trim()))
      .filter(Boolean)
  }
  return [stripQuotes(raw)].filter(Boolean)
}

const GROUNDING_BLOCK_KEYS = new Set(['requiredTools', 'requiredEvidence', 'completionConditions'])

/**
 * 解析 design D4 块级 YAML：requiredTools / requiredEvidence / completionConditions 列表。
 * 与 inline `[a,b]` 格式互补；后者由主解析器处理。
 */
function parseGroundingBlocksFromRaw(raw) {
  const lines = String(raw || '').split(/\r?\n/)
  const result = {}
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) { i++; continue }

    const topMatch = line.match(/^([a-zA-Z0-9_.-]+):\s*(.*)$/)
    if (!topMatch || /^\s/.test(line)) { i++; continue }

    const key = topMatch[1]
    const inlineVal = topMatch[2].trim()
    if (!GROUNDING_BLOCK_KEYS.has(key)) { i++; continue }
    if (inlineVal) { i++; continue }

    i++
    const items = []
    while (i < lines.length) {
      const cur = lines[i]
      const curTrim = cur.trim()
      if (!curTrim || curTrim.startsWith('#')) { i++; continue }

      const nextTop = cur.match(/^([a-zA-Z0-9_.-]+):\s*(.*)$/)
      if (nextTop && !/^\s/.test(cur)) break

      const dashMatch = cur.match(/^(\s*)-\s+(.*)$/)
      if (!dashMatch) { i++; continue }

      const dashContent = dashMatch[2].trim()
      const objFieldMatch = dashContent.match(/^([a-zA-Z0-9_.-]+):\s*(.*)$/)

      if (objFieldMatch && !/^['"].*['"]$/.test(dashContent)) {
        const obj = {}
        obj[objFieldMatch[1]] = coerceScalar(objFieldMatch[2])
        i++
        const baseIndent = dashMatch[1].length
        while (i < lines.length) {
          const cont = lines[i]
          if (/^\s*-\s/.test(cont)) break
          const contTop = cont.match(/^([a-zA-Z0-9_.-]+):\s*(.*)$/)
          if (contTop && !/^\s/.test(cont)) break
          const contField = cont.match(/^\s+([a-zA-Z0-9_.-]+):\s*(.*)$/)
          const contIndent = cont.match(/^(\s*)/)[1].length
          if (contField && contIndent > baseIndent) {
            obj[contField[1]] = coerceScalar(contField[2])
            i++
          } else {
            break
          }
        }
        items.push(obj)
      } else {
        items.push(coerceScalar(dashContent))
        i++
      }
    }

    if (items.length) result[key] = items
  }
  return result
}

function mergeGroundingFrontmatter(frontmatter, raw) {
  const blocks = parseGroundingBlocksFromRaw(raw)
  for (const [key, val] of Object.entries(blocks)) {
    const existing = frontmatter[key]
    const existingEmpty = existing == null
      || existing === ''
      || (Array.isArray(existing) && existing.length === 0)
    if (existingEmpty && Array.isArray(val) && val.length) {
      frontmatter[key] = val
    }
  }
}

/**
 * 轻量 YAML-like frontmatter 解析（无第三方依赖）。
 * 支持顶层键、metadata.knowme 嵌套、slash、disable-model-invocation。
 */
function parseSkillFrontmatter(content) {
  const text = String(content || '')
  const match = text.match(FRONTMATTER_RE)
  if (!match) {
    return { ok: false, frontmatter: {}, body: text, error: 'missing frontmatter' }
  }

  const raw = match[1]
  const body = match[2]
  const frontmatter = {}
  const metadata = {}
  let inMetadata = false
  let inKnowme = false
  let blockKey = ''

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    if (blockKey && /^\s+/.test(line)) {
      frontmatter[blockKey] = [frontmatter[blockKey], trimmed].filter(Boolean).join(' ')
      continue
    }

    const nestedKnowme = line.match(/^\s+knowme:\s*(.*)$/)
    if (inMetadata && nestedKnowme) {
      inKnowme = true
      const val = nestedKnowme[1].trim()
      if (val) metadata.knowme = { ...(metadata.knowme || {}), ...parseInlineMap(val) }
      continue
    }

    const nestedMeta = line.match(/^\s+([a-zA-Z0-9_.-]+):\s*(.*)$/)
    if (inKnowme && nestedMeta) {
      metadata.knowme = metadata.knowme || {}
      metadata.knowme[nestedMeta[1]] = coerceScalar(nestedMeta[2])
      continue
    }

    const top = line.match(/^([a-zA-Z0-9_.-]+):\s*(.*)$/)
    if (top && !/^\s/.test(line)) {
      inMetadata = false
      inKnowme = false
      const key = top[1]
      const val = top[2].trim()
      blockKey = ''
      if (key === 'metadata') {
        inMetadata = true
        if (val) Object.assign(metadata, parseInlineMap(val))
        continue
      }
      if (val === '>-' || val === '>' || val === '|') {
        blockKey = key
        frontmatter[key] = ''
        continue
      }
      frontmatter[key] = coerceScalar(val)
      continue
    }

    const metaSub = line.match(/^\s+([a-zA-Z0-9_.-]+):\s*(.*)$/)
    if (inMetadata && metaSub) {
      metadata[metaSub[1]] = coerceScalar(metaSub[2])
    }
  }

  if (Object.keys(metadata).length) frontmatter.metadata = metadata
  if (metadata.knowme && typeof metadata.knowme === 'object') {
    frontmatter.metadata = { ...frontmatter.metadata, knowme: metadata.knowme }
  }

  mergeGroundingFrontmatter(frontmatter, raw)

  const disable = parseBool(frontmatter['disable-model-invocation'])
  const slash =
    String(frontmatter.slash || frontmatter.metadata?.knowme?.slash || '')
      .trim()
      .replace(/^\//, '') || null

  return {
    ok: true,
    frontmatter,
    body,
    name: String(frontmatter.name || '').trim(),
    description: String(frontmatter.description || '').trim(),
    disableModelInvocation: disable,
    slash,
    error: null,
  }
}

function parseInlineMap(value) {
  const out = {}
  const raw = String(value || '').trim()
  if (!raw.startsWith('{') || !raw.endsWith('}')) return out
  const inner = raw.slice(1, -1)
  for (const part of inner.split(',')) {
    const idx = part.indexOf(':')
    if (idx < 0) continue
    const key = part.slice(0, idx).trim()
    const val = part.slice(idx + 1).trim()
    out[key] = coerceScalar(val)
  }
  return out
}

function coerceScalar(value) {
  const v = stripQuotes(String(value || '').trim())
  if (v === 'true') return true
  if (v === 'false') return false
  if (/^\[.*\]$/.test(v)) return parseInlineList(v)
  return v
}

function contentHash(text) {
  return crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex').slice(0, 16)
}

function truncateText(text, maxChars, suffix = TRUNCATION_SUFFIX) {
  const src = String(text || '')
  const limit = Number.isFinite(maxChars) && maxChars > 0 ? maxChars : DEFAULT_L1_BUDGET
  if (src.length <= limit) return { text: src, truncated: false }
  const keep = Math.max(0, limit - suffix.length)
  return { text: src.slice(0, keep) + suffix, truncated: true }
}

function normalizeSkillId(id) {
  return String(id || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

function isLegacySkillId(id) {
  return normalizeSkillId(id).startsWith(LEGACY_PREFIX)
}

function legacyConceptId(id) {
  return normalizeSkillId(id).slice(LEGACY_PREFIX.length)
}

function resolveSafePath(rootDir, relativePath, allowedPrefixes = []) {
  const root = path.resolve(rootDir)
  const rel = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '')
  if (!rel || rel.includes('..') || path.isAbsolute(rel)) {
    return { ok: false, code: 'invalid_path', message: '非法相对路径' }
  }
  const segments = rel.split('/').filter(Boolean)
  if (segments.some((s) => s === '..')) {
    return { ok: false, code: 'invalid_path', message: '路径 traversal 被拒绝' }
  }
  if (allowedPrefixes.length) {
    const head = segments[0]
    if (!allowedPrefixes.includes(head)) {
      return {
        ok: false,
        code: 'invalid_path',
        message: `仅允许 ${allowedPrefixes.join('/')} 下的资源`,
      }
    }
  }
  const abs = path.resolve(root, ...segments)
  const relToRoot = path.relative(root, abs)
  if (relToRoot.startsWith('..') || path.isAbsolute(relToRoot)) {
    return { ok: false, code: 'invalid_path', message: '路径超出技能目录' }
  }
  return { ok: true, abs, rel }
}

/**
 * @param {{
 *   capabilitiesRoot: string,
 *   knowledgeDir?: string,
 *   fsImpl?: typeof fs,
 *   getInstallStore?: () => { skills?: Record<string, { enabled?: boolean }> },
 *   runScript?: (ctx: object) => Promise<object>,
 *   l1Budget?: number,
 * }} deps
 */
function createSkillRuntime(deps = {}) {
  const capabilitiesRoot = String(deps.capabilitiesRoot || '').trim()
  const knowledgeDir = String(deps.knowledgeDir || '').trim()
  const fsImpl = deps.fsImpl || fs
  const getInstallStore =
    typeof deps.getInstallStore === 'function' ? deps.getInstallStore : () => ({ skills: {} })
  const getPackSkillSources =
    typeof deps.getPackSkillSources === 'function' ? deps.getPackSkillSources : null
  const runScript = typeof deps.runScript === 'function' ? deps.runScript : null
  const l1Budget = Number.isFinite(deps.l1Budget) ? deps.l1Budget : DEFAULT_L1_BUDGET

  function skillsRoot() {
    return path.join(capabilitiesRoot, 'skills')
  }

  function isSkillEnabled(skillId) {
    const store = getInstallStore()
    const entry = store?.skills?.[skillId]
    if (!entry) return true
    return entry.enabled !== false
  }

  function readSkillMd(absPath) {
    if (!fsImpl.existsSync(absPath)) return null
    const content = fsImpl.readFileSync(absPath, 'utf8')
    return parseSkillFrontmatter(content)
  }

  function loadSkillCapabilityManifest(id, dir, parsed, source, entry = {}) {
    const sidecarPath = dir ? path.join(dir, SIDECAR_FILE) : ''
    if (sidecarPath && fsImpl.existsSync(sidecarPath)) {
      try {
        const normalized = validateAndNormalizeManifest(JSON.parse(fsImpl.readFileSync(sidecarPath, 'utf8')), {
          id,
          kind: 'skill',
          name: parsed?.name || entry.name || id,
          description: parsed?.description || entry.description || '',
        })
        if (normalized.ok) return normalized.manifest
      } catch { /* use legacy adapter */ }
    }
    const adapted = adaptLegacyCapability('skill', parsed?.frontmatter || {}, {
      id,
      name: parsed?.name || entry.name || id,
      description: parsed?.description || entry.description || '',
      version: entry.version || '1.0.0',
      source,
      ref: entry.originPath || (dir ? path.join('skills', id, 'SKILL.md').replace(/\\/g, '/') : id),
      trust: entry.trust || (source === 'standard' ? 'managed' : 'unknown'),
      contentHash: entry.contentHash || '',
      hasScripts: Boolean(dir && fsImpl.existsSync(path.join(dir, SCRIPT_DIR))),
    })
    return adapted.ok ? adapted.manifest : null
  }

  function resolveLinkedSkillDir(entry) {
    if (!entry?.linked || !entry.originRoot || !entry.originPath) return null
    try {
      const root = fsImpl.realpathSync(path.resolve(entry.originRoot))
      const candidate = fsImpl.realpathSync(path.resolve(root, entry.originPath))
      const rel = path.relative(root, candidate)
      if (rel.startsWith('..') || path.isAbsolute(rel)) return null
      if (!fsImpl.statSync(candidate).isDirectory()) return null
      if (!fsImpl.existsSync(path.join(candidate, 'SKILL.md'))) return null
      return { root, dir: candidate }
    } catch {
      return null
    }
  }

  function scanLinkedSkills(existingIds = new Set()) {
    const store = getInstallStore()
    const entries = store?.skills && typeof store.skills === 'object'
      ? Object.values(store.skills)
      : []
    const out = []
    for (const entry of entries) {
      if (!entry?.linked || entry.enabled === false || existingIds.has(entry.id)) continue
      const linked = resolveLinkedSkillDir(entry)
      if (!linked) continue
      const skillMd = path.join(linked.dir, 'SKILL.md')
      const parsed = readSkillMd(skillMd)
      if (!parsed?.ok) continue
      const hash = contentHash(fsImpl.readFileSync(skillMd, 'utf8'))
      const capabilityManifest = loadSkillCapabilityManifest(entry.id, linked.dir, parsed, 'linked-repo', {
        ...entry,
        contentHash: hash,
      })
      out.push({
        id: normalizeSkillId(entry.id),
        source: 'linked-repo',
        dir: linked.dir,
        repositoryRoot: linked.root,
        repositoryId: entry.repositoryId || '',
        name: parsed.name || entry.name || entry.id,
        description: parsed.description || entry.description || '',
        disableModelInvocation: parsed.disableModelInvocation,
        slash: parsed.slash || entry.id,
        contentHash: hash,
        capabilityManifest,
      })
    }
    return out
  }

  function scanPackSkills(existingIds = new Set()) {
    if (!getPackSkillSources) return { records: [], issues: [] }
    const payload = getPackSkillSources()
    const sources = Array.isArray(payload) ? payload : (payload?.sources || [])
    const extraIssues = Array.isArray(payload?.issues) ? payload.issues : []
    const out = []
    for (const src of sources) {
      const id = normalizeSkillId(src?.id)
      if (!id || existingIds.has(id)) continue
      if (!src?.dir || !fsImpl.existsSync(path.join(src.dir, 'SKILL.md'))) continue
      const parsed = readSkillMd(path.join(src.dir, 'SKILL.md'))
      if (!parsed?.ok) continue
      out.push({
        id,
        source: 'pack',
        dir: src.dir,
        ownerPackId: src.ownerPackId || src.provenance?.ownerPackId || '',
        name: parsed.name || src.name || id,
        description: parsed.description || src.description || '',
        disableModelInvocation: parsed.disableModelInvocation,
        slash: parsed.slash || src.slash || id,
        contentHash: src.contentHash || contentHash(fsImpl.readFileSync(path.join(src.dir, 'SKILL.md'), 'utf8')),
        capabilityManifest: src.capabilityManifest || loadSkillCapabilityManifest(id, src.dir, parsed, 'pack', {
          ...src,
          contentHash: src.contentHash,
        }),
        provenance: src.provenance || {},
      })
      existingIds.add(id)
    }
    return { records: out, issues: extraIssues }
  }

  function scanStandardSkills() {
    const root = skillsRoot()
    const out = []
    const seenIds = new Set()
    if (fsImpl.existsSync(root)) {
      for (const name of fsImpl.readdirSync(root)) {
        const dir = path.join(root, name)
        let stat
        try {
          stat = fsImpl.statSync(dir)
        } catch {
          continue
        }
        if (!stat.isDirectory()) continue
        const skillMd = path.join(dir, 'SKILL.md')
        if (!fsImpl.existsSync(skillMd)) continue
        const parsed = readSkillMd(skillMd)
        if (!parsed) continue
        const id = normalizeSkillId(name)
        const hash = contentHash(fsImpl.readFileSync(skillMd, 'utf8'))
        const capabilityManifest = loadSkillCapabilityManifest(id, dir, parsed, 'standard', {
          contentHash: hash,
        })
        out.push({
          id,
          source: 'standard',
          dir,
          name: parsed.name || id,
          description: parsed.description,
          disableModelInvocation: parsed.disableModelInvocation,
          slash: parsed.slash || id,
          contentHash: hash,
          capabilityManifest,
        })
        seenIds.add(id)
      }
    }
    out.push(...scanLinkedSkills(seenIds))
    const packScan = scanPackSkills(seenIds)
    out.push(...packScan.records)
    return out.sort((a, b) => a.id.localeCompare(b.id))
  }

  function scanLegacyOkfSkills() {
    if (!knowledgeDir || !fsImpl.existsSync(knowledgeDir)) return []
    const legacy = productKnowledge.listSkills(knowledgeDir)
    return legacy.map((item) => {
      const id = `${LEGACY_PREFIX}${item.id}`
      const hash = contentHash(`${item.id}:${item.title}:${item.description || ''}`)
      return {
        id,
        source: 'legacy-okf',
        conceptId: item.id,
        dir: null,
        name: item.title,
        description: item.description || '',
        disableModelInvocation: false,
        slash: item.slash,
        contentHash: hash,
        capabilityManifest: loadSkillCapabilityManifest(id, null, {
          frontmatter: {},
          name: item.title,
          description: item.description || '',
        }, 'legacy-okf', { contentHash: hash, trust: 'legacy' }),
      }
    })
  }

  function scanAllSkills({ includeLegacy = true } = {}) {
    const all = [...scanStandardSkills()]
    if (includeLegacy) all.push(...scanLegacyOkfSkills())
    return all
  }

  function findSkillRecord(skillId) {
    const id = normalizeSkillId(skillId)
    const standard = scanStandardSkills().find((s) => s.id === id)
    if (standard) return standard
    if (isLegacySkillId(id)) {
      return scanLegacyOkfSkills().find((s) => s.id === id) || null
    }
    return null
  }

  function filterEnabled(records, { allowedIds } = {}) {
    const allow = allowedIds ? new Set(allowedIds.map(normalizeSkillId)) : null
    return records.filter((rec) => {
      if (allow && !allow.has(rec.id)) return false
      return isSkillEnabled(rec.id)
    })
  }

  function listSkillsL0(options = {}) {
    const records = filterEnabled(scanAllSkills({ includeLegacy: options.includeLegacy !== false }), options)
    return records.map((rec) => ({
      id: rec.id,
      name: rec.name,
      description: rec.description,
      disableModelInvocation: rec.disableModelInvocation,
      source: rec.source,
      slash: rec.slash,
      dependencies: rec.capabilityManifest?.dependencies || [],
      permissions: rec.capabilityManifest?.permissions || {},
      inputs: rec.capabilityManifest?.inputs || [],
      outputs: rec.capabilityManifest?.outputs || [],
      risk: rec.capabilityManifest?.risk || { level: 'low', reasons: [] },
      provenance: rec.capabilityManifest?.provenance || {},
    }))
  }

  function loadLegacyBody(record) {
    const conceptId = legacyConceptId(record.id)
    const full = productKnowledge.readConcept(knowledgeDir, conceptId)
    return full?.body || ''
  }

  function loadSkillL1(skillId, options = {}) {
    const id = normalizeSkillId(skillId)
    const allow = options.allowedIds ? new Set(options.allowedIds.map(normalizeSkillId)) : null
    if (allow && !allow.has(id)) {
      return { ok: false, code: 'not_allowed', message: `技能未绑定到当前 Session: ${id}` }
    }
    const record = findSkillRecord(id)
    if (!record) return { ok: false, code: 'not_found', message: `技能不存在: ${id}` }
    if (!isSkillEnabled(id)) {
      return { ok: false, code: 'disabled', message: `技能已禁用: ${id}` }
    }

    let body = ''
    if (record.source === 'legacy-okf') {
      body = loadLegacyBody(record)
    } else {
      const parsed = readSkillMd(path.join(record.dir, 'SKILL.md'))
      body = parsed?.body || ''
    }
    const budget = Number.isFinite(options.maxChars) ? options.maxChars : l1Budget
    const truncated = truncateText(body, budget)
    return {
      ok: true,
      id,
      name: record.name,
      body: truncated.text,
      truncated: truncated.truncated,
      source: record.source,
    }
  }

  function loadSkillGroundingContract(skillId, options = {}) {
    const id = normalizeSkillId(skillId)
    const allow = options.allowedIds ? new Set(options.allowedIds.map(normalizeSkillId)) : null
    if (allow && !allow.has(id)) {
      return { ok: false, code: 'not_allowed', message: `技能未绑定到当前 Session: ${id}`, contract: null, issues: [] }
    }
    const record = findSkillRecord(id)
    if (!record) return { ok: false, code: 'not_found', message: `技能不存在: ${id}`, contract: null, issues: [] }
    if (!isSkillEnabled(id)) {
      return { ok: false, code: 'disabled', message: `技能已禁用: ${id}`, contract: null, issues: [] }
    }
    if (record.source === 'legacy-okf') {
      return { ok: true, contract: null, issues: [] }
    }
    const parsed = readSkillMd(path.join(record.dir, 'SKILL.md'))
    if (!parsed?.ok) {
      return { ok: false, code: 'parse_failed', message: parsed?.error || 'parse failed', contract: null, issues: [] }
    }
    const contract = groundingRuntime.parseSkillGroundingContract(parsed.frontmatter)
    const experienceTasks = record.capabilityManifest?.metadata?.knowme?.experience?.tasks
    const requestedTaskId = String(options.taskId || '').trim()
    const experienceRequiredTools = Array.isArray(experienceTasks)
      ? experienceTasks
        .filter(task => requestedTaskId && task?.id === requestedTaskId)
        .flatMap(task => Array.isArray(task?.requiredTools) ? task.requiredTools : [])
      : []
    contract.requiredTools = [...new Set([
      ...(contract.requiredTools || []),
      ...experienceRequiredTools,
    ].map(tool => String(tool || '').trim()).filter(Boolean))]
    contract.skillId = id
    const validation = groundingRuntime.validateGroundingContract(contract, parsed.frontmatter)
    return { ok: validation.ok, contract, issues: validation.issues }
  }

  function readSkillResource(skillId, relativePath, options = {}) {
    const id = normalizeSkillId(skillId)
    const allow = options.allowedIds ? new Set(options.allowedIds.map(normalizeSkillId)) : null
    if (allow && !allow.has(id)) {
      return { ok: false, code: 'not_allowed', message: `技能未绑定到当前 Session: ${id}` }
    }
    const record = findSkillRecord(id)
    if (!record) return { ok: false, code: 'not_found', message: `技能不存在: ${id}` }
    if (!isSkillEnabled(id)) {
      return { ok: false, code: 'disabled', message: `技能已禁用: ${id}` }
    }
    if (record.source === 'legacy-okf') {
      return { ok: false, code: 'unsupported', message: 'legacy OKF 技能不支持 read_skill_resource' }
    }

    const rel = String(relativePath || '').replace(/\\/g, '/')
    const resolved = resolveSafePath(record.dir, rel, [...RESOURCE_DIRS])
    if (!resolved.ok) return resolved
    if (!fsImpl.existsSync(resolved.abs)) {
      return { ok: false, code: 'not_found', message: `资源不存在: ${rel}` }
    }
    if (record.source === 'linked-repo') {
      try {
        const real = fsImpl.realpathSync(resolved.abs)
        const repoRel = path.relative(record.repositoryRoot, real)
        const skillRel = path.relative(record.dir, real)
        if (repoRel.startsWith('..') || path.isAbsolute(repoRel) || skillRel.startsWith('..') || path.isAbsolute(skillRel)) {
          return { ok: false, code: 'invalid_path', message: '链接资源超出仓库技能目录' }
        }
      } catch {
        return { ok: false, code: 'not_found', message: `资源不可读: ${rel}` }
      }
    }
    const stat = fsImpl.statSync(resolved.abs)
    if (!stat.isFile()) {
      return { ok: false, code: 'invalid_path', message: '仅支持单文件读取' }
    }
    const content = fsImpl.readFileSync(resolved.abs, 'utf8')
    return { ok: true, id, path: resolved.rel, content }
  }

  async function runSkillScript(skillId, scriptPath, args = {}, permissions = {}, options = {}) {
    const id = normalizeSkillId(skillId)
    const allow = options.allowedIds ? new Set(options.allowedIds.map(normalizeSkillId)) : null
    if (allow && !allow.has(id)) {
      return { ok: false, code: 'not_allowed', message: `技能未绑定到当前 Session: ${id}` }
    }
    const record = findSkillRecord(id)
    if (!record) return { ok: false, code: 'not_found', message: `技能不存在: ${id}` }
    if (!isSkillEnabled(id)) {
      return { ok: false, code: 'disabled', message: `技能已禁用: ${id}` }
    }
    if (record.source === 'legacy-okf') {
      return { ok: false, code: 'unsupported', message: 'legacy OKF 技能不支持 run_skill_script' }
    }
    if (!runScript) {
      return { ok: false, code: 'tool_unavailable', message: '脚本沙箱执行器未配置' }
    }

    const rel = String(scriptPath || '').replace(/\\/g, '/')
    const resolved = resolveSafePath(record.dir, rel, [SCRIPT_DIR])
    if (!resolved.ok) return resolved
    if (!fsImpl.existsSync(resolved.abs)) {
      return { ok: false, code: 'not_found', message: `脚本不存在: ${rel}` }
    }
    if (record.source === 'linked-repo') {
      try {
        const real = fsImpl.realpathSync(resolved.abs)
        const repoRel = path.relative(record.repositoryRoot, real)
        const skillRel = path.relative(record.dir, real)
        if (repoRel.startsWith('..') || path.isAbsolute(repoRel) || skillRel.startsWith('..') || path.isAbsolute(skillRel)) {
          return { ok: false, code: 'invalid_path', message: '链接脚本超出仓库技能目录' }
        }
      } catch {
        return { ok: false, code: 'not_found', message: `脚本不可读: ${rel}` }
      }
    }

    const scriptsRoot = path.join(record.dir, SCRIPT_DIR)
    const scriptAbs = resolved.abs
    const relInScripts = path.relative(scriptsRoot, scriptAbs)
    if (relInScripts.startsWith('..') || path.isAbsolute(relInScripts)) {
      return { ok: false, code: 'invalid_path', message: '脚本必须在 scripts/ 目录内' }
    }

    return runScript({
      skillId: id,
      scriptPath: resolved.rel,
      scriptAbs,
      scriptsRoot,
      skillRoot: record.dir,
      args: args && typeof args === 'object' ? args : {},
      permissions: {
        network: Boolean(permissions.network),
        write: Boolean(permissions.write),
        dangerous: Boolean(permissions.dangerous),
      },
    })
  }

  function autoMatchSkills(message, options = {}) {
    const topK = Number.isFinite(options.topK) ? options.topK : DEFAULT_AUTO_MATCH_TOPK
    const query = String(message || '').trim()
    if (!query) return []

    const candidates = filterEnabled(scanAllSkills(), options).filter(
      (rec) => !rec.disableModelInvocation,
    )
    if (!candidates.length) return []

    const docs = candidates.map((rec) => ({
      id: rec.id,
      title: rec.name,
      path: rec.slash,
      content: rec.description,
    }))
    const ranked = knowledgeRank.rankHits(query, docs, { topK })
    return ranked.map((hit) => {
      const rec = candidates.find((c) => c.slash === hit.path || c.name === hit.title)
      return {
        id: rec.id,
        name: rec.name,
        description: rec.description,
        score: hit.score,
        slash: rec.slash,
        source: rec.source,
      }
    })
  }

  function listSlashPickerItems(options = {}) {
    return filterEnabled(scanAllSkills(), options).map((rec) => ({
      id: rec.id,
      name: rec.name,
      description: rec.description,
      slash: rec.slash,
      source: rec.source,
      legacy: rec.source === 'legacy-okf',
      dependencies: rec.capabilityManifest?.dependencies || [],
      permissions: rec.capabilityManifest?.permissions || {},
      inputs: rec.capabilityManifest?.inputs || [],
      outputs: rec.capabilityManifest?.outputs || [],
      risk: rec.capabilityManifest?.risk || { level: 'low', reasons: [] },
      provenance: rec.capabilityManifest?.provenance || {},
    }))
  }

  function exportLegacyToSkillMd(legacySkillId, targetId) {
    const id = normalizeSkillId(legacySkillId)
    if (!isLegacySkillId(id)) {
      return { ok: false, code: 'invalid_args', message: '仅 legacy OKF 技能可导出' }
    }
    const record = findSkillRecord(id)
    if (!record) return { ok: false, code: 'not_found', message: `legacy 技能不存在: ${id}` }

    const conceptId = legacyConceptId(id)
    const full = productKnowledge.readConcept(knowledgeDir, conceptId)
    if (!full) return { ok: false, code: 'not_found', message: 'OKF concept 不可读' }

    const outId = normalizeSkillId(targetId || record.slash || conceptId.split('/').pop())
    const outDir = path.join(skillsRoot(), outId)
    const outFile = path.join(outDir, 'SKILL.md')
    if (fsImpl.existsSync(outFile)) {
      return { ok: false, code: 'exists', message: `目标 SKILL 已存在: ${outId}` }
    }

    const fm = full.frontmatter || {}
    const body = String(full.body || '').trim()
    const lines = [
      '---',
      `name: ${JSON.stringify(record.name)}`,
      `description: ${JSON.stringify(record.description || fm.description || record.name)}`,
      `slash: ${JSON.stringify(record.slash)}`,
      'metadata:',
      '  knowme:',
      `    migratedFrom: ${JSON.stringify(conceptId)}`,
      '    legacy: true',
      '---',
      '',
      body,
      '',
    ]
    fsImpl.mkdirSync(outDir, { recursive: true })
    fsImpl.writeFileSync(outFile, lines.join('\n'), 'utf8')
    return {
      ok: true,
      id: outId,
      path: outFile,
      migratedFrom: conceptId,
      contentHash: contentHash(lines.join('\n')),
    }
  }

  function listSkillTasks(options = {}) {
    const records = filterEnabled(scanAllSkills({ includeLegacy: options.includeLegacy !== false }), options)
    const issues = []
    const revisionParts = []
    const seenTaskIds = new Map()

    if (getPackSkillSources) {
      const payload = getPackSkillSources()
      if (Array.isArray(payload?.issues)) issues.push(...payload.issues)
    }

    const sourceRank = { standard: 0, 'linked-repo': 1, pack: 2, 'legacy-okf': 3 }

    for (const rec of records) {
      revisionParts.push(`${rec.id}:${rec.contentHash || ''}`)
      const experienceTasks = rec.capabilityManifest?.metadata?.knowme?.experience?.tasks
      if (!Array.isArray(experienceTasks) || !experienceTasks.length) continue

      for (const task of experienceTasks) {
        const dto = toDisplaySafeTask(task, {
          skillId: rec.id,
          source: rec.source,
          ownerPackId: rec.ownerPackId || rec.provenance?.ownerPackId || undefined,
        })
        const existing = seenTaskIds.get(dto.id)
        if (existing) {
          issues.push({
            code: 'duplicate_task_id',
            message: `重复 task.id: ${dto.id}（${existing.skillId} / ${dto.skillId}）`,
            taskId: dto.id,
            skillId: rec.id,
            existingSkillId: existing.skillId,
          })
          if ((sourceRank[existing.source] ?? 99) <= (sourceRank[dto.source] ?? 99)) continue
        }
        seenTaskIds.set(dto.id, dto)
        revisionParts.push(`${dto.id}:${dto.skillId}:${rec.contentHash || ''}`)
      }
    }

    return {
      tasks: [...seenTaskIds.values()].sort((a, b) => a.id.localeCompare(b.id)),
      issues,
      revision: computeTasksRevision(revisionParts.sort()),
    }
  }

  return {
    listSkillsL0,
    listSkillTasks,
    loadSkillL1,
    loadSkillGroundingContract,
    readSkillResource,
    runSkillScript,
    autoMatchSkills,
    listSlashPickerItems,
    exportLegacyToSkillMd,
    scanAllSkills,
    findSkillRecord,
    isSkillEnabled,
  }
}

function parseSkillGroundingFromContent(content) {
  const parsed = parseSkillFrontmatter(content)
  if (!parsed.ok) return { ok: false, contract: null, issues: [{ message: parsed.error || 'parse failed' }] }
  const contract = groundingRuntime.parseSkillGroundingContract(parsed.frontmatter)
  const validation = groundingRuntime.validateGroundingContract(contract, parsed.frontmatter)
  return { ok: validation.ok, contract, issues: validation.issues }
}

module.exports = {
  createSkillRuntime,
  parseSkillFrontmatter,
  parseGroundingBlocksFromRaw,
  parseSkillGroundingFromContent,
  resolveSafePath,
  truncateText,
  contentHash,
  LEGACY_PREFIX,
  DEFAULT_L1_BUDGET,
  DEFAULT_AUTO_MATCH_TOPK,
}

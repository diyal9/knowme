'use strict'

/**
 * expert-runtime — EXPERT.md + manifest 解析、bindings 校验、Session 快照与试聊 DTO。
 */

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { contentHash } = require('./skill-runtime')

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/

function stripQuotes(value) {
  const v = String(value || '').trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1)
  }
  return v
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

/**
 * 解析 EXPERT.md frontmatter：name, description, avatar, skills[], connectors[], systemPrompt
 */
function parseExpertFrontmatter(content) {
  const text = String(content || '')
  const match = text.match(FRONTMATTER_RE)
  if (!match) {
    return { ok: false, frontmatter: {}, body: text, error: 'missing frontmatter' }
  }

  const raw = match[1]
  const body = match[2]
  const frontmatter = {}

  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf(':')
    if (idx < 0) continue
    const key = trimmed.slice(0, idx).trim()
    const val = trimmed.slice(idx + 1).trim()
    if (key === 'skills' || key === 'connectors') {
      frontmatter[key] = parseInlineList(val)
    } else if (key === 'systemPrompt') {
      frontmatter.systemPrompt = stripQuotes(val)
    } else {
      frontmatter[key] = stripQuotes(val)
    }
  }

  const systemPrompt = String(
    frontmatter.systemPrompt || body.trim(),
  ).trim()

  return {
    ok: true,
    frontmatter,
    body,
    name: String(frontmatter.name || '').trim(),
    description: String(frontmatter.description || '').trim(),
    avatar: String(frontmatter.avatar || '').trim(),
    skills: Array.isArray(frontmatter.skills) ? frontmatter.skills.map(String) : [],
    connectors: Array.isArray(frontmatter.connectors) ? frontmatter.connectors.map(String) : [],
    systemPrompt,
    error: null,
  }
}

function parseManifestJson(text) {
  try {
    const data = JSON.parse(String(text || '{}'))
    return {
      ok: true,
      version: String(data.version || '1.0.0').trim(),
      contentHash: String(data.contentHash || data.content_hash || '').trim(),
      raw: data,
    }
  } catch (err) {
    return { ok: false, error: String(err.message || 'invalid manifest json') }
  }
}

function buildManifest(expertParsed, expertMdContent) {
  return {
    version: '1.0.0',
    contentHash: contentHash(expertMdContent),
    name: expertParsed.name,
    skills: expertParsed.skills,
    connectors: expertParsed.connectors,
    updatedAt: new Date().toISOString(),
  }
}

function atomicWriteJson(filePath, data, fsImpl = fs) {
  const dir = path.dirname(filePath)
  fsImpl.mkdirSync(dir, { recursive: true })
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`
  fsImpl.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  fsImpl.renameSync(tmp, filePath)
}

function normalizeExpertId(id) {
  return String(id || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
}

function validateExpertPackage(parsed) {
  const issues = []
  if (!parsed.name) issues.push({ code: 'missing_name', message: '缺少 name' })
  if (!parsed.systemPrompt) issues.push({ code: 'missing_system_prompt', message: '缺少 systemPrompt' })
  return { ok: issues.length === 0, issues }
}

function validateBindings(expert, { availableSkills = [], availableConnectors = [] } = {}) {
  const skillSet = new Set(availableSkills.map(String))
  const connectorSet = new Set(availableConnectors.map(String))
  const issues = []

  for (const skillId of expert.skills || []) {
    if (!skillSet.has(String(skillId))) {
      issues.push({
        code: 'unknown_skill',
        message: `绑定的 skill 不存在或未启用: ${skillId}`,
        skillId,
      })
    }
  }
  for (const connectorId of expert.connectors || []) {
    if (!connectorSet.has(String(connectorId))) {
      issues.push({
        code: 'unknown_connector',
        message: `绑定的 connector 不存在或未启用: ${connectorId}`,
        connectorId,
      })
    }
  }
  return { ok: issues.length === 0, issues }
}

/**
 * @param {{
 *   capabilitiesRoot: string,
 *   fsImpl?: typeof fs,
 *   getSkillHashes?: (ids: string[]) => Record<string, string>,
 *   getConnectorHashes?: (ids: string[]) => Record<string, string>,
 * }} deps
 */
function createExpertRuntime(deps = {}) {
  const capabilitiesRoot = String(deps.capabilitiesRoot || '').trim()
  const fsImpl = deps.fsImpl || fs
  const getSkillHashes =
    typeof deps.getSkillHashes === 'function' ? deps.getSkillHashes : () => ({})
  const getConnectorHashes =
    typeof deps.getConnectorHashes === 'function' ? deps.getConnectorHashes : () => ({})

  function expertsRoot() {
    return path.join(capabilitiesRoot, 'experts')
  }

  function snapshotsRoot() {
    return path.join(capabilitiesRoot, 'snapshots')
  }

  function expertDir(expertId) {
    return path.join(expertsRoot(), normalizeExpertId(expertId))
  }

  function loadExpert(expertId) {
    const id = normalizeExpertId(expertId)
    const dir = expertDir(id)
    const expertMd = path.join(dir, 'EXPERT.md')
    const manifestPath = path.join(dir, 'manifest.json')
    if (!fsImpl.existsSync(expertMd)) {
      return { ok: false, code: 'not_found', message: `专家不存在: ${id}` }
    }
    const mdContent = fsImpl.readFileSync(expertMd, 'utf8')
    const parsed = parseExpertFrontmatter(mdContent)
    const validation = validateExpertPackage(parsed)
    if (!validation.ok) {
      return { ok: false, code: 'invalid_expert', message: validation.issues[0].message, issues: validation.issues }
    }

    let manifest = buildManifest(parsed, mdContent)
    if (fsImpl.existsSync(manifestPath)) {
      const onDisk = parseManifestJson(fsImpl.readFileSync(manifestPath, 'utf8'))
      if (onDisk.ok) {
        manifest = { ...manifest, ...onDisk.raw, contentHash: onDisk.contentHash || manifest.contentHash }
      }
    }

    return {
      ok: true,
      id,
      dir,
      ...parsed,
      manifest,
      expertMdPath: expertMd,
      manifestPath,
    }
  }

  function listExperts() {
    const root = expertsRoot()
    if (!fsImpl.existsSync(root)) return []
    const out = []
    for (const name of fsImpl.readdirSync(root)) {
      const loaded = loadExpert(name)
      if (!loaded.ok) continue
      out.push({
        id: loaded.id,
        name: loaded.name,
        description: loaded.description,
        avatar: loaded.avatar,
        skills: loaded.skills,
        connectors: loaded.connectors,
        contentHash: loaded.manifest.contentHash,
      })
    }
    return out.sort((a, b) => a.id.localeCompare(b.id))
  }

  function saveExpert(expertId, payload = {}) {
    const id = normalizeExpertId(expertId || payload.id)
    if (!id) return { ok: false, code: 'invalid_args', message: '缺少 expert id' }

    const parsed = {
      name: String(payload.name || '').trim(),
      description: String(payload.description || '').trim(),
      avatar: String(payload.avatar || '').trim(),
      skills: Array.isArray(payload.skills) ? payload.skills.map(String) : [],
      connectors: Array.isArray(payload.connectors) ? payload.connectors.map(String) : [],
      systemPrompt: String(payload.systemPrompt || '').trim(),
    }
    const validation = validateExpertPackage(parsed)
    if (!validation.ok) {
      return { ok: false, code: 'invalid_expert', message: validation.issues[0].message, issues: validation.issues }
    }

    const lines = [
      '---',
      `name: ${JSON.stringify(parsed.name)}`,
      `description: ${JSON.stringify(parsed.description)}`,
      `avatar: ${JSON.stringify(parsed.avatar)}`,
      `skills: [${parsed.skills.map((s) => JSON.stringify(s)).join(', ')}]`,
      `connectors: [${parsed.connectors.map((c) => JSON.stringify(c)).join(', ')}]`,
      `systemPrompt: ${JSON.stringify(parsed.systemPrompt)}`,
      '---',
      '',
    ]
    const mdContent = lines.join('\n')
    const dir = expertDir(id)
    fsImpl.mkdirSync(dir, { recursive: true })
    fsImpl.writeFileSync(path.join(dir, 'EXPERT.md'), mdContent, 'utf8')

    const manifest = buildManifest(parsed, mdContent)
    atomicWriteJson(path.join(dir, 'manifest.json'), manifest, fsImpl)
    return { ok: true, id, manifest, contentHash: manifest.contentHash }
  }

  function snapshotPath(sessionId) {
    return path.join(snapshotsRoot(), String(sessionId || '').trim(), 'manifest.json')
  }

  function buildSnapshotManifest(expert, skillHashes, connectorHashes) {
    return {
      sessionId: expert.sessionId,
      expertId: expert.expertId,
      frozenAt: new Date().toISOString(),
      persona: {
        name: expert.name,
        description: expert.description,
        avatar: expert.avatar,
        systemPrompt: expert.systemPrompt,
      },
      bindings: {
        skills: expert.skills,
        connectors: expert.connectors,
      },
      hashes: {
        expert: expert.manifest.contentHash,
        skills: skillHashes,
        connectors: connectorHashes,
      },
    }
  }

  function createSessionSnapshot(sessionId, expertId) {
    const sid = String(sessionId || '').trim()
    const eid = normalizeExpertId(expertId)
    if (!sid || !eid) {
      return { ok: false, code: 'invalid_args', message: 'sessionId 与 expertId 均不能为空' }
    }

    const expert = loadExpert(eid)
    if (!expert.ok) return expert

    const skillHashes = getSkillHashes(expert.skills)
    const connectorHashes = getConnectorHashes(expert.connectors)
    const snapshot = buildSnapshotManifest(
      {
        sessionId: sid,
        expertId: eid,
        name: expert.name,
        description: expert.description,
        avatar: expert.avatar,
        systemPrompt: expert.systemPrompt,
        skills: expert.skills,
        connectors: expert.connectors,
        manifest: expert.manifest,
      },
      skillHashes,
      connectorHashes,
    )

    const outPath = snapshotPath(sid)
    atomicWriteJson(outPath, snapshot, fsImpl)
    return { ok: true, sessionId: sid, expertId: eid, snapshot, path: outPath }
  }

  function readSessionSnapshot(sessionId) {
    const outPath = snapshotPath(sessionId)
    if (!fsImpl.existsSync(outPath)) return null
    try {
      return JSON.parse(fsImpl.readFileSync(outPath, 'utf8'))
    } catch {
      return null
    }
  }

  function getSessionPersona(sessionId, expertId) {
    const snapshot = readSessionSnapshot(sessionId)
    if (snapshot?.persona?.systemPrompt) {
      return {
        ok: true,
        source: 'snapshot',
        expertId: snapshot.expertId,
        persona: snapshot.persona,
        bindings: snapshot.bindings,
        hashes: snapshot.hashes,
      }
    }
    if (!expertId) {
      return { ok: false, code: 'no_persona', message: 'Session 无快照且未指定 expertId' }
    }
    const expert = loadExpert(expertId)
    if (!expert.ok) return expert
    return {
      ok: true,
      source: 'live',
      expertId: expert.id,
      persona: {
        name: expert.name,
        description: expert.description,
        avatar: expert.avatar,
        systemPrompt: expert.systemPrompt,
      },
      bindings: {
        skills: expert.skills,
        connectors: expert.connectors,
      },
      hashes: {
        expert: expert.manifest.contentHash,
      },
    }
  }

  function buildTryChatSession(expertId, options = {}) {
    const eid = normalizeExpertId(expertId)
    const expert = loadExpert(eid)
    if (!expert.ok) return expert

    const sessionId = String(
      options.sessionId || `try-${eid}-${crypto.randomBytes(4).toString('hex')}`,
    ).trim()

    const snapshotResult = createSessionSnapshot(sessionId, eid)
    if (!snapshotResult.ok) return snapshotResult

    return {
      ok: true,
      session: {
        id: sessionId,
        expertId: eid,
        ephemeral: true,
        title: `试聊 · ${expert.name}`,
        persona: snapshotResult.snapshot.persona,
        bindings: snapshotResult.snapshot.bindings,
        snapshotPath: snapshotResult.path,
      },
    }
  }

  return {
    loadExpert,
    listExperts,
    saveExpert,
    validateBindings,
    createSessionSnapshot,
    readSessionSnapshot,
    getSessionPersona,
    buildTryChatSession,
  }
}

module.exports = {
  createExpertRuntime,
  parseExpertFrontmatter,
  parseManifestJson,
  validateExpertPackage,
  validateBindings,
  buildManifest,
  atomicWriteJson,
  contentHash,
}

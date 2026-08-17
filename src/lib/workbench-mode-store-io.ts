'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const STORE_VERSION = 1
const MAX_BINDINGS_PER_MODE = 32
const BUILTIN_MODE_IDS = Object.freeze(['office', 'engineering', 'visual'])
const DEFAULT_MODE_ID = 'office'
const TEXT_MAX = 120
const DEVICE_NAME_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i
const ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/i

const BUILTIN_MODES = Object.freeze({
  office: Object.freeze({
    id: 'office',
    name: '日常办公',
    description: '处理会议、文档、沟通与研究等日常工作。',
    icon: 'office',
    accent: '#5c6b5a',
    professionalCapabilities: Object.freeze([
      { id: 'local-agent', label: '本地 Agent', status: 'available' },
      { id: 'feishu-suite', label: '飞书协作能力', status: 'setup_required' },
    ]),
    providers: Object.freeze([
      { id: 'local-agent', label: '本机 Agent', kind: 'local', status: 'available' },
      { id: 'feishu-connector', label: '飞书连接器', kind: 'connector', status: 'setup_required' },
    ]),
    suggestedRoles: Object.freeze([
      { id: 'office-assistant', label: '办公助手' },
    ]),
  }),
  engineering: Object.freeze({
    id: 'engineering',
    name: '软件研发',
    description: '产品、开发、测试协作完成软件交付。',
    icon: 'engineering',
    accent: '#2f5d50',
    professionalCapabilities: Object.freeze([
      { id: 'daemon-workflows', label: '编码工作流', status: 'available' },
      { id: 'agent-team', label: '多 Agent 协作', status: 'available' },
    ]),
    providers: Object.freeze([
      { id: 'workbench-daemon', label: '管线服务', kind: 'daemon', status: 'offline' },
    ]),
    suggestedRoles: Object.freeze([
      { id: 'product', label: '产品' },
      { id: 'developer', label: '开发' },
      { id: 'tester', label: '测试' },
    ]),
  }),
  visual: Object.freeze({
    id: 'visual',
    name: '视觉创作',
    description: '组合文案、视觉与图像生成能力完成内容创作。',
    icon: 'visual',
    accent: '#7a5c72',
    professionalCapabilities: Object.freeze([
      { id: 'image-generation', label: '图像生成', status: 'setup_required' },
      { id: 'copywriting', label: '文案创作', status: 'available' },
    ]),
    providers: Object.freeze([
      { id: 'image-provider', label: '图像执行服务', kind: 'image', status: 'setup_required' },
    ]),
    suggestedRoles: Object.freeze([
      { id: 'designer', label: '设计师' },
      { id: 'copywriter', label: '文案' },
    ]),
  }),
})

function nowIso() {
  return new Date().toISOString()
}

function truncate(text, max = TEXT_MAX) {
  const value = String(text || '').trim()
  if (value.length <= max) return value
  return `${value.slice(0, Math.max(0, max - 1))}…`
}

function resolvePaths(userData) {
  return {
    file: path.join(String(userData || ''), 'workbench-modes.json'),
  }
}

function normalizeId(id, label = '标识') {
  const value = String(id || '').trim()
  if (!value || !ID_RE.test(value)) {
    return { ok: false, error: `无效的${label}` }
  }
  if (DEVICE_NAME_RE.test(value)) {
    return { ok: false, error: `${label}不能使用 Windows 保留设备名` }
  }
  return { ok: true, id: value }
}

function normalizeExpertId(expertId) {
  return normalizeId(expertId, 'Expert 标识')
}

function normalizeModeId(modeId) {
  const parsed = normalizeId(modeId, '工作模式标识')
  if (!parsed.ok) return parsed
  if (!BUILTIN_MODE_IDS.includes(parsed.id)) {
    return { ok: false, error: '未知的工作模式' }
  }
  return parsed
}

function defaultPersistedState() {
  return {
    version: STORE_VERSION,
    activeModeId: DEFAULT_MODE_ID,
    bindings: {
      office: [],
      engineering: [],
      visual: [],
    },
    updatedAt: nowIso(),
  }
}

function readJson(file, fsImpl = fs) {
  try {
    return JSON.parse(fsImpl.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function renameWithRetrySync(src, dest, options = {}) {
  const retries = Number.isInteger(options.retries) ? Math.max(0, options.retries) : 4
  const delays = Array.isArray(options.delays) && options.delays.length
    ? options.delays
    : [20, 50, 100, 200]
  const renameSync = typeof options.renameSync === 'function' ? options.renameSync : fs.renameSync
  let lastError = null
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      renameSync(src, dest)
      return { ok: true, attempts: attempt + 1 }
    } catch (error) {
      lastError = error
      const retryable = ['EPERM', 'EACCES', 'EBUSY'].includes(error?.code)
      if (!retryable || attempt >= retries) break
      const delay = Number(delays[Math.min(attempt, delays.length - 1)]) || 0
      if (delay > 0) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay)
      }
    }
  }
  return { ok: false, error: lastError }
}

function writeJsonAtomic(file, data, fsImpl = fs) {
  const dir = path.dirname(file)
  fsImpl.mkdirSync(dir, { recursive: true })
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`
  fsImpl.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
  const renamed = renameWithRetrySync(tmp, file, { renameSync: fsImpl.renameSync.bind(fsImpl) })
  if (!renamed.ok) {
    try { fsImpl.rmSync(tmp, { force: true }) } catch { /* best effort */ }
    throw renamed.error
  }
}

function normalizeBinding(raw = {}) {
  const parsed = normalizeExpertId(raw.expertId)
  if (!parsed.ok) return null
  const addedAt = String(raw.addedAt || '').trim() || nowIso()
  return { expertId: parsed.id, addedAt }
}

function normalizeBindingsForMode(items) {
  if (!Array.isArray(items)) return []
  const seen = new Set()
  const next = []
  for (const item of items) {
    const binding = normalizeBinding(item)
    if (!binding || seen.has(binding.expertId)) continue
    seen.add(binding.expertId)
    next.push(binding)
    if (next.length >= MAX_BINDINGS_PER_MODE) break
  }
  return next
}

function normalizePersistedState(raw) {
  if (!raw || typeof raw !== 'object') {
    return { state: defaultPersistedState(), degraded: true, reason: 'corrupt' }
  }
  if (raw.version !== STORE_VERSION) {
    return { state: defaultPersistedState(), degraded: true, reason: 'version' }
  }

  const activeParsed = normalizeModeId(raw.activeModeId)
  const activeModeId = activeParsed.ok ? activeParsed.id : DEFAULT_MODE_ID
  const degraded = !activeParsed.ok

  const bindings = {}
  const sourceBindings = raw.bindings && typeof raw.bindings === 'object' ? raw.bindings : {}
  for (const modeId of BUILTIN_MODE_IDS) {
    bindings[modeId] = normalizeBindingsForMode(sourceBindings[modeId])
  }

  return {
    state: {
      version: STORE_VERSION,
      activeModeId,
      bindings,
      updatedAt: String(raw.updatedAt || '').trim() || nowIso(),
    },
    degraded,
    reason: degraded ? 'active_mode' : '',
  }
}

function isBuiltinRoleId(modeId, expertId) {
  const template = BUILTIN_MODES[modeId]
  if (!template) return false
  return template.suggestedRoles.some((role) => role.id === expertId)
}

function cloneTemplateList(items = []) {
  return items.map((item) => ({ ...item }))
}

function defaultCatalogProjector(expertIds = []) {
  const map = new Map()
  for (const expertId of expertIds) {
    map.set(expertId, {
      label: expertId,
      status: 'missing',
      description: '',
    })
  }
  return map
}

function defaultDaemonProjector() {
  return { online: false }
}

function applyDaemonProjection(modeId, template, daemon = {}) {
  if (modeId !== 'engineering') {
    return {
      professionalCapabilities: cloneTemplateList(template.professionalCapabilities),
      providers: cloneTemplateList(template.providers),
    }
  }

  const online = daemon.online === true
  const professionalCapabilities = cloneTemplateList(template.professionalCapabilities).map((item) => {
    if (item.id === 'daemon-workflows') {
      return { ...item, status: online ? 'available' : 'offline' }
    }
    return item
  })
  const providers = cloneTemplateList(template.providers).map((item) => {
    if (item.id === 'workbench-daemon') {
      return {
        ...item,
        status: online ? 'available' : 'offline',
        label: truncate(item.label),
      }
    }
    return item
  })
  return { professionalCapabilities, providers }
}

function projectBinding(binding, catalog) {
  const projection = catalog.get(binding.expertId) || {
    label: binding.expertId,
    status: 'missing',
    description: '',
  }
  return {
    expertId: binding.expertId,
    addedAt: binding.addedAt,
    label: truncate(projection.label || binding.expertId),
    status: projection.status || 'missing',
    description: truncate(projection.description || ''),
    source: 'user',
    removable: true,
  }
}

function buildModeDto(modeId, persisted, catalog, daemonProjector) {
  const template = BUILTIN_MODES[modeId]
  const daemon = daemonProjector(modeId, persisted)
  const projected = applyDaemonProjection(modeId, template, daemon)
  const bindings = (persisted.bindings[modeId] || []).map((binding) => projectBinding(binding, catalog))

  return {
    id: template.id,
    name: truncate(template.name),
    description: truncate(template.description),
    icon: template.icon,
    accent: template.accent,
    professionalCapabilities: projected.professionalCapabilities.map((item) => ({
      id: item.id,
      label: truncate(item.label),
      status: item.status,
    })),
    providers: projected.providers.map((item) => ({
      id: item.id,
      label: truncate(item.label),
      kind: item.kind,
      status: item.status,
    })),
    suggestedRoles: template.suggestedRoles.map((role) => ({
      id: role.id,
      label: truncate(role.label),
      source: 'builtin',
      removable: false,
    })),
    bindings,
  }
}

function collectExpertIds(persisted) {
  const ids = new Set()
  for (const modeId of BUILTIN_MODE_IDS) {
    for (const binding of persisted.bindings[modeId] || []) {
      ids.add(binding.expertId)
    }
  }
  return [...ids]
}

module.exports = {
  nowIso,
  truncate,
  resolvePaths,
  normalizeId,
  normalizeExpertId,
  normalizeModeId,
  defaultPersistedState,
  readJson,
  renameWithRetrySync,
  writeJsonAtomic,
  normalizeBinding,
  normalizeBindingsForMode,
  normalizePersistedState,
  isBuiltinRoleId,
  cloneTemplateList,
  defaultCatalogProjector,
  defaultDaemonProjector,
  applyDaemonProjection,
  projectBinding,
  buildModeDto,
  collectExpertIds,
  BUILTIN_MODES,
}

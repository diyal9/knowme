'use strict'

/**
 * GPU 崩溃自动回退状态（userData）。
 * 崩溃后下次启动自动走软件路径；稳定运行一段时间后自动清除以再探测。
 */

const FALLBACK_FILE = 'gpu-fallback.json'
/** 崩溃回退后至少保持软件路径的时长，之后允许再试硬件加速。 */
const FALLBACK_TTL_MS = 24 * 60 * 60 * 1000
/** 软件路径下连续稳定这么久则清除回退，下次启动再探测 GPU。 */
const RECOVERY_STABLE_MS = 30 * 60 * 1000

/**
 * @param {string} userDataDir
 * @param {{ existsSync: Function, readFileSync: Function, writeFileSync: Function, mkdirSync: Function }} fs
 * @param {{ join: Function }} path
 */
function fallbackPath(userDataDir, path) {
  return path.join(userDataDir, FALLBACK_FILE)
}

function readGpuFallback(userDataDir, fs, path, now = Date.now()) {
  const file = fallbackPath(userDataDir, path)
  if (!fs.existsSync(file)) {
    return { active: false, state: null }
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    const updatedAt = Number(raw.updatedAt) || 0
    const age = now - updatedAt
    if (age > FALLBACK_TTL_MS) {
      return { active: false, state: raw, expired: true }
    }
    return { active: true, state: raw }
  } catch {
    return { active: false, state: null }
  }
}

/** 记录 GPU 崩溃，供下次启动自动降级。 */
function markGpuCrash(userDataDir, fs, path, now = Date.now()) {
  const file = fallbackPath(userDataDir, path)
  try {
    fs.mkdirSync(userDataDir, { recursive: true })
  } catch { /* exists */ }
  let prev = {}
  try {
    if (fs.existsSync(file)) prev = JSON.parse(fs.readFileSync(file, 'utf8')) || {}
  } catch { /* ignore */ }
  const next = {
    reason: 'crash',
    crashCount: Number(prev.crashCount || 0) + 1,
    updatedAt: now,
    stableSince: null,
  }
  fs.writeFileSync(file, JSON.stringify(next, null, 2), 'utf8')
  return next
}

/** 软件路径下标记进入稳定期；满 RECOVERY_STABLE_MS 后清除文件。 */
function noteGpuFallbackStable(userDataDir, fs, path, now = Date.now()) {
  const file = fallbackPath(userDataDir, path)
  if (!fs.existsSync(file)) return { cleared: false }
  let state
  try {
    state = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return { cleared: false }
  }
  if (!state.stableSince) {
    state.stableSince = now
    fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf8')
    return { cleared: false, stableSince: now }
  }
  if (now - Number(state.stableSince) >= RECOVERY_STABLE_MS) {
    try { fs.unlinkSync(file) } catch { /* ignore */ }
    return { cleared: true }
  }
  return { cleared: false, stableSince: state.stableSince }
}

function clearGpuFallback(userDataDir, fs, path) {
  const file = fallbackPath(userDataDir, path)
  try { fs.unlinkSync(file) } catch { /* ignore */ }
}

module.exports = {
  FALLBACK_FILE,
  FALLBACK_TTL_MS,
  RECOVERY_STABLE_MS,
  readGpuFallback,
  markGpuCrash,
  noteGpuFallbackStable,
  clearGpuFallback,
}

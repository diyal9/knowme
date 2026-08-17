'use strict'

/**
 * Windows Electron GPU / UI 降频策略：自动判断，不依赖用户配置。
 * 远程 → UI 降频（保留硬件加速）；GPU 崩溃回退 → 软件路径。
 * 不负责 appendSwitch / 落盘。
 */

const REMOTE_SESSION_RE = /^RDP-Tcp/i

/** 远程桌面启发式：SESSIONNAME 或 CLIENTNAME（RDP 常在 Console 下仍带 CLIENTNAME）。 */
function detectRemoteDesktop(env = process.env) {
  if (REMOTE_SESSION_RE.test(String(env.SESSIONNAME || ''))) return true
  const client = String(env.CLIENTNAME || '').trim()
  if (client) return true
  return false
}

/**
 * @param {{
 *   env?: NodeJS.ProcessEnv,
 *   crashFallbackActive?: boolean,
 * }} [opts]
 * @returns {{
 *   isRemoteDesktop: boolean,
 *   disableGpu: boolean,
 *   applyRdpSwiftShader: boolean,
 *   useInProcessGpu: boolean,
 *   uiThrottle: boolean,
 *   liveNowIntervalMs: number,
 *   runTelemetryIntervalMs: number,
 *   reason: '' | 'remote' | 'crash' | 'env'
 * }}
 */
function resolveWindowsGpuPolicy(opts = {}) {
  const env = opts.env || process.env
  const crashFallbackActive = Boolean(opts.crashFallbackActive)
  const forceGpu = String(env.KNOWME_FORCE_GPU || '').trim() === '1'
  const forceDisable = String(env.KNOWME_DISABLE_GPU || '').trim() === '1'
  const isRemoteDesktop = detectRemoteDesktop(env)

  // 隐藏逃生舱（非正常路径）
  if (forceGpu) {
    return buildResult({
      isRemoteDesktop,
      disableGpu: false,
      applyRdpSwiftShader: false,
      useInProcessGpu: isRemoteDesktop,
      uiThrottle: isRemoteDesktop,
      reason: '',
    })
  }

  if (forceDisable) {
    return buildResult({
      isRemoteDesktop,
      disableGpu: true,
      applyRdpSwiftShader: isRemoteDesktop,
      useInProcessGpu: false,
      uiThrottle: true,
      reason: 'env',
    })
  }

  // 崩溃回退：自动切软件路径（无需用户配置）
  if (crashFallbackActive) {
    return buildResult({
      isRemoteDesktop,
      disableGpu: true,
      applyRdpSwiftShader: isRemoteDesktop,
      useInProcessGpu: false,
      uiThrottle: true,
      reason: 'crash',
    })
  }

  // 远程：降频 + in-process-gpu，默认保留硬件加速（避免无条件软件合成卡顿）
  if (isRemoteDesktop) {
    return buildResult({
      isRemoteDesktop: true,
      disableGpu: false,
      applyRdpSwiftShader: false,
      useInProcessGpu: true,
      uiThrottle: true,
      reason: 'remote',
    })
  }

  return buildResult({
    isRemoteDesktop: false,
    disableGpu: false,
    applyRdpSwiftShader: false,
    useInProcessGpu: false,
    uiThrottle: false,
    reason: '',
  })
}

function buildResult(partial) {
  const uiThrottle = Boolean(partial.uiThrottle)
  return {
    isRemoteDesktop: Boolean(partial.isRemoteDesktop),
    disableGpu: Boolean(partial.disableGpu),
    applyRdpSwiftShader: Boolean(partial.applyRdpSwiftShader),
    useInProcessGpu: Boolean(partial.useInProcessGpu),
    uiThrottle,
    liveNowIntervalMs: uiThrottle ? 1000 : 500,
    runTelemetryIntervalMs: uiThrottle ? 4000 : 2000,
    reason: partial.reason || '',
  }
}

module.exports = {
  detectRemoteDesktop,
  resolveWindowsGpuPolicy,
}

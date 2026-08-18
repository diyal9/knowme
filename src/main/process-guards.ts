'use strict'

/**
 * 进程级守卫：quit、未捕获异常、GPU/Utility 子进程退出。
 * 不负责开窗或 whenReady 业务。
 */

/** 在 workbench.create 之后注册，避免 logger/app 尚未挂上。 */
function create(ctx) {
  ctx.app.on('window-all-closed', () => { })
  ctx.app.on('before-quit', () => { ctx.isQuitting = true })
  ctx.app.on('will-quit', () => ctx.globalShortcut.unregisterAll())
  process.on('uncaughtException', err => {
    console.error('[fatal]', err?.stack || err)
    try {
      ctx.logger.error('system', 'uncaught-exception', String(err?.message || err).slice(0, 300), { stack: String(err?.stack || '').slice(0, 2000) })
    }
    catch { /* ignore */ }
  })
  process.on('unhandledRejection', err => {
    console.error('[unhandled]', err?.stack || err)
    try {
      ctx.logger.error('system', 'unhandled-rejection', String(err?.message || err).slice(0, 300), { stack: String(err?.stack || '').slice(0, 2000) })
    }
    catch { /* ignore */ }
  })
  ctx.app.on('child-process-gone', (_event, details) => {
    const type = String(details?.type || '')
    if (type === 'GPU' || type === 'Utility') {
      console.error('[child-process-gone]', details)
      try {
        ctx.logger.error('system', 'child-process-gone', `${type} 子进程退出`, { reason: details?.reason, exitCode: details?.exitCode })
      }
      catch { /* ignore */ }
    }
    // GPU 崩溃：落盘回退并自动重启一次，无需用户配环境变量
    if (type === 'GPU' && process.platform === 'win32' && !ctx._gpuCrashRelaunching) {
      try {
        const { markGpuCrash } = require('../lib/windows-gpu-fallback')
        markGpuCrash(ctx.app.getPath('userData'), ctx.fs, ctx.path)
        ctx.logger.system('gpu-policy', 'GPU crashed; relaunching with software path')
      } catch { /* ignore */ }
      // 测试缝不重启，避免 Playwright 丢窗、smoke 不可复跑
      if (process.env.KNOWME_TEST_SEAM === '1') return
      ctx._gpuCrashRelaunching = true
      try {
        ctx.app.relaunch()
        ctx.app.exit(0)
      } catch { /* ignore */ }
    }
  })
}

module.exports = { create }

'use strict'

/**
 * Log center IPC: renderer intake, query/counts/clear, open viewer/dir.
 */
function registerLogsIpc(ipcMain, deps) {
  const {
    logger,
    shell,
    LOGS_DIR,
    openLogViewer,
  } = deps

  const RENDERER_LOG_CATEGORIES = new Set(logger.CATEGORIES)
  const RENDERER_LOG_LEVELS = new Set(logger.LEVELS)

  ipcMain.on('app-log', (_e, payload = {}) => {
    try {
      const category = RENDERER_LOG_CATEGORIES.has(payload.category) ? payload.category : 'operation'
      const level = RENDERER_LOG_LEVELS.has(payload.level) ? payload.level : 'info'
      logger.log(
        category,
        level,
        String(payload.event || 'ui-event').slice(0, 120),
        String(payload.message || '').slice(0, 2000),
        payload.meta,
        { scope: String(payload.source || 'renderer').slice(0, 40) },
      )
    } catch { /* never throw from log intake */ }
  })

  ipcMain.handle('logs-query', (_e, opts = {}) => {
    const startedAt = Date.now()
    try {
      const result = logger.query(opts || {})
      const durationMs = Date.now() - startedAt
      if (durationMs >= 1800) {
        logger.warn('system', 'logs-query-slow', '日志查询耗时偏高', {
          durationMs,
          date: result.date,
          total: result.total,
          category: opts?.category || 'all',
          level: opts?.level || 'all',
        })
      }
      return { ok: true, ...result }
    } catch (err) {
      logger.error('system', 'logs-query-failed', '日志查询失败', {
        error: String(err?.message || err),
        opts,
      })
      return { ok: false, error: String(err?.message || err) }
    }
  })

  ipcMain.handle('logs-counts', (_e, date) => {
    try { return { ok: true, ...logger.counts(date) } }
    catch (err) {
      logger.error('system', 'logs-counts-failed', '日志分类统计失败', {
        error: String(err?.message || err),
        date,
      })
      return { ok: false, error: String(err?.message || err) }
    }
  })

  ipcMain.handle('logs-clear', (_e, date) => {
    try {
      const res = logger.clear(date)
      logger.operation('logs-clear', '清空日志', { date: date || 'all', removed: res.removed })
      return res
    } catch (err) { return { ok: false, error: String(err?.message || err) } }
  })

  ipcMain.on('open-logs-window', () => {
    logger.operation('logs-window-open', '打开日志中心')
    openLogViewer()
  })

  ipcMain.on('open-logs-dir', () => {
    const dir = logger.getLogDir() || LOGS_DIR
    logger.operation('logs-dir-open', '打开日志目录', { dir })
    shell.openPath(dir)
  })
}

module.exports = { registerLogsIpc }

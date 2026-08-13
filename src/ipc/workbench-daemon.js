'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')

/**
 * Workbench daemon / pipeline-service IPC surface.
 */
function registerWorkbenchDaemonIpc(ipcMain, deps) {
  const {
    shell,
    loadWorkbenchDaemonOverview,
    getWorkbenchDaemonClient,
    workbenchDaemon,
    workbenchRepo,
    loadSettings,
    loadSourcesStore,
    projectDaemonTask,
  } = deps

  /** @type {Map<number, { slug: string, controller: AbortController }>} */
  const logStreamsBySender = new Map()

  function stopLogStreamForSender(senderId) {
    const active = logStreamsBySender.get(senderId)
    if (!active) return
    try { active.controller.abort() } catch { /* ignore */ }
    logStreamsBySender.delete(senderId)
  }

  function stopLogStreamIfSlug(senderId, slug) {
    const active = logStreamsBySender.get(senderId)
    if (!active) return
    if (slug && active.slug !== slug) return
    stopLogStreamForSender(senderId)
  }

  async function materializeDaemonArtifact(slug, relPath) {
    const client = getWorkbenchDaemonClient()
    const rel = String(relPath || '').trim().replace(/\\/g, '/')
    if (!slug || !rel || rel.includes('..')) {
      return { ok: false, reason: 'invalid', error: '非法产物路径' }
    }

    let bytes = null
    const downloaded = await client.downloadArtifact(slug, rel)
    if (downloaded && downloaded.ok && downloaded.bytes && downloaded.bytes.length) {
      bytes = Buffer.isBuffer(downloaded.bytes) ? downloaded.bytes : Buffer.from(downloaded.bytes)
    } else {
      const blob = await client.workspaceBlob(slug, rel)
      if (blob && blob.ok && !blob.is_binary && typeof blob.content === 'string') {
        bytes = Buffer.from(blob.content, 'utf8')
      } else if (blob && blob.ok && blob.content_base64) {
        bytes = Buffer.from(String(blob.content_base64), 'base64')
      }
    }
    if (!bytes || !bytes.length) {
      return {
        ok: false,
        reason: 'not-generated',
        error: (downloaded && downloaded.error) || '该产物尚未生成或未同步',
      }
    }

    const safeParts = rel.split('/').filter(Boolean).map(part => part.replace(/[<>:"|?*\u0000-\u001f]/g, '_'))
    const dir = path.join(os.tmpdir(), 'knowme-daemon-artifacts', String(slug))
    const target = path.join(dir, ...safeParts)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, bytes)
    return { ok: true, target, relative: true }
  }

  ipcMain.handle('workbench-daemon-overview', async () => {
    try {
      const daemon = await loadWorkbenchDaemonOverview()
      return { ok: true, daemon }
    } catch (error) {
      return { ok: false, error: (error && error.message) || '无法读取管线服务' }
    }
  })

  ipcMain.handle('workbench-daemon-start', async (_e, payload = {}) => {
    try {
      return await getWorkbenchDaemonClient().createAndRun(payload)
    } catch (error) {
      return workbenchDaemon.normalizeError(error)
    }
  })

  ipcMain.handle('workbench-daemon-launch-context', async (_e, workflowId) => {
    try {
      return await getWorkbenchDaemonClient().launchContext(workflowId)
    } catch (error) {
      return workbenchDaemon.normalizeError(error)
    }
  })

  ipcMain.handle('workbench-daemon-task', async (_e, slug) => {
    try {
      const raw = await getWorkbenchDaemonClient().task(slug)
      if (!raw.ok) return raw
      const daemonRepo = workbenchRepo.resolveDaemonContentRepo(loadSettings())
      return {
        ...raw,
        projection: projectDaemonTask(raw, daemonRepo),
      }
    } catch (error) {
      return workbenchDaemon.normalizeError(error)
    }
  })

  ipcMain.handle('workbench-daemon-artifacts', async (_e, slug) => {
    try {
      return await getWorkbenchDaemonClient().artifacts(slug)
    } catch (error) {
      return workbenchDaemon.normalizeError(error)
    }
  })

  ipcMain.handle('workbench-daemon-progress', async (_e, slug) => {
    try {
      return await getWorkbenchDaemonClient().progress(slug)
    } catch (error) {
      return workbenchDaemon.normalizeError(error)
    }
  })

  ipcMain.handle('workbench-daemon-logs', async (_e, slug) => {
    try {
      return await getWorkbenchDaemonClient().logs(slug)
    } catch (error) {
      return workbenchDaemon.normalizeError(error)
    }
  })

  ipcMain.handle('workbench-daemon-logs-stream-start', async (e, payload = {}) => {
    const webContents = e.sender
    const senderId = webContents.id
    const slug = String(payload.slug || '').trim()
    const skipLines = Math.max(0, Number(payload.skipLines) || 0)
    if (!slug) return { ok: false, error: '缺少任务标识' }

    stopLogStreamForSender(senderId)
    const controller = new AbortController()
    logStreamsBySender.set(senderId, { slug, controller })

    const send = (event) => {
      if (webContents.isDestroyed()) return
      webContents.send('workbench-daemon-log-event', { slug, ...event })
    }

    let remainingSkip = skipLines
    // Fire-and-forget long-lived stream; invoke returns after subscribe starts.
    void (async () => {
      try {
        await getWorkbenchDaemonClient().streamLogs(slug, {
          signal: controller.signal,
          onLine: (line) => {
            if (remainingSkip > 0) {
              remainingSkip -= 1
              return
            }
            send({ type: 'line', line: String(line || '') })
          },
          onDone: (data) => {
            send({ type: 'done', data: String(data || 'end') })
          },
        })
        if (!controller.signal.aborted) send({ type: 'end' })
      } catch (error) {
        if (controller.signal.aborted) return
        const normalized = workbenchDaemon.normalizeError(error)
        send({
          type: 'error',
          error: normalized.error || normalized.message || (error && error.message) || '日志流中断',
          code: normalized.code || '',
        })
      } finally {
        const active = logStreamsBySender.get(senderId)
        if (active && active.controller === controller) logStreamsBySender.delete(senderId)
      }
    })()

    return { ok: true, slug, skipLines }
  })

  ipcMain.handle('workbench-daemon-logs-stream-stop', async (e, payload = {}) => {
    const senderId = e.sender.id
    const slug = String(payload.slug || '').trim()
    stopLogStreamIfSlug(senderId, slug)
    return { ok: true }
  })

  ipcMain.handle('workbench-daemon-events', async (_e, slug, query = {}) => {
    try {
      return await getWorkbenchDaemonClient().events(slug, query)
    } catch (error) {
      return workbenchDaemon.normalizeError(error)
    }
  })

  ipcMain.handle('workbench-daemon-changes', async (_e, slug) => {
    try {
      return await getWorkbenchDaemonClient().changes(slug)
    } catch (error) {
      return workbenchDaemon.normalizeError(error)
    }
  })

  ipcMain.handle('workbench-daemon-workspace-tree', async (_e, slug, relPath = '') => {
    try {
      return await getWorkbenchDaemonClient().workspaceTree(slug, relPath)
    } catch (error) {
      return workbenchDaemon.normalizeError(error)
    }
  })

  ipcMain.handle('workbench-daemon-workspace-blob', async (_e, slug, relPath = '') => {
    try {
      return await getWorkbenchDaemonClient().workspaceBlob(slug, relPath)
    } catch (error) {
      return workbenchDaemon.normalizeError(error)
    }
  })

  ipcMain.handle('workbench-daemon-artifact-open', async (_e, payload = {}) => {
    const filePath = typeof payload === 'string'
      ? payload
      : String((payload && (payload.path || payload.filePath)) || '').trim()
    const slug = typeof payload === 'object' && payload
      ? String(payload.slug || '').trim()
      : ''
    let resolved = workbenchRepo.resolveArtifactOpenPath(filePath, loadSourcesStore())
    if (!resolved.ok && slug) {
      try {
        resolved = await materializeDaemonArtifact(slug, filePath)
      } catch (error) {
        return {
          ok: false,
          reason: 'not-generated',
          error: (error && error.message) || '该产物尚未生成或未同步',
        }
      }
    }
    if (!resolved.ok) {
      return {
        ok: false,
        reason: resolved.reason || 'not-generated',
        error: resolved.error || '该产物尚未生成或未同步',
      }
    }
    try {
      const err = await shell.openPath(resolved.target)
      if (err) return { ok: false, reason: 'open-failed', error: err }
      return { ok: true, path: resolved.target }
    } catch (error) {
      return { ok: false, reason: 'open-failed', error: error.message || String(error) }
    }
  })

  ipcMain.handle('workbench-daemon-gate', async (_e, slug, payload = {}) => {
    try {
      return await getWorkbenchDaemonClient().decide(slug, payload)
    } catch (error) {
      return workbenchDaemon.normalizeError(error)
    }
  })

  ipcMain.handle('workbench-daemon-clarify', async (_e, slug, payload = {}) => {
    try {
      return await getWorkbenchDaemonClient().clarify(slug, payload)
    } catch (error) {
      return workbenchDaemon.normalizeError(error)
    }
  })

  ipcMain.handle('workbench-daemon-cancel', async (_e, slug, payload = {}) => {
    try {
      return await getWorkbenchDaemonClient().cancel(slug, payload)
    } catch (error) {
      return workbenchDaemon.normalizeError(error)
    }
  })
}

module.exports = { registerWorkbenchDaemonIpc }

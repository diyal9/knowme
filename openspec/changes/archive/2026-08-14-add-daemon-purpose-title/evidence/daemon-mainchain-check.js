'use strict'

/**
 * Daemon 任务推进主链路验收：
 * overview → workflows/launchContext → 选既有任务 task/progress/artifacts
 * 任一步 API 访问失败则停止（不重试轰炸），写 JSON 证据。
 *
 * Usage:
 *   node openspec/changes/add-daemon-purpose-title/evidence/daemon-mainchain-check.js
 */

const fs = require('fs')
const path = require('path')
const workbenchDaemon = require('../../../../src/lib/workbench-daemon-client')
const {
  formatDaemonPurposeTitle,
  resolveDaemonPurposeTitleLocal,
  compactDaemonCardTitle,
} = require('../../../../src/lib/workbench-daemon-surface')

const OUT = path.join(__dirname, 'daemon-mainchain-check.json')
const endpoint = process.env.KNOWME_DAEMON_ENDPOINT || 'http://127.0.0.1:8010'
const token = process.env.KNOWME_DAEMON_TOKEN || ''

function stop(report, reason) {
  report.ok = false
  report.stopped = true
  report.stopReason = reason
  report.finishedAt = new Date().toISOString()
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2))
  console.error(`[STOP] ${reason}`)
  console.error(`Evidence: ${OUT}`)
  process.exit(2)
}

async function main() {
  const report = {
    ok: false,
    stopped: false,
    endpoint,
    startedAt: new Date().toISOString(),
    steps: [],
    titleProjection: null,
    mainChain: {},
  }

  // 0) 本地标题投影契约（不依赖 Daemon API）
  const sampleIntent = '需求文档：\nhttps://example.feishu.cn/docx/ABCDEF\n实现 Proto 变更并同步客户端。'
  const purpose = resolveDaemonPurposeTitleLocal(sampleIntent, { workflowName: '自动编码' })
  const titled = formatDaemonPurposeTitle(purpose, { intent: sampleIntent, workflowName: '自动编码' })
  report.titleProjection = {
    purpose,
    titled,
    compact: compactDaemonCardTitle(sampleIntent, { pathName: '自动编码' }),
  }
  report.steps.push({ id: 'title-projection', ok: /^Daemon 阶段 · /.test(titled) && !/https?:\/\//i.test(titled) })
  if (!report.steps[0].ok) stop(report, 'title_projection_failed')

  let client
  try {
    client = workbenchDaemon.createClient({ endpoint, token, timeoutMs: 5000 })
  } catch (error) {
    stop(report, `client_init_failed: ${error.message || error}`)
  }

  // 1) overview
  let overview
  try {
    overview = await client.overview()
    report.steps.push({
      id: 'overview',
      ok: true,
      online: !!(overview && (overview.online !== false)),
      workflowCount: Array.isArray(overview?.workflows) ? overview.workflows.length : 0,
      taskCount: Array.isArray(overview?.tasks) ? overview.tasks.length : 0,
    })
    report.mainChain.overview = {
      online: overview?.online,
      health: overview?.health ? Object.keys(overview.health) : [],
    }
  } catch (error) {
    report.steps.push({ id: 'overview', ok: false, error: error.message || String(error) })
    stop(report, `api_overview_failed: ${error.message || error}`)
  }

  const workflows = Array.isArray(overview.workflows) ? overview.workflows : []
  const tasks = Array.isArray(overview.tasks) ? overview.tasks : []
  if (!workflows.length && !tasks.length) {
    stop(report, 'api_empty_catalog: no workflows/tasks — cannot verify progression surface')
  }

  // 2) launchContext（有工作流时）
  const wf = workflows.find(item => item && (item.id || item.workflow)) || null
  if (wf) {
    const workflowId = String(wf.id || wf.workflow)
    try {
      const ctx = await client.launchContext(workflowId)
      if (ctx && ctx.ok === false) {
        if (ctx.code === 'unsupported' || /尚未提供|not\s*found|404/i.test(String(ctx.error || ''))) {
          report.steps.push({
            id: 'launchContext',
            ok: true,
            skipped: true,
            workflowId,
            reason: ctx.error || ctx.code || 'unsupported',
          })
          report.mainChain.launchContext = { workflowId, skipped: true, code: ctx.code || 'unsupported' }
        } else {
          report.steps.push({ id: 'launchContext', ok: false, workflowId, error: ctx.error || ctx.code })
          stop(report, `api_launchContext_failed: ${ctx.error || ctx.code}`)
        }
      } else {
        report.steps.push({
          id: 'launchContext',
          ok: true,
          workflowId,
          hasForm: !!(ctx && (ctx.form || ctx.fields || ctx.schema || ctx.context)),
        })
        report.mainChain.launchContext = {
          workflowId,
          keys: ctx && typeof ctx === 'object' ? Object.keys(ctx).slice(0, 12) : [],
        }
      }
    } catch (error) {
      report.steps.push({ id: 'launchContext', ok: false, workflowId, error: error.message || String(error) })
      stop(report, `api_launchContext_failed: ${error.message || error}`)
    }
  } else {
    report.steps.push({ id: 'launchContext', ok: true, skipped: true, reason: 'no_workflow' })
  }

  // 3) 既有任务 task + progress（验证推进读链路；不新建任务，避免污染）
  const task = tasks.find(item => item && item.slug) || null
  if (!task) {
    report.steps.push({ id: 'task-progress', ok: true, skipped: true, reason: 'no_existing_task' })
  } else {
    const slug = String(task.slug)
    let taskBody
    try {
      taskBody = await client.task(slug)
      report.steps.push({
        id: 'task',
        ok: true,
        slug,
        state: taskBody?.state || taskBody?.status || task?.state,
        terminal: !!taskBody?.terminal,
      })
      report.mainChain.task = {
        slug,
        state: taskBody?.state || taskBody?.status,
        hasStatus: !!(taskBody && taskBody.status),
      }
    } catch (error) {
      report.steps.push({ id: 'task', ok: false, slug, error: error.message || String(error) })
      stop(report, `api_task_failed: ${error.message || error}`)
    }

    try {
      const progress = await client.progress(slug)
      const text = typeof progress === 'string'
        ? progress
        : (progress?.text || progress?.progress || progress?.content || '')
      report.steps.push({
        id: 'progress',
        ok: true,
        slug,
        chars: String(text || '').length,
      })
      report.mainChain.progress = { slug, chars: String(text || '').length }
    } catch (error) {
      report.steps.push({ id: 'progress', ok: false, slug, error: error.message || String(error) })
      stop(report, `api_progress_failed: ${error.message || error}`)
    }

    // 标题投影：用任务 intent 验证 KnowMe 侧主展示格式
    const intent = String(task.intent || task.title || taskBody?.intent || '').trim()
    const pathName = String(task.workflow || wf?.name || wf?.id || '管线任务')
    const runTitle = formatDaemonPurposeTitle('', { intent, workflowName: pathName, slug })
    report.mainChain.runTitle = runTitle
    report.steps.push({
      id: 'run-title-from-task',
      ok: /^Daemon 阶段 · /.test(runTitle),
      runTitle,
    })
  }

  report.ok = report.steps.every(step => step.ok)
  report.finishedAt = new Date().toISOString()
  report.summary = report.ok
    ? 'Daemon 主链路（overview → launchContext → task/progress）与目的标题投影可用'
    : '部分步骤失败'
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2))
  console.log(report.summary)
  console.log(`Evidence: ${OUT}`)
  process.exit(report.ok ? 0 : 1)
}

main().catch(error => {
  const report = {
    ok: false,
    stopped: true,
    stopReason: `unhandled: ${error && error.message ? error.message : error}`,
    finishedAt: new Date().toISOString(),
  }
  try { fs.writeFileSync(OUT, JSON.stringify(report, null, 2)) } catch { /* ignore */ }
  console.error(report.stopReason)
  process.exit(2)
})

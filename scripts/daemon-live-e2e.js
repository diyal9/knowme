'use strict'

const fs = require('fs')
const path = require('path')
const workbenchDaemon = require('../src/lib/workbench-daemon-client')

const ROOT = path.join(__dirname, '..')
const OUT = process.env.GAME_STUDIO_EVIDENCE
  ? path.resolve(process.env.GAME_STUDIO_EVIDENCE)
  : path.join(ROOT, 'openspec/changes/archive/2026-08-04-game-studio-work-partner-daemon/evidence')
const REPORT = path.join(OUT, 'daemon-live-e2e.json')

async function main() {
  const client = workbenchDaemon.createClient({
    endpoint: process.env.KNOWME_WORKBENCH_URL || 'http://127.0.0.1:8010',
    token: process.env.KNOWME_WORKBENCH_TOKEN || '',
  })
  const report = {
    at: new Date().toISOString(),
    endpoint: client.endpoint,
    steps: [],
    ok: false,
  }

  const overview = await client.overview()
  report.steps.push({
    step: 'health+workflows',
    ok: !!overview.online,
    workflowCount: (overview.workflows || []).length,
    auth: overview.auth || null,
    code: overview.code || null,
  })
  if (!overview.online) {
    fs.mkdirSync(OUT, { recursive: true })
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))
    console.error('Daemon offline:', overview.error || overview.code)
    process.exit(1)
  }

  const workflow = (overview.workflows || []).find(w => w.id === 'demo-experience')
    || overview.workflows[0]
  const slug = `demo-knowme-live-${Date.now().toString(36).slice(-6)}`
  const started = await client.createAndRun({
    workflow: workflow.id,
    slug,
    intent: 'KnowMe daemon live E2E probe',
    context: {
      meta: {
        sceneId: 'game-dev',
        skillId: 'game-dev-delivery',
        handoffFrom: 'game-requirement',
        connectors: ['feishu'],
      },
    },
  })
  report.steps.push({
    step: 'createAndRun',
    ok: !!started.ok,
    slug: started.slug || slug,
    state: started.job && started.job.state,
    error: started.error || null,
    code: started.code || null,
  })
  if (!started.ok) {
    fs.mkdirSync(OUT, { recursive: true })
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))
    console.error('createAndRun failed:', started.error || started.code)
    process.exit(1)
  }

  await new Promise(r => setTimeout(r, 2000))
  const task = await client.task(started.slug)
  report.steps.push({
    step: 'taskStatus',
    ok: !!task.ok,
    state: task.state,
    terminal: task.terminal,
    reason: task.job && task.job.reason,
  })

  report.ok = report.steps.every(step => step.ok)
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

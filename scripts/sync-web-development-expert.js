'use strict'
require('./register-ts')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { createCapabilityHubService } = require('../src/lib/capability-hub-service')

async function main() {
  const args = process.argv.slice(2)
  const userDataIndex = args.indexOf('--user-data')
  const userData = path.resolve(userDataIndex >= 0 ? args[userDataIndex + 1] : path.join(process.env.APPDATA || '', 'KnowMe'))
  const bundledRoot = path.resolve(__dirname, '../src/catalog')
  const expertId = 'software-engineer'
  const manifest = JSON.parse(fs.readFileSync(path.join(bundledRoot, 'experts', expertId, 'capability.manifest.json'), 'utf8'))
  const ids = [expertId, ...manifest.dependencies.filter(item => item.kind === 'skill').map(item => item.id)]
  const taskFile = path.join(userData, 'workbench-tasks.json')
  const rawTasks = fs.existsSync(taskFile) ? JSON.parse(fs.readFileSync(taskFile, 'utf8')) : {}
  const tasks = Array.isArray(rawTasks) ? rawTasks : (rawTasks.tasks || [])
  if (tasks.some(task => task.expertId === expertId && ['starting', 'running', 'revising'].includes(task.status))) {
    throw new Error('当前专家仍有执行中的任务，请待任务结束后同步，避免中途替换能力包。')
  }
  if (!args.includes('--apply')) {
    process.stdout.write(JSON.stringify({ apply: false, userData, expertId, name: manifest.name, version: manifest.version, ids }, null, 2))
    return
  }
  const backup = path.join(userData, 'audit', `web-expert-${new Date().toISOString().replace(/[:.]/g, '-')}`)
  fs.mkdirSync(backup, { recursive: true })
  const files = ['capabilities/install-store.json', 'capabilities/catalog-overlay.json',
    `capabilities/experts/${expertId}`,
    ...ids.filter(id => id !== expertId).map(id => `capabilities/skills/${id}`)]
  for (const relative of files) {
    const source = path.join(userData, relative)
    if (!fs.existsSync(source)) continue
    const destination = path.join(backup, relative)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.cpSync(source, destination, { recursive: true, errorOnExist: true, force: false })
  }
  // A verification snapshot is temporary; historical execution snapshots stay intact.
  const snapshotRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-web-sync-check-'))
  const hub = createCapabilityHubService({ getUserData: () => userData, bundledRoot, getExpertSnapshotRoot: () => snapshotRoot })
  const result = await hub.updateCapability({ id: expertId, riskConfirmed: true })
  if (!result.ok) throw new Error(`更新失败，备份位于 ${backup}：${result.error || result.code}`)
  const expert = hub.expertRuntime().loadExpert(expertId)
  if (!expert.ok || expert.name !== manifest.name || expert.manifest.version !== manifest.version) throw new Error('专家读回验证失败')
  const skills = ['frontend-design', 'imagegen-frontend-web'].map(id => ({
    id, installed: Boolean(hub.skillRuntime().findSkillRecord(id)), enabled: hub.skillRuntime().isSkillEnabled(id),
  }))
  if (skills.some(item => !item.installed || !item.enabled)) throw new Error('专业技能安装或启用验证失败')
  const snapshot = hub.expertRuntime().createSessionSnapshot('web-expert-sync-verification', expertId)
  if (!snapshot.ok || snapshot.degraded) throw new Error(`专家快照未就绪：${JSON.stringify(snapshot.issues || snapshot.message)}`)
  const report = { ok: true, expertId, name: expert.name, version: expert.manifest.version, skills,
    bindings: snapshot.snapshot.bindings.skills, backup, userData, permissions: expert.capabilityManifest.permissions }
  fs.writeFileSync(path.join(backup, 'sync-result.json'), JSON.stringify(report, null, 2))
  process.stdout.write(JSON.stringify(report, null, 2))
}
main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1 })

'use strict'

require('./register-ts')
/**
 * Clean-environment bootstrap verification — no manual external patch required.
 * Uses temp install dir seeded from upstream anchor commit file contents.
 */

const fs = require('fs')
const os = require('os')
const path = require('path')
const { execSync } = require('child_process')
const bootstrap = require('../src/lib/workbench-bootstrap')

const ROOT = path.join(__dirname, '..')
const OUT = process.env.GAME_STUDIO_EVIDENCE
  ? path.resolve(process.env.GAME_STUDIO_EVIDENCE)
  : path.join(ROOT, 'openspec/changes/archive/2026-08-04-game-studio-work-partner-daemon/evidence')
const REPORT = path.join(OUT, 'workbench-clean-env.json')
const ANCHOR = 'ae2de9c502dc2b7d96cb3dcdbaaf0173813b914b'
const UPSTREAM_REPO = process.env.KNOWME_WORKBENCH_UPSTREAM || 'D:/workflows/workbench'

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function seedUpstreamFile(repo, commit, relPath, destPath) {
  mkdirp(path.dirname(destPath))
  const content = execSync(`git -C "${repo}" show ${commit}:${relPath}`, { encoding: 'utf8' })
  fs.writeFileSync(destPath, content, 'utf8')
}

function createCleanInstall(tempRoot) {
  const targets = bootstrap.loadManifest()?.targets || []
  for (const t of targets) {
    seedUpstreamFile(UPSTREAM_REPO, ANCHOR, t.relPath, path.join(tempRoot, t.relPath))
  }
  mkdirp(path.join(tempRoot, '.cursor', 'workflows'))
  fs.writeFileSync(path.join(tempRoot, '.cursor', 'workflows', 'index.json'), '{"version":"1.0","workflows":[]}\n')
  mkdirp(path.join(tempRoot, 'tools', 'workflow_runner'))
  fs.writeFileSync(
    path.join(tempRoot, 'tools', 'workflow_runner', 'scripts_registry.json'),
    '{"version":"1.0","scripts":{}}\n',
  )
}

function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-wb-clean-'))
  const report = {
    at: new Date().toISOString(),
    tempRoot,
    anchorCommit: ANCHOR,
    steps: [],
    ok: false,
  }

  try {
    if (!fs.existsSync(UPSTREAM_REPO)) {
      report.steps.push({ step: 'seed', ok: false, error: `upstream repo missing: ${UPSTREAM_REPO}` })
      throw new Error('upstream missing')
    }

    createCleanInstall(tempRoot)
    const needsPatch = bootstrap.detectCompatState(tempRoot)
    report.steps.push({
      step: 'detectUnpatched',
      ok: needsPatch.status === 'needs_patch',
      status: needsPatch.status,
    })

    const blocked = bootstrap.applyCompatPatch(tempRoot, { dryRun: false, force: false })
    report.steps.push({
      step: 'applyCompatClean',
      ok: blocked.ok,
      status: blocked.state?.status,
    })

    const deploy = bootstrap.deployWorkflows(tempRoot)
    report.steps.push({
      step: 'deployWorkflows',
      ok: deploy.ok,
      deployState: deploy.deployState,
    })

    const tampered = path.join(tempRoot, 'tools', 'workflow_runner', 'daemon', '__main__.py')
    const loopPath = path.join(tempRoot, 'tools', 'workflow_runner', 'orchestrator', 'loop.py')
    fs.writeFileSync(tampered, '# tampered without compat marker\n')
    fs.writeFileSync(loopPath, '# tampered loop unknown\n')
    const unknown = bootstrap.detectCompatState(tempRoot)
    report.steps.push({
      step: 'unknownVersionBlocks',
      ok: unknown.status === 'unknown_version',
      status: unknown.status,
    })

    const tamperApply = bootstrap.applyCompatPatch(tempRoot)
    report.steps.push({
      step: 'tamperApplyBlocked',
      ok: !tamperApply.ok && tamperApply.code === 'unknown_version',
      code: tamperApply.code,
    })

    report.ok = report.steps.every(s => s.ok)
  } catch (error) {
    report.error = String(error.message || error)
  } finally {
    mkdirp(OUT)
    fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))
    console.log(JSON.stringify(report, null, 2))
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true })
    } catch {
      /* ignore cleanup errors */
    }
  }

  if (!report.ok) process.exit(1)
}

main()

'use strict'

/**
 * Sync KnowMe bundled workflows/scripts into local Workbench daemon repo.
 * Does NOT commit/push the external workbench repository.
 */

const fs = require('fs')
const path = require('path')

const KNOWME_ROOT = path.join(__dirname, '..')
const WORKBENCH_ROOT = process.env.KNOWME_WORKBENCH_ROOT || 'D:/workflows/workbench'

const WORKFLOW_FILES = [
  'game-dev-delivery.json',
]

const SCRIPT_REGISTRY_ENTRY = {
  'knowme-game-dev-deliver': {
    title: 'KnowMe game dev delivery pack',
    cwd: '.',
    command: ['python', 'tools/knowme/game-dev-deliver.py', '--task', '{task_slug}'],
    timeout_sec: 120,
    report_title: 'Game Dev Delivery Report',
  },
}

const INDEX_ENTRY = {
  id: 'game-dev-delivery',
  name: '手机游戏研发交付',
  path: 'custom/game-dev-delivery.json',
  description: '从已批准需求案 ingest/brief.md 生成交付包（脚本链路，无需 Cursor CLI）',
  tags: ['game', 'knowme', 'script-only', 'mvp'],
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest))
  fs.copyFileSync(src, dest)
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

function upsertWorkflowIndex(indexPath) {
  const index = readJson(indexPath, { version: '1.0', workflows: [] })
  index.workflows = Array.isArray(index.workflows) ? index.workflows : []
  const existing = index.workflows.findIndex(w => w.id === INDEX_ENTRY.id)
  if (existing >= 0) index.workflows[existing] = { ...index.workflows[existing], ...INDEX_ENTRY }
  else index.workflows.unshift(INDEX_ENTRY)
  writeJson(indexPath, index)
}

function upsertScriptsRegistry(registryPath) {
  const registry = readJson(registryPath, { version: '1.0', scripts: {} })
  registry.scripts = registry.scripts || {}
  Object.assign(registry.scripts, SCRIPT_REGISTRY_ENTRY)
  writeJson(registryPath, registry)
}

function patchDaemonMain(mainPath) {
  let text = fs.readFileSync(mainPath, 'utf8')
  const marker = 'def _workflow_requires_cli('
  if (!text.includes(marker)) {
    const helper = `

def _workflow_requires_cli(workflow_id: str, root: Path) -> bool:
    try:
        from ..subflows import load_workflow
    except ImportError:
        from subflows import load_workflow  # type: ignore
    try:
        wf = load_workflow(workflow_id, root)
    except SystemExit:
        return True
    if wf.get("cli_required") is False:
        return False
    nodes = wf.get("nodes") or []
    return any(str(n.get("type", "agent")) == "agent" for n in nodes)
`
    const anchor = 'def _make_logger(task: str, root: Path):'
    if (!text.includes(anchor)) {
      throw new Error(`cannot patch daemon main: missing anchor in ${mainPath}`)
    }
    text = text.replace(anchor, `${helper}\n${anchor}`)
  }

  const oldBlock = `    cli_runtime = None
    if getattr(args, "skip_cli_preflight", False):`
  const newBlock = `    requires_cli = _workflow_requires_cli(workflow, root)
    skip_preflight = getattr(args, "skip_cli_preflight", False) or not requires_cli
    cli_runtime = None
    if skip_preflight:`
  if (text.includes(oldBlock)) text = text.replace(oldBlock, newBlock)

  fs.writeFileSync(mainPath, text, 'utf8')
}

function patchOrchestratorLoop(loopPath) {
  let text = fs.readFileSync(loopPath, 'utf8')
  if (text.includes('skip_cli_preflight: bool = False')) return

  text = text.replace(
    `def build_command(
    python: str,
    job: "dao.JobView",
    feishu_notify: bool,
    *,
    intent: str = "",
) -> list[str]:`,
    `def build_command(
    python: str,
    job: "dao.JobView",
    feishu_notify: bool,
    *,
    intent: str = "",
    skip_cli_preflight: bool = False,
) -> list[str]:`,
  )

  text = text.replace(
    `    if job.from_node:
        cmd += ["--from", job.from_node]
    return cmd`,
    `    if job.from_node:
        cmd += ["--from", job.from_node]
    if skip_cli_preflight:
        cmd.append("--skip-cli-preflight")
    return cmd`,
  )

  const spawnAnchor = `        cmd = build_command(
            self.python, job, job.notify_mode == "feishu_offline", intent=self._task_intent(job),
        )`
  const spawnReplacement = `        try:
            from ..subflows import load_workflow
        except ImportError:
            from subflows import load_workflow  # type: ignore
        try:
            wf = load_workflow(job.workflow, self.root)
            requires_cli = wf.get("cli_required") is not False and any(
                str(n.get("type", "agent")) == "agent" for n in (wf.get("nodes") or [])
            )
        except SystemExit:
            requires_cli = True
        cmd = build_command(
            self.python,
            job,
            job.notify_mode == "feishu_offline",
            intent=self._task_intent(job),
            skip_cli_preflight=not requires_cli,
        )`

  if (text.includes(spawnAnchor)) text = text.replace(spawnAnchor, spawnReplacement)
  else if (!text.includes('skip_cli_preflight=not requires_cli')) {
    throw new Error(`cannot patch orchestrator loop spawn in ${loopPath}`)
  }

  fs.writeFileSync(loopPath, text, 'utf8')
}

function main() {
  if (!fs.existsSync(WORKBENCH_ROOT)) {
    console.error('Workbench root not found:', WORKBENCH_ROOT)
    process.exit(1)
  }

  const knowmeWorkflowDir = path.join(KNOWME_ROOT, '.cursor/workflows')
  const wbWorkflowDir = path.join(WORKBENCH_ROOT, '.cursor/workflows/custom')
  ensureDir(wbWorkflowDir)

  for (const file of WORKFLOW_FILES) {
    copyFile(path.join(knowmeWorkflowDir, file), path.join(wbWorkflowDir, file))
  }

  copyFile(
    path.join(KNOWME_ROOT, 'scripts/game-dev-deliver.py'),
    path.join(WORKBENCH_ROOT, 'tools/knowme/game-dev-deliver.py'),
  )

  upsertWorkflowIndex(path.join(WORKBENCH_ROOT, '.cursor/workflows/index.json'))
  upsertScriptsRegistry(path.join(WORKBENCH_ROOT, 'tools/workflow_runner/scripts_registry.json'))
  patchDaemonMain(path.join(WORKBENCH_ROOT, 'tools/workflow_runner/daemon/__main__.py'))
  patchOrchestratorLoop(path.join(WORKBENCH_ROOT, 'tools/workflow_runner/orchestrator/loop.py'))

  console.log(JSON.stringify({
    ok: true,
    workbenchRoot: WORKBENCH_ROOT,
    workflows: WORKFLOW_FILES,
    script: 'tools/knowme/game-dev-deliver.py',
    patched: ['daemon/__main__.py', 'orchestrator/loop.py'],
  }, null, 2))
}

main()

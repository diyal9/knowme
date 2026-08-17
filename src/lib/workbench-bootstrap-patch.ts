'use strict'

const fs = require('fs')

function patchDaemonMain(mainPath, { dryRun = false } = {}) {
  let text = fs.readFileSync(mainPath, 'utf8')
  const marker = 'def _workflow_requires_cli('
  if (text.includes(marker)) return { changed: false, reason: 'already_applied' }

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

  const oldBlock = `    cli_runtime = None
    if getattr(args, "skip_cli_preflight", False):`
  const newBlock = `    requires_cli = _workflow_requires_cli(workflow, root)
    skip_preflight = getattr(args, "skip_cli_preflight", False) or not requires_cli
    cli_runtime = None
    if skip_preflight:`
  if (text.includes(oldBlock)) text = text.replace(oldBlock, newBlock)

  if (!dryRun) fs.writeFileSync(mainPath, text, 'utf8')
  return { changed: true, reason: 'patched' }
}

function patchOrchestratorLoop(loopPath, { dryRun = false } = {}) {
  let text = fs.readFileSync(loopPath, 'utf8')
  if (text.includes('skip_cli_preflight: bool = False')) {
    return { changed: false, reason: 'already_applied' }
  }

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

  if (!dryRun) fs.writeFileSync(loopPath, text, 'utf8')
  return { changed: true, reason: 'patched' }
}

module.exports = {
  patchDaemonMain,
  patchOrchestratorLoop,
}

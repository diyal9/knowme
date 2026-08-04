'use strict'

const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')

const KNOWME_ROOT = path.join(__dirname, '..', '..')
const COMPAT_DIR = path.join(KNOWME_ROOT, 'vendor', 'workbench-compat')
const MANIFEST_PATH = path.join(COMPAT_DIR, 'manifest.json')

const WORKFLOW_FILES = ['game-dev-delivery.json']

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

function sha256File(file) {
  const buf = fs.readFileSync(file)
  return crypto.createHash('sha256').update(buf).digest('hex')
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

function loadManifest() {
  return readJson(MANIFEST_PATH, null)
}

function isValidWorkbenchInstall(root) {
  const base = String(root || '').trim()
  if (!base) return false
  return fs.existsSync(path.join(base, 'tools', 'workflow_runner', 'daemon', '__main__.py'))
}

function discoverWorkbenchInstall() {
  const candidates = [
    process.env.KNOWME_WORKBENCH_INSTALL,
    process.env.KNOWME_WORKBENCH_ROOT,
    process.env.STICKY_WORKBENCH_ROOT,
    path.join(os.homedir(), 'workflows', 'workbench'),
    path.join('D:', 'workflows', 'workbench'),
    path.join('C:', 'workflows', 'workbench'),
  ].filter(Boolean)
  for (const c of candidates) {
    try {
      const root = path.resolve(c)
      if (isValidWorkbenchInstall(root)) return root
    } catch {
      /* ignore invalid paths */
    }
  }
  return ''
}

function resolveWorkbenchInstallPath(settings = {}) {
  const fromSettings = String(settings.workbenchInstall?.path || '').trim()
  if (fromSettings) {
    const resolved = path.resolve(fromSettings)
    if (isValidWorkbenchInstall(resolved)) return resolved
  }
  return discoverWorkbenchInstall()
}

function detectCompatState(installPath) {
  const manifest = loadManifest()
  if (!manifest) {
    return { status: 'manifest_missing', ok: false, message: '缺少 KnowMe compat manifest' }
  }
  const marker = manifest.patch?.appliedMarker || 'def _workflow_requires_cli('
  const daemonMain = path.join(installPath, 'tools', 'workflow_runner', 'daemon', '__main__.py')
  if (!fs.existsSync(daemonMain)) {
    return { status: 'invalid_install', ok: false, message: 'Workbench 安装目录无效' }
  }

  const daemonText = fs.readFileSync(daemonMain, 'utf8')
  if (daemonText.includes(marker)) {
    return {
      status: 'applied',
      ok: true,
      compatId: manifest.knowmeCompatId,
      anchorCommit: manifest.upstreamWorkbench?.anchorCommit || '',
      message: '兼容层已安装',
    }
  }

  const targets = Array.isArray(manifest.targets) ? manifest.targets : []
  const hashes = targets.map(t => {
    const file = path.join(installPath, t.relPath)
    const sha256 = fs.existsSync(file) ? sha256File(file) : ''
    return {
      relPath: t.relPath,
      sha256,
      expected: t.prePatchSha256,
      matches: sha256 === t.prePatchSha256,
    }
  })

  const allMatch = hashes.length > 0 && hashes.every(h => h.matches)
  if (allMatch) {
    return {
      status: 'needs_patch',
      ok: false,
      compatId: manifest.knowmeCompatId,
      anchorCommit: manifest.upstreamWorkbench?.anchorCommit || '',
      hashes,
      message: '需要安装 KnowMe 兼容层（script workflow 跳过 CLI preflight）',
      installCommand: 'npm run workbench:bootstrap -- --apply-compat',
    }
  }

  return {
    status: 'unknown_version',
    ok: false,
    compatId: manifest.knowmeCompatId,
    anchorCommit: manifest.upstreamWorkbench?.anchorCommit || '',
    hashes,
    message: 'Workbench 版本与 KnowMe 兼容层不匹配，无法自动修改',
    recovery: [
      `将 Workbench 检出到锚点 commit ${manifest.upstreamWorkbench?.anchorCommit || '（见 manifest）'}`,
      '或在设置中点击「安装兼容层」（仅当文件哈希匹配时允许）',
      '长期方案：向上游合并 knowme-cli-required-v1 patch',
    ],
  }
}

function detectWorkflowDeployState(installPath) {
  const wf = path.join(installPath, '.cursor', 'workflows', 'custom', 'game-dev-delivery.json')
  const script = path.join(installPath, 'tools', 'knowme', 'game-dev-deliver.py')
  const index = readJson(path.join(installPath, '.cursor', 'workflows', 'index.json'), { workflows: [] })
  const inIndex = (index.workflows || []).some(w => w.id === 'game-dev-delivery')
  const registry = readJson(path.join(installPath, 'tools', 'workflow_runner', 'scripts_registry.json'), { scripts: {} })
  const inRegistry = Boolean(registry.scripts?.['knowme-game-dev-deliver'])
  const ok = fs.existsSync(wf) && fs.existsSync(script) && inIndex && inRegistry
  return {
    ok,
    workflowFile: fs.existsSync(wf),
    scriptFile: fs.existsSync(script),
    indexEntry: inIndex,
    registryEntry: inRegistry,
  }
}

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

function applyCompatPatch(installPath, { dryRun = false, force = false } = {}) {
  const state = detectCompatState(installPath)
  if (state.status === 'applied') {
    return { ok: true, skipped: true, state, message: '兼容层已存在' }
  }
  if (state.status === 'unknown_version' && !force) {
    return {
      ok: false,
      code: 'unknown_version',
      state,
      message: state.message,
      recovery: state.recovery,
    }
  }
  if (state.status !== 'needs_patch' && state.status !== 'unknown_version') {
    return { ok: false, code: state.status, state, message: state.message || '无法应用兼容层' }
  }

  const daemonMain = path.join(installPath, 'tools', 'workflow_runner', 'daemon', '__main__.py')
  const loopPath = path.join(installPath, 'tools', 'workflow_runner', 'orchestrator', 'loop.py')
  const results = []
  if (!dryRun) {
    results.push(patchDaemonMain(daemonMain, { dryRun }))
    results.push(patchOrchestratorLoop(loopPath, { dryRun }))
  }
  const after = dryRun ? state : detectCompatState(installPath)
  return {
    ok: after.status === 'applied' || dryRun,
    dryRun,
    results,
    state: after,
    message: dryRun ? 'dry-run：将应用 compat patch' : '兼容层已安装',
  }
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

function deployWorkflows(installPath, { dryRun = false } = {}) {
  const knowmeWorkflowDir = path.join(KNOWME_ROOT, '.cursor', 'workflows')
  const wbWorkflowDir = path.join(installPath, '.cursor', 'workflows', 'custom')
  const copied = []

  for (const file of WORKFLOW_FILES) {
    const src = path.join(knowmeWorkflowDir, file)
    const dest = path.join(wbWorkflowDir, file)
    if (!fs.existsSync(src)) {
      return { ok: false, code: 'missing_bundle', message: `缺少 KnowMe workflow: ${file}` }
    }
    if (!dryRun) {
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.copyFileSync(src, dest)
    }
    copied.push(file)
  }

  const scriptSrc = path.join(KNOWME_ROOT, 'scripts', 'game-dev-deliver.py')
  const scriptDest = path.join(installPath, 'tools', 'knowme', 'game-dev-deliver.py')
  if (!fs.existsSync(scriptSrc)) {
    return { ok: false, code: 'missing_script', message: '缺少 game-dev-deliver.py' }
  }
  if (!dryRun) {
    fs.mkdirSync(path.dirname(scriptDest), { recursive: true })
    fs.copyFileSync(scriptSrc, scriptDest)
  }

  if (!dryRun) {
    upsertWorkflowIndex(path.join(installPath, '.cursor', 'workflows', 'index.json'))
    upsertScriptsRegistry(path.join(installPath, 'tools', 'workflow_runner', 'scripts_registry.json'))
  }

  const deployState = dryRun
    ? { ok: true }
    : detectWorkflowDeployState(installPath)

  return {
    ok: deployState.ok !== false,
    dryRun,
    workflows: copied,
    script: 'tools/knowme/game-dev-deliver.py',
    deployState,
  }
}

function buildPublicStatus(settings = {}, options = {}) {
  const installPath = resolveWorkbenchInstallPath(settings)
  const compat = installPath ? detectCompatState(installPath) : {
    status: 'no_install_path',
    ok: false,
    message: '未配置或未找到 Workbench 安装目录',
    recovery: [
      '在设置 → Workbench 填写本机 Daemon 对应的 Workbench 仓库路径',
      '或设置环境变量 KNOWME_WORKBENCH_INSTALL',
    ],
  }
  const deploy = installPath ? detectWorkflowDeployState(installPath) : { ok: false }
  const daemon = options.daemonOverview || {}
  const workflows = Array.isArray(daemon.workflows) ? daemon.workflows : []
  const workflowRegisteredRemote = workflows.some(w => w.id === 'game-dev-delivery')
  const tokenConfigured = Boolean(options.tokenConfigured)
  const daemonOnline = Boolean(daemon.online)

  const ready = daemonOnline
    && tokenConfigured
    && compat.ok
    && (deploy.ok || workflowRegisteredRemote)

  let blockers = []
  if (!installPath) blockers.push('install_path')
  if (!compat.ok) blockers.push('compat')
  if (!deploy.ok && !workflowRegisteredRemote) blockers.push('workflow_deploy')
  if (!tokenConfigured) blockers.push('token')
  if (!daemonOnline) blockers.push('daemon_offline')

  return {
    ok: ready,
    installPath: installPath || '',
    compat,
    deploy,
    workflowRegisteredRemote,
    daemonOnline,
    tokenConfigured,
    blockers,
    compatId: compat.compatId || loadManifest()?.knowmeCompatId || '',
    anchorCommit: compat.anchorCommit || loadManifest()?.upstreamWorkbench?.anchorCommit || '',
    actions: {
      canDeployWorkflows: Boolean(installPath),
      canApplyCompat: compat.status === 'needs_patch',
      canRepair: Boolean(installPath) && (compat.status === 'needs_patch' || !deploy.ok),
    },
    message: ready
      ? 'Workbench 已就绪，可执行 game-dev-delivery'
      : blockers.includes('compat')
        ? compat.message
        : blockers.includes('install_path')
          ? '请配置 Workbench 安装目录'
          : 'Workbench 尚未完全就绪',
    recovery: compat.recovery || [],
  }
}

function runBootstrap(settings = {}, options = {}) {
  const {
    applyCompat = false,
    deploy = true,
    dryRun = false,
    installPath: overridePath = '',
  } = options

  const installPath = String(overridePath || resolveWorkbenchInstallPath(settings)).trim()
  if (!installPath || !isValidWorkbenchInstall(installPath)) {
    return {
      ok: false,
      code: 'no_install_path',
      message: 'Workbench 安装目录无效或未配置',
    }
  }

  const steps = []
  let ok = true

  if (deploy) {
    const deployResult = deployWorkflows(installPath, { dryRun })
    steps.push({ step: 'deployWorkflows', ...deployResult })
    ok = ok && deployResult.ok
  }

  if (applyCompat) {
    const compatResult = applyCompatPatch(installPath, { dryRun })
    steps.push({ step: 'applyCompat', ...compatResult })
    ok = ok && compatResult.ok
  } else {
    const compatState = detectCompatState(installPath)
    steps.push({ step: 'compatCheck', ok: compatState.ok, state: compatState })
    if (!compatState.ok && compatState.status === 'unknown_version') ok = false
  }

  const status = buildPublicStatus(settings, options)
  return {
    ok,
    installPath,
    steps,
    status,
  }
}

module.exports = {
  KNOWME_ROOT,
  COMPAT_DIR,
  MANIFEST_PATH,
  loadManifest,
  isValidWorkbenchInstall,
  discoverWorkbenchInstall,
  resolveWorkbenchInstallPath,
  detectCompatState,
  detectWorkflowDeployState,
  applyCompatPatch,
  deployWorkflows,
  buildPublicStatus,
  runBootstrap,
  sha256File,
}

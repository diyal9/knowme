'use strict'

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const ARTBUNDLE_RECIPE_ID = 'th-art-psd-to-artbundle'
const MAX_LOG_CHARS = 16000
const MAX_AGENT_FILE_CHARS = 1024 * 1024

const ARTBUNDLE_SCRIPTS = Object.freeze({
  'probe-psd': 'scripts/probe-psd-industrial.mjs',
  'slice-export': '.cursor/skills/th-art-ui-slicer/scripts/run-slice-pipeline.mjs',
  'bundle-build': '.cursor/skills/th-art-artbundle-export/scripts/run-artbundle-export.mjs',
  'creator-preflight': 'scripts/creator-import-preflight.mjs',
  'creator-verify-absolute': 'scripts/import-artbundle-to-client.mjs',
  'creator-verify-widget': 'scripts/run-artbundle-creator-debug.mjs',
})

const ACTION_BY_NODE = Object.freeze({
  psd_layer_preread: 'probe-psd',
  slice_export: 'slice-export',
  bundle_build: 'bundle-build',
  creator_import_preflight: 'creator-preflight',
  bundle_creator_verify: 'creator-verify',
  bundle_publish: 'publish',
})

const RECIPE_INPUTS = Object.freeze([
  { id: 'goal', label: '本次运行目标', required: true, placeholder: '说明要还原的界面和验收重点' },
  { id: 'psdPath', label: 'PSD 绝对路径', required: true, placeholder: 'D:\\art\\screen.psd', description: '只读源文件；必须是普通 .psd 文件。' },
  { id: 'taskSlug', label: '任务标识', required: true, placeholder: 'daily-picks', description: '小写字母、数字和短横线，用于隔离 workflow-spec 与草稿目录。' },
  { id: 'feature', label: '功能标识', required: true, placeholder: 'daily-picks' },
  { id: 'prefabName', label: 'Prefab 名称', required: true, placeholder: 'DailyPicksView' },
  { id: 'clientRoot', label: 'Creator 工程根目录', required: true, placeholder: 'D:\\game\\client', description: '包含 assets/ 的 Cocos Creator 工程。' },
  { id: 'previewPath', label: '效果图绝对路径', required: false, placeholder: 'D:\\art\\preview.png' },
  { id: 'layoutMode', label: '布局模式', required: false, defaultValue: 'absolute', placeholder: 'absolute 或 widget' },
  { id: 'canvas', label: '画布尺寸', required: false, defaultValue: '700x1515', placeholder: '700x1515' },
  { id: 'exportId', label: '导出标识', required: false, placeholder: '默认与任务标识相同' },
])

const RECIPE_OUTPUTS = Object.freeze([
  { id: 'probe', label: 'PSD 图层与文字工业探测结果' },
  { id: 'slice', label: '经门禁确认的透明切图与 manifest' },
  { id: 'bundle', label: 'ArtBundle v2.1 制品' },
  { id: 'creator', label: 'Creator 导入与 Prefab 结构验收证据' },
])

function clone(value) {
  if (Array.isArray(value)) return value.map(clone)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]))
}

function isArtBundlePackage(pkg) {
  const sourceId = String(pkg?.provenance?.sourceId || '').trim()
  const id = String(pkg?.id || '').trim()
  return sourceId === ARTBUNDLE_RECIPE_ID || id === ARTBUNDLE_RECIPE_ID
}

function findSkillId(pkg, hint) {
  const refs = Array.isArray(pkg?.skillRefs) ? pkg.skillRefs : []
  const hit = refs.find(ref => String(ref?.id || ref).toLowerCase().includes(hint))
  return String(hit?.id || hit || refs[0]?.id || refs[0] || 'th-art-artbundle-workflow')
}

function enrichExternalWorkflowPackage(pkg) {
  if (!isArtBundlePackage(pkg)) return pkg
  const next = clone(pkg)
  next.inputs = clone(RECIPE_INPUTS)
  next.outputs = clone(RECIPE_OUTPUTS)
  next.provenance = {
    ...(next.provenance || {}),
    runtimeRecipe: ARTBUNDLE_RECIPE_ID,
    runtimeRecipeVersion: 1,
  }
  const nodes = Array.isArray(next.graph?.nodes) ? next.graph.nodes : []
  next.graph.nodes = nodes.map(node => {
    const action = ACTION_BY_NODE[String(node?.id || '')]
    if (!action) {
      if (node?.id !== 'slice_spec_emit') return node
      const taskHint = [
        node.intent || '',
        '必须调用 write_external_workflow_file 写入以下三个文件：',
        'workflow-spec/<taskSlug>/artifacts/curated-manifest.json、',
        'workflow-spec/<taskSlug>/artifacts/node-spec.json、',
        'workflow-spec/<taskSlug>/artifacts/slice-spec.md。',
        'JSON 必须来自已确认方案，禁止盲切全部图层。',
      ].join(' ')
      return {
        ...node,
        intent: taskHint,
        executionContract: {
          ...(node.executionContract || {}),
          requiredTools: ['write_external_workflow_file', 'create_artifact'],
          requiredEvidence: [
            { kind: 'tool_result', tool: 'write_external_workflow_file', forbidTruncated: true },
            { kind: 'tool_result', tool: 'create_artifact', forbidTruncated: true },
          ],
          minArtifacts: 1,
        },
      }
    }
    return {
      ...node,
      type: 'tool',
      agentPackageId: '',
      config: {
        ...(node.config || {}),
        skillId: findSkillId(next, action.includes('creator') ? 'creator' : (action.includes('slice') ? 'slicer' : 'artbundle')),
        externalWorkflow: ARTBUNDLE_RECIPE_ID,
        externalAction: action,
      },
    }
  })
  next.graph.members = next.graph.nodes
    .filter(node => node.type === 'agent' && node.agentPackageId)
    .map(node => ({
      id: node.id,
      agentPackageId: node.agentPackageId,
      expertId: node.agentPackageId,
      agentOrigin: node.agentOrigin || 'local',
      role: node.role || node.name || node.id,
      intent: node.intent || '',
    }))
  return next
}

function inside(root, target) {
  const rel = path.relative(path.resolve(root), path.resolve(target))
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

function safeToken(value, label, pattern = /^[a-z0-9][a-z0-9_-]{0,63}$/i) {
  const text = String(value || '').trim()
  if (!text || !pattern.test(text)) throw new Error(`${label}格式无效`)
  return text
}

function resolveRecipeContext(pkg, rawInputs = {}, deps = {}) {
  if (!isArtBundlePackage(pkg)) return { ok: true, supported: false }
  const fsImpl = deps.fs || fs
  const pathImpl = deps.path || path
  try {
    const rootInput = String(pkg?.provenance?.root || '').trim()
    if (!rootInput || !pathImpl.isAbsolute(rootInput)) throw new Error('工作流缺少可信的外部项目根目录，请重新导入')
    const root = fsImpl.realpathSync(pathImpl.resolve(rootInput))
    const rootStat = fsImpl.lstatSync(root)
    if (!rootStat.isDirectory()) throw new Error('外部项目根目录不存在')

    const psdPath = pathImpl.resolve(String(rawInputs.psdPath || rawInputs.sourcePsd || '').trim())
    const taskSlug = safeToken(rawInputs.taskSlug, '任务标识', /^[a-z0-9][a-z0-9-]{0,63}$/)
    const feature = safeToken(rawInputs.feature, '功能标识')
    const prefabName = safeToken(rawInputs.prefabName, 'Prefab 名称', /^[A-Za-z][A-Za-z0-9_]{0,79}$/)
    const exportId = safeToken(rawInputs.exportId || taskSlug, '导出标识')
    const layoutMode = String(rawInputs.layoutMode || 'absolute').trim().toLowerCase()
    if (!['absolute', 'widget'].includes(layoutMode)) throw new Error('布局模式只支持 absolute 或 widget')
    const canvas = String(rawInputs.canvas || '700x1515').trim().toLowerCase()
    if (!/^\d{2,5}x\d{2,5}$/.test(canvas)) throw new Error('画布尺寸须使用 700x1515 格式')
    const clientRootRaw = String(rawInputs.clientRoot || '').trim()
    if (!clientRootRaw || !pathImpl.isAbsolute(clientRootRaw)) throw new Error('Creator 工程根目录必须是绝对路径')
    const clientRoot = pathImpl.resolve(clientRootRaw)
    const previewRaw = String(rawInputs.previewPath || '').trim()
    const previewPath = previewRaw ? pathImpl.resolve(previewRaw) : ''
    const artifactRoot = pathImpl.join(root, 'workflow-spec', taskSlug, 'artifacts')
    const sliceRoot = pathImpl.join(root, 'outputs', '_drafts', `${taskSlug}-slice`)
    const bundleRoot = pathImpl.join(root, 'outputs', '_drafts', `${exportId}.artbundle`)
    const publishRoot = pathImpl.join(root, 'outputs', 'artifacts', feature, `${exportId}.artbundle`)
    for (const target of [artifactRoot, sliceRoot, bundleRoot, publishRoot]) {
      if (!inside(root, target)) throw new Error('运行输出路径越过外部项目边界')
    }
    return {
      ok: true,
      supported: true,
      recipeId: ARTBUNDLE_RECIPE_ID,
      root,
      psdPath,
      previewPath,
      taskSlug,
      feature,
      prefabName,
      exportId,
      layoutMode,
      canvas,
      clientRoot,
      artifactRoot,
      probePath: pathImpl.join(artifactRoot, 'psd-industrial-probe.json'),
      manifestPath: pathImpl.join(artifactRoot, 'curated-manifest.json'),
      nodeSpecPath: pathImpl.join(artifactRoot, 'node-spec.json'),
      sliceSpecPath: pathImpl.join(artifactRoot, 'slice-spec.md'),
      sliceRoot,
      bundleRoot,
      publishRoot,
      fs: fsImpl,
      path: pathImpl,
    }
  } catch (error) {
    return { ok: false, supported: true, code: 'invalid_external_workflow_input', error: error.message || String(error) }
  }
}

function checkRegularFile(file, fsImpl = fs) {
  try {
    const stat = fsImpl.lstatSync(file)
    return stat.isFile() && !stat.isSymbolicLink()
  } catch {
    return false
  }
}

function resolveAllowedScript(ctx, key) {
  const relative = ARTBUNDLE_SCRIPTS[key]
  if (!relative) throw new Error(`动作脚本不在允许清单: ${key}`)
  const candidate = ctx.path.resolve(ctx.root, relative)
  if (!inside(ctx.root, candidate) || !checkRegularFile(candidate, ctx.fs)) {
    throw new Error(`固定脚本缺失或不安全: ${relative}`)
  }
  const real = ctx.fs.realpathSync(candidate)
  if (!inside(ctx.root, real)) throw new Error(`固定脚本越过项目边界: ${relative}`)
  return real
}

function scrubLog(value) {
  return String(value || '')
    .replace(/(authorization\s*[:=]\s*)([^\s,;]+)/ig, '$1[REDACTED]')
    .replace(/((?:api[_-]?key|token|secret|password)\s*[:=]\s*["']?)([^\s,"'}]+)/ig, '$1[REDACTED]')
    .slice(-MAX_LOG_CHARS)
}

function runNode(script, args, ctx, opts = {}) {
  const spawnImpl = opts.spawn || spawn
  const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : 10 * 60 * 1000
  return new Promise(resolve => {
    let child
    let stdout = ''
    let stderr = ''
    let settled = false
    let timer = null
    const finish = result => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      resolve(result)
    }
    try {
      child = spawnImpl('node', [script, ...args.map(String)], {
        cwd: ctx.root,
        shell: false,
        windowsHide: true,
        env: { ...process.env, CLIENT_SRC_ROOT: ctx.clientRoot },
      })
    } catch (error) {
      return finish({ ok: false, code: 'node_spawn_failed', error: error.message || String(error) })
    }
    child.stdout?.on('data', data => { stdout = `${stdout}${data}`.slice(-MAX_LOG_CHARS * 2) })
    child.stderr?.on('data', data => { stderr = `${stderr}${data}`.slice(-MAX_LOG_CHARS * 2) })
    const cancel = (code, message) => {
      try { child.kill('SIGTERM') } catch { /* best effort */ }
      finish({ ok: false, code, error: message, summary: scrubLog(`${stdout}\n${stderr}`) })
    }
    timer = setTimeout(() => cancel('external_action_timeout', '外部工作流动作执行超时'), timeoutMs)
    if (opts.signal) {
      if (opts.signal.aborted) cancel('cancelled', '外部工作流动作已取消')
      else opts.signal.addEventListener('abort', () => cancel('cancelled', '外部工作流动作已取消'), { once: true })
    }
    child.on('error', error => finish({ ok: false, code: 'node_spawn_failed', error: error.message || String(error) }))
    child.on('close', code => {
      const cleanOut = scrubLog(stdout)
      const cleanErr = scrubLog(stderr)
      let parsed = null
      try { parsed = JSON.parse(stdout) } catch { /* human-readable output is valid */ }
      const ok = code === 0 && parsed?.ok !== false
      finish({
        ok,
        code: ok ? 'ok' : 'external_action_failed',
        exitCode: code,
        output: parsed || cleanOut,
        summary: cleanOut || cleanErr || `node exit ${code}`,
        error: ok ? '' : (parsed?.error || cleanErr || cleanOut || `node exit ${code}`),
      })
    })
  })
}

async function preflightExternalWorkflow(pkg, inputs = {}, deps = {}) {
  const ctx = resolveRecipeContext(pkg, inputs, deps)
  if (!ctx.supported) return { ok: true, supported: false, checks: [] }
  if (!ctx.ok) return { ...ctx, checks: [{ id: 'inputs', ok: false, message: ctx.error }] }
  const checks = []
  const add = (id, ok, message, extra = {}) => checks.push({ id, ok, message, ...extra })
  add('repository', true, '外部项目根目录可用', { path: ctx.root })
  const ref = String(pkg?.provenance?.ref || '').trim()
  if (ref) {
    const source = ctx.path.resolve(ctx.root, ref)
    add('workflow-source', inside(ctx.root, source) && checkRegularFile(source, ctx.fs), '工作流源定义必须是项目内普通文件', { path: source })
  }
  add('psd', checkRegularFile(ctx.psdPath, ctx.fs) && /\.psd$/i.test(ctx.psdPath), 'PSD 必须是存在的普通 .psd 文件', { path: ctx.psdPath })
  if (ctx.previewPath) add('preview', checkRegularFile(ctx.previewPath, ctx.fs), '效果图路径不可读', { path: ctx.previewPath, optional: true })
  let clientOk = false
  try { clientOk = ctx.fs.lstatSync(ctx.clientRoot).isDirectory() && ctx.fs.existsSync(ctx.path.join(ctx.clientRoot, 'assets')) } catch { /* */ }
  add('creator-project', clientOk, 'Creator 工程需存在且包含 assets 目录', { path: ctx.clientRoot })
  try {
    ctx.fs.accessSync(ctx.root, ctx.fs.constants?.W_OK ?? fs.constants.W_OK)
    add('write-boundary', true, '输出仅允许写入外部项目的 workflow-spec 与 outputs')
  } catch {
    add('write-boundary', false, '外部项目根目录不可写')
  }
  for (const [key, relative] of Object.entries(ARTBUNDLE_SCRIPTS)) {
    try {
      resolveAllowedScript(ctx, key)
      add(`script:${key}`, true, `固定脚本可用: ${relative}`)
    } catch (error) {
      add(`script:${key}`, false, error.message || String(error))
    }
  }
  const nodeCheck = await runNode('__node_version__', [], ctx, {
    ...deps,
    timeoutMs: 10000,
    spawn: (command, _args, options) => (deps.spawn || spawn)(command, ['--version'], options),
  })
  add('node', nodeCheck.ok, nodeCheck.ok ? `Node 可用: ${String(nodeCheck.summary || '').trim()}` : '未找到可执行的 Node.js，请安装并加入 PATH')
  const failures = checks.filter(check => !check.ok && !check.optional)
  return {
    ok: failures.length === 0,
    supported: true,
    recipeId: ARTBUNDLE_RECIPE_ID,
    checks,
    warnings: checks.filter(check => !check.ok && check.optional),
    code: failures.length ? 'external_workflow_preflight_failed' : 'ok',
    error: failures.length ? failures.map(check => check.message).join('；') : '',
    context: failures.length ? undefined : ctx,
  }
}

function requireGeneratedFile(ctx, file, label, json = false) {
  if (!checkRegularFile(file, ctx.fs) || !inside(ctx.artifactRoot, file)) throw new Error(`${label}不存在：${file}`)
  if (json) {
    try { JSON.parse(ctx.fs.readFileSync(file, 'utf8')) } catch { throw new Error(`${label}不是合法 JSON：${file}`) }
  }
}

async function executeExternalWorkflowAction({ pkg, inputs, action, signal, spawn: spawnImpl } = {}) {
  const resolved = resolveRecipeContext(pkg, inputs)
  if (!resolved.ok || !resolved.supported) return { ok: false, code: resolved.code || 'unsupported_external_workflow', message: resolved.error || '不支持此外部工作流' }
  const ctx = resolved
  const run = async (scriptKey, args, timeoutMs) => {
    let script
    try { script = resolveAllowedScript(ctx, scriptKey) } catch (error) {
      return { ok: false, code: 'external_script_denied', message: error.message || String(error) }
    }
    const result = await runNode(script, args, ctx, { signal, spawn: spawnImpl, timeoutMs })
    return result.ok ? result : { ...result, message: result.error || result.summary }
  }
  try {
    if (action === 'probe-psd') {
      const result = await run('probe-psd', ['--psd', ctx.psdPath, '--out', ctx.probePath, '--prefer-ps'], 4 * 60 * 1000)
      return { ...result, artifactRefs: result.ok ? [ctx.probePath] : [], evidenceRefs: result.ok ? [ctx.probePath] : [] }
    }
    if (action === 'slice-export') {
      requireGeneratedFile(ctx, ctx.manifestPath, 'curated manifest', true)
      const args = ['--mode', 'psd-export', '--psd', ctx.psdPath, '--out', ctx.sliceRoot, '--manifest', ctx.manifestPath]
      if (ctx.previewPath) args.push('--preview', ctx.previewPath)
      const result = await run('slice-export', args, 15 * 60 * 1000)
      return { ...result, artifactRefs: result.ok ? [ctx.sliceRoot] : [], evidenceRefs: result.ok ? [ctx.manifestPath] : [] }
    }
    if (action === 'bundle-build') {
      requireGeneratedFile(ctx, ctx.nodeSpecPath, 'node-spec', true)
      const args = [
        '--slice-dir', ctx.sliceRoot,
        '--out', ctx.bundleRoot,
        '--feature', ctx.feature,
        '--export-id', ctx.exportId,
        '--prefab-name', ctx.prefabName,
        '--node-spec', ctx.nodeSpecPath,
        '--layout-mode', ctx.layoutMode,
        '--psd-ref', ctx.psdPath,
        '--client-root', ctx.clientRoot,
        '--canvas', ctx.canvas,
      ]
      const result = await run('bundle-build', args, 10 * 60 * 1000)
      return { ...result, artifactRefs: result.ok ? [ctx.bundleRoot] : [], evidenceRefs: result.ok ? [ctx.path.join(ctx.bundleRoot, 'bundle.json')] : [] }
    }
    if (action === 'creator-preflight') {
      const result = await run('creator-preflight', ['--bundle', ctx.bundleRoot, '--client-root', ctx.clientRoot], 2 * 60 * 1000)
      return { ...result, evidenceRefs: result.ok ? [ctx.path.join(ctx.bundleRoot, 'bundle.json')] : [] }
    }
    if (action === 'creator-verify') {
      const result = ctx.layoutMode === 'widget'
        ? await run('creator-verify-widget', ['--bundle', ctx.bundleRoot], 12 * 60 * 1000)
        : await run('creator-verify-absolute', ['--bundle', ctx.bundleRoot, '--client-root', ctx.clientRoot], 12 * 60 * 1000)
      const evidence = result.output?.prefabAbs || result.output?.reportPath || ctx.path.join(ctx.bundleRoot, 'bundle.json')
      return { ...result, artifactRefs: result.ok ? [evidence] : [], evidenceRefs: result.ok ? [evidence] : [] }
    }
    if (action === 'publish') {
      if (!ctx.fs.existsSync(ctx.path.join(ctx.bundleRoot, 'bundle.json'))) throw new Error('ArtBundle 草稿不存在，不能发布')
      if (ctx.fs.existsSync(ctx.publishRoot)) throw new Error(`正式制品已存在，未覆盖：${ctx.publishRoot}`)
      ctx.fs.mkdirSync(ctx.path.dirname(ctx.publishRoot), { recursive: true })
      ctx.fs.cpSync(ctx.bundleRoot, ctx.publishRoot, { recursive: true, errorOnExist: true, force: false, verbatimSymlinks: false })
      return { ok: true, summary: `已发布 ArtBundle：${ctx.publishRoot}`, output: { path: ctx.publishRoot }, artifactRefs: [ctx.publishRoot], evidenceRefs: [ctx.path.join(ctx.publishRoot, 'bundle.json')] }
    }
    return { ok: false, code: 'external_action_denied', message: `动作不在 ArtBundle 配方允许清单: ${action}` }
  } catch (error) {
    return { ok: false, code: 'external_action_failed', message: error.message || String(error), summary: error.message || String(error) }
  }
}

function containsSecret(text) {
  return /(?:authorization|api[_-]?key|token|secret|password)\s*[:=]/i.test(String(text || ''))
}

function buildExternalWorkflowToolBundle(pkg, inputs = {}) {
  const ctx = resolveRecipeContext(pkg, inputs)
  if (!ctx.ok || !ctx.supported) return null
  const allowedRoot = ctx.artifactRoot
  function resolveAgentFile(value) {
    const raw = String(value || '').trim().replace(/\\/g, '/')
    if (!raw || path.isAbsolute(raw) || raw.split('/').includes('..')) throw new Error('只允许 workflow-spec 下的相对文件路径')
    const target = ctx.path.resolve(ctx.root, raw)
    if (!inside(allowedRoot, target) || !/\.(?:json|md)$/i.test(target)) throw new Error('Agent 只允许写当前任务 artifacts 下的 .json/.md')
    return target
  }
  const definitions = [
    {
      type: 'function',
      function: {
        name: 'write_external_workflow_file',
        description: `写入当前 ArtBundle 任务的受控规格文件。仅允许 workflow-spec/${ctx.taskSlug}/artifacts/ 下的 .json/.md；不得包含凭据。`,
        parameters: {
          type: 'object',
          properties: { path: { type: 'string' }, content: { type: 'string' } },
          required: ['path', 'content'],
          additionalProperties: false,
        },
      },
      _knowme: { source: 'skill', capability: 'external-workflow-file', risk: 'write', sideEffects: true, requiresApproval: false, scope: `workflow-spec/${ctx.taskSlug}` },
    },
    {
      type: 'function',
      function: {
        name: 'read_external_workflow_file',
        description: `读取当前 ArtBundle 任务 workflow-spec/${ctx.taskSlug}/artifacts/ 下的 .json/.md。`,
        parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false },
      },
      _knowme: { source: 'skill', capability: 'external-workflow-file', risk: 'read', sideEffects: false, requiresApproval: false, scope: `workflow-spec/${ctx.taskSlug}` },
    },
  ]
  const handlers = {
    write_external_workflow_file: async (args = {}) => {
      try {
        const target = resolveAgentFile(args.path)
        const content = String(args.content ?? '')
        if (!content || content.length > MAX_AGENT_FILE_CHARS) return { ok: false, code: 'invalid_args', text: '文件为空或超过 1 MiB' }
        if (containsSecret(content)) return { ok: false, code: 'secret_blocked', text: '规格文件疑似包含凭据，已阻止写入' }
        if (/\.json$/i.test(target)) JSON.parse(content)
        ctx.fs.mkdirSync(ctx.path.dirname(target), { recursive: true })
        const temp = `${target}.${process.pid}.tmp`
        ctx.fs.writeFileSync(temp, content.endsWith('\n') ? content : `${content}\n`, 'utf8')
        ctx.fs.renameSync(temp, target)
        return { ok: true, text: `已写入 ${ctx.path.relative(ctx.root, target).replace(/\\/g, '/')}`, path: target }
      } catch (error) {
        return { ok: false, code: 'external_file_denied', text: error.message || String(error) }
      }
    },
    read_external_workflow_file: async (args = {}) => {
      try {
        const target = resolveAgentFile(args.path)
        if (!checkRegularFile(target, ctx.fs)) return { ok: false, code: 'not_found', text: '文件不存在' }
        return { ok: true, text: ctx.fs.readFileSync(target, 'utf8').slice(0, MAX_AGENT_FILE_CHARS), path: target }
      } catch (error) {
        return { ok: false, code: 'external_file_denied', text: error.message || String(error) }
      }
    },
  }
  return { definitions, handlers, context: ctx }
}

module.exports = {
  ARTBUNDLE_RECIPE_ID,
  ARTBUNDLE_SCRIPTS,
  ACTION_BY_NODE,
  RECIPE_INPUTS,
  RECIPE_OUTPUTS,
  isArtBundlePackage,
  enrichExternalWorkflowPackage,
  resolveRecipeContext,
  resolveAllowedScript,
  preflightExternalWorkflow,
  executeExternalWorkflowAction,
  buildExternalWorkflowToolBundle,
  scrubLog,
  inside,
}

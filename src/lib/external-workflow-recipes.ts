'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { spawn } = require('child_process')

const ARTBUNDLE_RECIPE_ID = 'th-art-psd-to-artbundle'
const ARTBUNDLE_RECIPE_NAME = 'PSD导Artbundle'
const MAX_LOG_CHARS = 16000
const MAX_AGENT_FILE_CHARS = 1024 * 1024

const ARTBUNDLE_SCRIPTS = Object.freeze({
  'probe-psd': 'scripts/probe-psd-industrial.mjs',
  'slice-export': '.cursor/skills/th-art-ui-slicer/scripts/run-slice-pipeline.mjs',
  'slice-export-photoshop': '.cursor/skills/th-art-ui-slicer/scripts/photoshop-export-slices.mjs',
  'bundle-build': '.cursor/skills/th-art-artbundle-export/scripts/run-artbundle-export.mjs',
  'creator-preflight': 'scripts/creator-import-preflight.mjs',
  'creator-verify-absolute': 'scripts/import-artbundle-to-client.mjs',
  'creator-verify-widget': 'scripts/run-artbundle-creator-debug.mjs',
})

const ACTION_BY_NODE = Object.freeze({
  psd_layer_preread: 'probe-psd',
  slice_spec_emit: 'prepare-specs',
  slice_export: 'slice-export',
  bundle_build: 'bundle-build',
  creator_import_preflight: 'creator-preflight',
  bundle_creator_verify: 'creator-verify',
  bundle_publish: 'publish',
})

const RECIPE_INPUTS = Object.freeze([
  { id: 'goal', label: '本次运行目标', required: false, hidden: true, defaultValue: '将 PSD 导出为 ArtBundle 并完成 Creator 验收' },
  { id: 'psdPath', label: 'PSD 文件', required: true, control: 'file', extensions: ['psd'], placeholder: '选择要导出的 .psd 文件', description: '源文件只读，不会修改原始 PSD。' },
  { id: 'clientRoot', label: 'Creator 工程', required: false, advanced: true, control: 'directory', placeholder: '可选；优先使用已配置的 Creator 工程' },
  { id: 'previewPath', label: '参考效果图', required: false, advanced: true, control: 'file', extensions: ['png', 'jpg', 'jpeg', 'webp'], placeholder: '可选，用于辅助还原校验' },
  { id: 'layoutMode', label: '布局模式', required: false, advanced: true, defaultValue: 'absolute', placeholder: 'absolute 或 widget' },
  { id: 'canvas', label: '画布尺寸', required: false, advanced: true, defaultValue: '700x1515', placeholder: '700x1515' },
])

const RECIPE_OUTPUTS = Object.freeze([
  { id: 'probe', label: 'PSD 图层与文字工业探测结果' },
  { id: 'slice', label: '经门禁确认的透明切图与 manifest' },
  { id: 'bundle', label: 'ArtBundle v2.1 制品' },
  { id: 'creator', label: 'Creator 导入与 Prefab 结构验收证据' },
])

const ARTBUNDLE_CONNECTOR_DEPENDENCIES = Object.freeze([
  {
    id: 'photoshop-mcp',
    kind: 'connector',
    required: true,
    reason: 'PSD 图层预读、Photoshop 状态验证与受控切图',
    tools: ['photoshop_ping', 'photoshop_get_document_info', 'photoshop_get_layers'],
  },
  {
    id: 'cocos-creator-mcp',
    kind: 'connector',
    required: true,
    requiredWhen: 'widget',
    reason: 'Widget 布局需要 Creator 导入 DSL 并验证 Prefab 结构',
    tools: ['get_editor_context', 'import_dsl_bundle'],
  },
  {
    id: 'cocos-creator-mcp',
    kind: 'connector',
    required: false,
    reason: '绝对布局可用项目 CLI 降级；连接器在线时提供编辑器内验收',
    tools: ['refresh_assets', 'open_scene'],
  },
])

function artBundleConnectorDependencies(pkg = {}) {
  const declared = [
    ...(Array.isArray(pkg.connectorDependencies) ? pkg.connectorDependencies : []),
    ...(Array.isArray(pkg.dependencies) ? pkg.dependencies.filter(dep => dep?.kind === 'connector') : []),
  ]
  const ids = declared.map(dep => String(dep?.id || dep || '').trim()).filter(Boolean)
  const photoshopId = ids.find(id => /photoshop/i.test(id)) || 'photoshop-mcp'
  const creatorId = ids.find(id => /(?:cocos|creator)/i.test(id)) || 'cocos-creator-mcp'
  return ARTBUNDLE_CONNECTOR_DEPENDENCIES.map(dep => ({
    ...clone(dep),
    id: dep.id === 'photoshop-mcp' ? photoshopId : creatorId,
  }))
}

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
  next.name = ARTBUNDLE_RECIPE_NAME
  const connectorDependencies = artBundleConnectorDependencies(next)
  if (/^\d+\.\d+$/.test(String(next.version || ''))) next.version = `${next.version}.0`
  next.inputs = clone(RECIPE_INPUTS)
  next.outputs = clone(RECIPE_OUTPUTS)
  next.connectorDependencies = connectorDependencies
  next.dependencies = [
    ...(Array.isArray(next.dependencies) ? next.dependencies.filter(dep => dep?.kind !== 'connector') : []),
    ...clone(connectorDependencies),
  ]
  next.provenance = {
    ...(next.provenance || {}),
    runtimeRecipe: ARTBUNDLE_RECIPE_ID,
    runtimeRecipeVersion: 1,
  }
  const nodes = Array.isArray(next.graph?.nodes) ? next.graph.nodes : []
  next.graph.nodes = nodes.filter(node => String(node?.id || '') !== 'terminal_blocked').map(node => {
    const action = ACTION_BY_NODE[String(node?.id || '')]
    if (!action) return node
    return {
      ...node,
      type: 'tool',
      agentPackageId: '',
      config: {
        ...(node.config || {}),
        skillId: findSkillId(next, action.includes('creator') ? 'creator' : (action.includes('slice') ? 'slicer' : 'artbundle')),
        externalWorkflow: ARTBUNDLE_RECIPE_ID,
        externalAction: action,
        toolRef: {
          id: `project.th-art.${action}`,
          version: '1.0.0',
          name: `th_art_${String(action).replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')}`,
        },
      },
    }
  })
  next.graph.edges = (Array.isArray(next.graph?.edges) ? next.graph.edges : []).filter(edge => {
    const label = String(edge?.label || '').trim()
    return String(edge?.to || '') !== 'terminal_blocked' && !['失败', '驳回', '返工'].includes(label)
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

function assertNoSymlinkPath(root, target, fsImpl = fs, pathImpl = path) {
  const relative = pathImpl.relative(pathImpl.resolve(root), pathImpl.resolve(target))
  if (relative.startsWith('..') || pathImpl.isAbsolute(relative)) throw new Error('路径越过外部项目边界')
  let current = pathImpl.resolve(root)
  for (const segment of relative.split(pathImpl.sep).filter(Boolean)) {
    current = pathImpl.join(current, segment)
    if (!fsImpl.existsSync(current)) break
    const stat = fsImpl.lstatSync(current)
    if (stat.isSymbolicLink()) throw new Error(`路径包含符号链接，已拒绝: ${current}`)
  }
}

function assertTreeNoSymlinks(root, fsImpl = fs, pathImpl = path) {
  const queue = [root]
  let visited = 0
  while (queue.length) {
    const current = queue.shift()
    const stat = fsImpl.lstatSync(current)
    if (stat.isSymbolicLink()) throw new Error(`制品包含符号链接，已拒绝发布: ${current}`)
    visited += 1
    if (visited > 10000) throw new Error('制品文件数量超过安全上限')
    if (!stat.isDirectory()) continue
    for (const name of fsImpl.readdirSync(current)) queue.push(pathImpl.join(current, name))
  }
}

function safeToken(value, label, pattern = /^[a-z0-9][a-z0-9_-]{0,63}$/i) {
  const text = String(value || '').trim()
  if (!text || !pattern.test(text)) throw new Error(`${label}格式无效`)
  return text
}

function inferredArtBundleIdentifiers(psdPath, pathImpl = path) {
  const stem = pathImpl.basename(String(psdPath || ''), pathImpl.extname(String(psdPath || '')))
  const readable = stem
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'artbundle'
  const digest = crypto.createHash('sha256').update(String(psdPath || '').toLowerCase()).digest('hex').slice(0, 8)
  const taskBase = readable.slice(0, 54).replace(/-+$/g, '') || 'artbundle'
  const prefabBase = readable
    .split('-')
    .filter(Boolean)
    .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('')
    .replace(/^[^A-Za-z]+/, '')
    .slice(0, 70) || 'ArtBundle'
  return {
    taskSlug: `${taskBase}-${digest}`,
    feature: readable.slice(0, 64),
    prefabName: `${prefabBase}View`,
  }
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

    const psdPathRaw = String(rawInputs.psdPath || rawInputs.sourcePsd || '').trim()
    if (!psdPathRaw || !pathImpl.isAbsolute(psdPathRaw)) throw new Error('PSD 文件必须使用绝对路径')
    const psdPath = pathImpl.resolve(psdPathRaw)
    const inferred = inferredArtBundleIdentifiers(psdPath, pathImpl)
    const taskSlug = safeToken(rawInputs.taskSlug || inferred.taskSlug, '任务标识', /^[a-z0-9][a-z0-9-]{0,63}$/)
    const feature = safeToken(rawInputs.feature || inferred.feature, '功能标识')
    const prefabName = safeToken(rawInputs.prefabName || inferred.prefabName, 'Prefab 名称', /^[A-Za-z][A-Za-z0-9_]{0,79}$/)
    const exportId = safeToken(rawInputs.exportId || taskSlug, '导出标识')
    const layoutMode = String(rawInputs.layoutMode || 'absolute').trim().toLowerCase()
    if (!['absolute', 'widget'].includes(layoutMode)) throw new Error('布局模式只支持 absolute 或 widget')
    const canvas = String(rawInputs.canvas || '700x1515').trim().toLowerCase()
    if (!/^\d{2,5}x\d{2,5}$/.test(canvas)) throw new Error('画布尺寸须使用 700x1515 格式')
    const configuredClientRoot = String(
      rawInputs.clientRoot ||
      pkg?.provenance?.clientRoot ||
      process.env.KNOWME_CREATOR_ROOT ||
      process.env.TH_ART_CLIENT_ROOT ||
      '',
    ).trim()
    const clientRootRaw = configuredClientRoot || [
      'D:\\workspace\\client\\PrefabPipelineBase',
      'C:\\workspace\\client\\PrefabPipelineBase',
    ].find(candidate => fsImpl.existsSync(candidate)) || ''
    if (!clientRootRaw || !pathImpl.isAbsolute(clientRootRaw)) {
      throw new Error('未找到 Creator 工程。PSD 仍可完成预读/方案/打包；如需 Creator 验收，请在设置中配置 Creator 工程路径或填写高级选项。')
    }
    const clientRoot = pathImpl.resolve(clientRootRaw)
    const previewRaw = String(rawInputs.previewPath || '').trim()
    const previewPath = previewRaw ? pathImpl.resolve(previewRaw) : ''
    const artifactRoot = pathImpl.join(root, 'workflow-spec', taskSlug, 'artifacts')
    const sliceRoot = pathImpl.join(root, 'outputs', '_drafts', `${taskSlug}-slice`)
    const bundleRoot = pathImpl.join(root, 'outputs', '_drafts', `${exportId}.artbundle`)
    const publishRoot = pathImpl.join(root, 'outputs', 'artifacts', feature, `${exportId}.artbundle`)
    for (const target of [artifactRoot, sliceRoot, bundleRoot, publishRoot]) {
      if (!inside(root, target)) throw new Error('运行输出路径越过外部项目边界')
      assertNoSymlinkPath(root, target, fsImpl, pathImpl)
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
    .replace(/(authorization["']?\s*[:=]\s*)(?:bearer\s+)?[^\r\n,;]+/ig, '$1[REDACTED]')
    .replace(/((?:api[_-]?key|token|secret|password)["']?\s*[:=]\s*["']?)[^\s,"'}]+/ig, '$1[REDACTED]')
    .slice(-MAX_LOG_CHARS)
}

function redactStructuredOutput(value, key = '', depth = 0) {
  if (/(?:authorization|api[_-]?key|token|secret|password)/i.test(String(key || ''))) return '[REDACTED]'
  if (depth > 8) return '[TRUNCATED]'
  if (Array.isArray(value)) return value.slice(0, 200).map(item => redactStructuredOutput(item, '', depth + 1))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 200).map(([childKey, child]) => [
      childKey,
      redactStructuredOutput(child, childKey, depth + 1),
    ]))
  }
  if (typeof value === 'string') return scrubLog(value)
  return value
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
      const safeParsed = parsed == null ? null : redactStructuredOutput(parsed)
      finish({
        ok,
        code: ok ? 'ok' : 'external_action_failed',
        exitCode: code,
        output: safeParsed || cleanOut,
        summary: cleanOut || cleanErr || `node exit ${code}`,
        error: ok ? '' : scrubLog(parsed?.error || cleanErr || cleanOut || `node exit ${code}`),
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
  if (typeof deps.assessConnectors === 'function') {
    const connectorGate = await deps.assessConnectors(pkg, { ...inputs, layoutMode: ctx.layoutMode })
    for (const requirement of connectorGate.requirements || []) {
      add(`connector:${requirement.id}`, requirement.ready || !requirement.required, requirement.ready
        ? `${requirement.id} 已就绪`
        : `${requirement.id}: ${requirement.message}`, {
        optional: !requirement.required,
        connectorId: requirement.id,
        state: requirement.state,
        remediation: requirement.remediation,
      })
    }
  }
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

function safeNodeName(value, index) {
  const normalized = String(value || '')
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return normalized ? `${normalized.slice(0, 48)}_${index}` : `Slice_${index}`
}

function normalizedBounds(layer) {
  const source = layer?.bounds || {}
  const left = Number(source.left)
  const top = Number(source.top)
  const width = Number(source.width)
  const height = Number(source.height)
  if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null
  return { left, top, width, height, right: left + width, bottom: top + height }
}

function buildDeterministicArtBundleSpecs(ctx, probe) {
  const document = probe?.document || {}
  const canvasWidth = Number(document.width) || Number(String(ctx.canvas).split('x')[0]) || 700
  const canvasHeight = Number(document.height) || Number(String(ctx.canvas).split('x')[1]) || 1515
  const canvasArea = canvasWidth * canvasHeight
  const layers = (Array.isArray(probe?.layers) ? probe.layers : [])
    .filter(layer => layer?.visible !== false)
    .map(layer => ({ ...layer, path: String(layer?.path || ''), bounds: normalizedBounds(layer) }))
    .filter(layer => layer.path && layer.bounds)

  if (!layers.length) throw new Error('PSD 探测结果没有可用于生成规格的可见图层')

  const background = layers
    .filter(layer => (
      layer.bounds.left <= 0 && layer.bounds.top <= 0 &&
      layer.bounds.right >= canvasWidth && layer.bounds.bottom >= canvasHeight
    ))
    .sort((a, b) => {
      const score = layer => (
        (/背景|background|标注边缘/i.test(`${layer.name || ''} ${layer.path}`) ? 40 : 0) +
        (layer.kind === 'pixel' ? 20 : 0) -
        Math.abs(layer.bounds.width - canvasWidth) / canvasWidth -
        Math.abs(layer.bounds.height - canvasHeight) / canvasHeight
      )
      return score(b) - score(a)
    })[0]

  if (!background) throw new Error('PSD 探测结果中没有覆盖完整画布的背景图层，已停止以避免盲切')

  const semanticPattern = /牌底|按钮|面板|弹窗|卡片|标题|图标|header|title|button|panel|card|icon|组\s*18|小程勋/i
  const semantic = layers
    .filter(layer => {
      if (layer.path === background.path || !semanticPattern.test(`${layer.name || ''} ${layer.path}`)) return false
      const depth = layer.path.split('/').length
      const areaRatio = (layer.bounds.width * layer.bounds.height) / canvasArea
      return depth <= 4 && areaRatio >= 0.002 && areaRatio <= 0.18 &&
        layer.bounds.left >= 0 && layer.bounds.top >= 0 &&
        layer.bounds.right <= canvasWidth && layer.bounds.bottom <= canvasHeight
    })
    .sort((a, b) => a.path.split('/').length - b.path.split('/').length || b.bounds.width * b.bounds.height - a.bounds.width * a.bounds.height)

  const selected = []
  for (const layer of semantic) {
    if (selected.some(parent => layer.path.startsWith(`${parent.path}/`) || parent.path.startsWith(`${layer.path}/`))) continue
    selected.push(layer)
    if (selected.length >= 8) break
  }

  const chosen = [background, ...selected]
  const manifestSlices = chosen.map((layer, index) => {
    const ordinal = String(index + 1).padStart(2, '0')
    const isBackground = index === 0
    return {
      file: isBackground ? 'screen_background.png' : `component_${ordinal}.png`,
      pickLayer: String(layer.name || layer.path.split('/').pop()),
      psdGroup: layer.path,
      description: isBackground
        ? '画布背景；根据工业探测结果选择覆盖完整画布的可见图层。'
        : `已确认方案中的独立视觉组件：${layer.name || layer.path}`,
      ninePatch: false,
      common: false,
      exportMode: 'photoshop',
      scope: 'inBundle',
      prefabRole: isBackground ? 'bg' : 'sprite',
      soloMode: isBackground ? 'siblings' : 'tree',
      copyCanvas: isBackground,
      cropBounds: [layer.bounds.left, layer.bounds.top, layer.bounds.width, layer.bounds.height],
    }
  })

  const nodes = chosen.map((layer, index) => {
    const isBackground = index === 0
    const base = {
      name: isBackground ? 'Background' : safeNodeName(layer.name || layer.path, index + 1),
      parentPath: ctx.prefabName,
      kind: 'sprite',
      texture: manifestSlices[index].file,
      psdGroup: layer.path,
      zOrder: index,
      note: isBackground ? '工业探测确定的整屏背景' : `由 PSD 图层 ${layer.path} 生成`,
    }
    if (isBackground) {
      return {
        ...base,
        x: 0,
        y: 0,
        w: canvasWidth,
        h: canvasHeight,
        widgetFull: true,
        widget: { alignFlags: 45, left: 0, right: 0, top: 0, bottom: 0 },
      }
    }
    return {
      ...base,
      x: layer.bounds.left + (layer.bounds.width / 2) - (canvasWidth / 2),
      y: (canvasHeight / 2) - layer.bounds.top - (layer.bounds.height / 2),
      w: layer.bounds.width,
      h: layer.bounds.height,
    }
  })

  const manifest = {
    version: '1.0.0',
    manifestRev: '1.0.0',
    psd: ctx.path.basename(ctx.psdPath),
    notes: `KnowMe 根据已确认方案与 PSD 工业探测结果生成；${chosen.length} 个精选切片，未盲切全部 ${layers.length} 个可见图层。`,
    slices: manifestSlices,
  }
  const nodeSpec = {
    version: '1.0.0',
    prefabName: ctx.prefabName,
    outputPrefab: `assets/resources/AutoArtBundle/${ctx.feature}/Prefabs/${ctx.prefabName}.prefab`,
    texturesOut: `assets/resources/AutoArtBundle/${ctx.feature}/Textures`,
    sliceDir: 'slices',
    psdPath: ctx.psdPath.replace(/\\/g, '/'),
    psdHtml: `workflow-spec/${ctx.taskSlug}/artifacts/psd-html/index.html`,
    manifestPath: 'slices/manifest.json',
    nodes,
  }
  const sliceSpec = [
    '# Curated PSD slicing specification',
    '',
    `- PSD: ${ctx.path.basename(ctx.psdPath)}`,
    `- Canvas: ${canvasWidth} × ${canvasHeight}`,
    `- Probe: ${probe?.stats?.layerCount || layers.length} layers; ${probe?.stats?.visibleTextCount || 0} visible text layers`,
    `- Strategy: one verified full-canvas background plus ${selected.length} semantic components`,
    '- Export: Photoshop copy-merged, full PSD paths, no blind all-layer export',
    '',
    '## Selected layers',
    '',
    ...chosen.map((layer, index) => `${index + 1}. \`${layer.path}\` → \`${manifestSlices[index].file}\``),
    '',
    'Dynamic copy remains a runtime concern; selected component groups are baked only where the approved plan permits it.',
  ].join('\n')
  return { manifest, nodeSpec, sliceSpec, selectedPaths: chosen.map(layer => layer.path) }
}

function writeArtBundleSpecs(ctx, specs) {
  const files = [
    [ctx.manifestPath, `${JSON.stringify(specs.manifest, null, 2)}\n`],
    [ctx.nodeSpecPath, `${JSON.stringify(specs.nodeSpec, null, 2)}\n`],
    [ctx.sliceSpecPath, `${String(specs.sliceSpec || '').trim()}\n`],
  ]
  const combined = files.map(([, content]) => content).join('\n')
  if (combined.length > MAX_AGENT_FILE_CHARS) throw new Error('规格总大小超过 1 MiB')
  if (containsSecret(combined)) throw new Error('规格疑似包含凭据，已阻止写入')
  ctx.fs.mkdirSync(ctx.artifactRoot, { recursive: true })
  for (const [target, content] of files) ctx.fs.writeFileSync(`${target}.${process.pid}.tmp`, content, 'utf8')
  for (const [target] of files) ctx.fs.renameSync(`${target}.${process.pid}.tmp`, target)
  return files.map(([target]) => target)
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
    if (action === 'prepare-specs') {
      requireGeneratedFile(ctx, ctx.probePath, 'PSD 工业探测结果', true)
      const probe = JSON.parse(ctx.fs.readFileSync(ctx.probePath, 'utf8'))
      if (probe.ok === false) throw new Error('PSD 工业探测未通过，不能生成切图规格')
      const specs = buildDeterministicArtBundleSpecs(ctx, probe)
      const paths = writeArtBundleSpecs(ctx, specs)
      return {
        ok: true,
        summary: `已从工业探测结果生成 ${specs.selectedPaths.length} 个精选切片规格`,
        output: { paths, selectedPaths: specs.selectedPaths },
        artifactRefs: paths,
        evidenceRefs: [ctx.probePath, ...paths],
      }
    }
    if (action === 'probe-psd') {
      const result = await run('probe-psd', ['--psd', ctx.psdPath, '--out', ctx.probePath, '--prefer-ps'], 4 * 60 * 1000)
      return { ...result, artifactRefs: result.ok ? [ctx.probePath] : [], evidenceRefs: result.ok ? [ctx.probePath] : [] }
    }
    if (action === 'slice-export') {
      requireGeneratedFile(ctx, ctx.manifestPath, 'curated manifest', true)
      const args = ['--mode', 'psd-export', '--psd', ctx.psdPath, '--out', ctx.sliceRoot, '--manifest', ctx.manifestPath]
      if (ctx.previewPath) args.push('--preview', ctx.previewPath)
      const result = await run('slice-export', args, 15 * 60 * 1000)
      // Some imported projects keep Photoshop as the authoritative exporter but no
      // longer ship the optional psdcli binary. In that case continue through the
      // supported Photoshop bridge instead of stopping at a missing module.
      if (!result.ok && /psdcli|Cannot find module/i.test(String(result.message || result.summary || ''))) {
        const photoshopArgs = [
          '--psd', ctx.psdPath,
          '--slices-dir', ctx.path.join(ctx.sliceRoot, 'slices'),
          '--manifest', ctx.manifestPath,
          '--template', ctx.manifestPath,
        ]
        if (ctx.previewPath) photoshopArgs.push('--fallback-preview', ctx.previewPath)
        const fallback = await run('slice-export-photoshop', photoshopArgs, 15 * 60 * 1000)
        if (fallback.ok) {
          const sliceManifest = ctx.path.join(ctx.sliceRoot, 'slices', 'manifest.json')
          ctx.fs.mkdirSync(ctx.path.dirname(sliceManifest), { recursive: true })
          ctx.fs.copyFileSync(ctx.manifestPath, sliceManifest)
          return {
            ...fallback,
            fallback: 'photoshop',
            artifactRefs: [ctx.sliceRoot],
            evidenceRefs: [ctx.manifestPath, sliceManifest],
          }
        }
        return { ...fallback, fallback: 'photoshop', artifactRefs: [], evidenceRefs: [] }
      }
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
        '--canvas', ctx.canvas.replace(/x/i, ','),
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
      assertTreeNoSymlinks(ctx.bundleRoot, ctx.fs, ctx.path)
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
  const value = String(text || '')
  if (/["']?(?:authorization|api[_-]?key|token|secret|password)["']?\s*[:=]/i.test(value)) return true
  try {
    const visit = item => {
      if (Array.isArray(item)) return item.some(visit)
      if (!item || typeof item !== 'object') return false
      return Object.entries(item).some(([key, nested]) => (
        /^(?:authorization|api[_-]?key|token|secret|password)$/i.test(key) || visit(nested)
      ))
    }
    return visit(JSON.parse(value))
  } catch {
    return false
  }
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
    assertNoSymlinkPath(ctx.root, target, ctx.fs, ctx.path)
    return target
  }
  const actionToolName = action => `th_art_${String(action).replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')}`
  const workflowFileContract = (risk, sideEffects) => ({
    source: 'builtin',
    capability: 'external-workflow-file',
    risk,
    sideEffects,
    requiresApproval: false,
    scope: 'sandbox',
    timeoutMs: 60000,
    idempotencySupported: sideEffects,
    rollbackSupported: false,
    resourceScope: `workflow-spec/${ctx.taskSlug}/artifacts`,
  })
  const actionDefinitions = Object.values(ACTION_BY_NODE).filter((action, index, all) => all.indexOf(action) === index).map(action => ({
    type: 'function',
    function: {
      name: actionToolName(action),
      description: `执行 th-art PSD→ArtBundle 确定性动作：${action}。该动作经过项目路径、脚本白名单和运行时门禁校验。`,
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
    _knowme: {
      source: 'builtin',
      capability: `project.${ARTBUNDLE_RECIPE_ID}.${action}`,
      risk: action === 'publish' ? 'external' : 'write',
      sideEffects: true,
      requiresApproval: action === 'publish',
      scope: 'sandbox',
      timeoutMs: action === 'publish' ? 180000 : 900000,
      idempotencySupported: action !== 'publish',
      rollbackSupported: false,
      resourceScope: `workflow-spec/${ctx.taskSlug}`,
      toolRef: { id: `project.th-art.${action}`, version: '1.0.0' },
    },
  }))
  const definitions = [
    {
      type: 'function',
      function: {
        name: 'emit_artbundle_specs',
        description: `原子提交当前任务的 curated manifest、node-spec 与切图说明。三个字段都必填，固定写入 workflow-spec/${ctx.taskSlug}/artifacts/。`,
        parameters: {
          type: 'object',
          properties: {
            manifest: { type: 'object', description: 'curated-manifest.json 的完整 JSON 对象' },
            nodeSpec: { type: 'object', description: 'node-spec.json 的完整 JSON 对象' },
            sliceSpec: { type: 'string', description: 'slice-spec.md 的完整 Markdown' },
          },
          required: ['manifest', 'nodeSpec', 'sliceSpec'],
          additionalProperties: false,
        },
      },
      _knowme: workflowFileContract('write', true),
    },
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
      _knowme: workflowFileContract('write', true),
    },
    {
      type: 'function',
      function: {
        name: 'read_external_workflow_file',
        description: `读取当前 ArtBundle 任务 workflow-spec/${ctx.taskSlug}/artifacts/ 下的 .json/.md。`,
        parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false },
      },
      _knowme: workflowFileContract('read', false),
    },
  ].concat(actionDefinitions)
  const handlers = {
    emit_artbundle_specs: async (args = {}) => {
      try {
        if (!args.manifest || typeof args.manifest !== 'object' || Array.isArray(args.manifest)) throw new Error('manifest 必须是 JSON 对象')
        if (!args.nodeSpec || typeof args.nodeSpec !== 'object' || Array.isArray(args.nodeSpec)) throw new Error('nodeSpec 必须是 JSON 对象')
        const sliceSpec = String(args.sliceSpec || '').trim()
        if (!sliceSpec) throw new Error('sliceSpec 不能为空')
        const files = [
          [ctx.manifestPath, `${JSON.stringify(args.manifest, null, 2)}\n`],
          [ctx.nodeSpecPath, `${JSON.stringify(args.nodeSpec, null, 2)}\n`],
          [ctx.sliceSpecPath, `${sliceSpec}\n`],
        ]
        const combined = files.map(([, content]) => content).join('\n')
        if (combined.length > MAX_AGENT_FILE_CHARS) throw new Error('规格总大小超过 1 MiB')
        if (containsSecret(combined)) throw new Error('规格疑似包含凭据，已阻止写入')
        ctx.fs.mkdirSync(ctx.artifactRoot, { recursive: true })
        for (const [target, content] of files) ctx.fs.writeFileSync(`${target}.${process.pid}.tmp`, content, 'utf8')
        for (const [target] of files) ctx.fs.renameSync(`${target}.${process.pid}.tmp`, target)
        return {
          ok: true,
          text: `已原子提交 curated manifest、node-spec 与切图说明（workflow-spec/${ctx.taskSlug}/artifacts）`,
          paths: files.map(([target]) => target),
        }
      } catch (error) {
        return { ok: false, code: 'external_file_denied', text: error.message || String(error) }
      }
    },
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
  for (const action of actionDefinitions.map(def => def.function.name)) {
    const actionName = Object.values(ACTION_BY_NODE).find(item => action === actionToolName(item))
    handlers[action] = async (_args = {}, signal) => executeExternalWorkflowAction({
      pkg,
      inputs,
      action: actionName,
      signal,
    })
  }
  return { definitions, handlers, context: ctx }
}

module.exports = {
  ARTBUNDLE_RECIPE_ID,
  ARTBUNDLE_RECIPE_NAME,
  ARTBUNDLE_SCRIPTS,
  ACTION_BY_NODE,
  RECIPE_INPUTS,
  RECIPE_OUTPUTS,
  ARTBUNDLE_CONNECTOR_DEPENDENCIES,
  artBundleConnectorDependencies,
  isArtBundlePackage,
  enrichExternalWorkflowPackage,
  resolveRecipeContext,
  resolveAllowedScript,
  preflightExternalWorkflow,
  executeExternalWorkflowAction,
  buildDeterministicArtBundleSpecs,
  buildExternalWorkflowToolBundle,
  scrubLog,
  redactStructuredOutput,
  inside,
  assertNoSymlinkPath,
  assertTreeNoSymlinks,
}

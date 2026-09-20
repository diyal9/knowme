'use strict'

const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')
const sharp = require('sharp')
const { validateImageBytes, imageFailure, MAX_IMAGE_BYTES, IMAGE_MIME_EXTENSIONS } = require('./image-validation')
const { downloadImageBytes } = require('./image-download')
const { describeImageMetadata } = require('./image-artifact-metadata')
const { createPreDispatchFailure } = require('./tool-dispatch-outcome')

const PANGO_SERVER_NAMES = ['pango-skillsrv', 'user-pango-skillsrv']
const PANGO_CONNECTOR_ID = 'pango-image-mcp'
const DEFAULT_TIMEOUT_MS = 240000
const IMAGE_URL_PATTERN = /https?:\/\/[^\s<>"')\]]+\.(?:avif|gif|jpe?g|png|svg|webp)(?:\?[^\s<>"')\]]*)?/gi

const IMAGE_TOOL_DEFS = [
  {
    type: 'function',
    function: {
      name: 'list_paint_models',
      description: '列出盘古创意作画当前可用的文生图/图生图模型。仅在没有明确模型时调用。',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
    _knowme: {
      source: 'builtin', capability: 'image-generation', risk: 'network', sideEffects: false,
      requiresApproval: false, scope: 'external', timeoutMs: 30000,
      idempotencySupported: true, rollbackSupported: false,
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_image',
      description: '使用盘古生成真实图片。仅在用户已确认生图方案后调用；成功结果会保存为本地图片成果。',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: '主体、场景、风格、构图、光照、配色、技术要求和负向约束组成的完整提示词。' },
          model: { type: 'string', description: 'list_paint_models 返回的模型 slug；不确定时省略。' },
          n: { type: 'integer', minimum: 1, maximum: 4, description: '候选图片数量，默认 1。' },
          aspect_ratio: { type: 'string', description: '图片比例，如 1:1、4:3、16:9。' },
          size: { type: 'string', description: 'auto、1K、2K、4K 或模型支持的像素尺寸。' },
          quality: { type: 'string', enum: ['auto', 'low', 'medium', 'high'] },
          reference_images: {
            type: 'array', maxItems: 8, items: { type: 'string' },
            description: '参考图：使用本轮图片旁提供的 attachment:image_<完整SHA256> 附件引用，或当前会话的 artifact:资源ID；原样复制已提供的引用，不自行编造，也不以附件名称或路径代替附件引用。仍支持已登记的图片成果路径、HTTPS URL 或 data URL。修改现有图片时必须传入对应原图。',
          },
          include_cos_urls: { type: 'boolean', description: '是否同时返回云端预览链接，默认 true。' },
          solid_background: {
            type: 'object',
            description: '仅当用户明确要求精确纯色背景时使用。平台会在生图返回后，把边界连通的原背景确定性归一化为指定颜色，并以实际像素回执验收；不会把此内部参数发送给生图服务。',
            properties: {
              color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$', description: '目标背景色，例如 #F2F3F5。' },
            },
            required: ['color'],
            additionalProperties: false,
          },
        },
        required: ['prompt'],
        additionalProperties: false,
      },
    },
    _knowme: {
      source: 'builtin', capability: 'image-generation', risk: 'network', sideEffects: true,
      requiresApproval: false, scope: 'external', timeoutMs: DEFAULT_TIMEOUT_MS,
      idempotencySupported: false, rollbackSupported: false,
    },
  },
]

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function normalizeHeaders(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [key, value] of Object.entries(raw)) {
    if (!key || value == null || typeof value === 'object') continue
    out[String(key)] = String(value)
  }
  return out
}

/** Turn the user-managed Capability Hub connector into the image tool config. */
function resolvePangoConnectorConfig(connector, runtimeOptions = {}) {
  if (!connector || connector.id !== PANGO_CONNECTOR_ID || connector.enabled !== true || connector.agentVisible === false) return null
  if (connector.type && connector.type !== 'mcp') return null
  const url = String(connector.mcp?.url || '').trim()
  if (!url) return null
  const headers = normalizeHeaders(runtimeOptions.headers)
  const accessToken = String(runtimeOptions.accessToken || '').trim()
  if (accessToken && !Object.keys(headers).some(key => key.toLowerCase() === 'authorization')) {
    headers.Authorization = /^Bearer\s/i.test(accessToken) ? accessToken : `Bearer ${accessToken}`
  }
  return { ok: true, source: `connector:${PANGO_CONNECTOR_ID}`, url, headers }
}

/** Resolve Pango from Capability Hub first, then retain existing environment/Cursor discovery. */
function resolvePangoMcpConfig(opts = {}) {
  if (opts.config?.url) {
    return { ok: true, source: 'provided', url: String(opts.config.url), headers: normalizeHeaders(opts.config.headers) }
  }
  const connectorConfig = resolvePangoConnectorConfig(opts.connector, opts.runtimeOptions)
  if (connectorConfig) return connectorConfig
  const envUrl = String(process.env.KNOWME_PANGO_MCP_URL || '').trim()
  if (envUrl) {
    const token = String(process.env.KNOWME_PANGO_ACCESS_TOKEN || '').trim()
    return {
      ok: true,
      source: 'environment',
      url: envUrl,
      headers: token ? { Authorization: /^Bearer\s/i.test(token) ? token : `Bearer ${token}` } : {},
    }
  }
  const candidates = Array.isArray(opts.configFiles) && opts.configFiles.length
    ? opts.configFiles
    : [path.join(os.homedir(), '.cursor', 'mcp.json')]
  for (const file of candidates) {
    const servers = readJson(file)?.mcpServers
    if (!servers || typeof servers !== 'object') continue
    for (const name of PANGO_SERVER_NAMES) {
      const server = servers[name]
      if (!server?.url) continue
      return {
        ok: true,
        source: `cursor:${name}`,
        url: String(server.url),
        headers: normalizeHeaders(server.headers),
      }
    }
  }
  return {
    ok: false,
    code: 'pango_not_configured',
    message: '未找到盘古生图能力。请先在本机 MCP 配置中启用 pango-skillsrv。',
  }
}

async function callPangoTool(config, name, args = {}, opts = {}) {
  if (!config?.ok || !config.url) return config
  const fetchImpl = typeof opts.fetchImpl === 'function' ? opts.fetchImpl : global.fetch
  if (typeof fetchImpl !== 'function') return { ok: false, code: 'fetch_unavailable', message: '当前运行环境不支持网络请求' }
  const controller = new AbortController()
  const externalSignal = opts.signal
  const abort = () => controller.abort()
  externalSignal?.addEventListener?.('abort', abort, { once: true })
  const timer = setTimeout(abort, Number(opts.timeoutMs) || DEFAULT_TIMEOUT_MS)
  try {
    const response = await fetchImpl(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...config.headers,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        method: 'tools/call',
        params: { name, arguments: args && typeof args === 'object' ? args : {} },
      }),
      signal: controller.signal,
    })
    let body
    try { body = await response.json() } catch { body = null }
    if (!response.ok) {
      return { ok: false, code: 'pango_http_error', message: `盘古生图服务连接失败（HTTP ${response.status}）` }
    }
    if (body?.error) {
      return { ok: false, code: 'pango_rpc_error', message: String(body.error.message || '盘古 MCP 返回错误').slice(0, 500) }
    }
    if (body?.result?.isError) {
      const message = (body.result.content || []).filter(item => item?.type === 'text').map(item => item.text).join('\n')
      return { ok: false, code: 'pango_tool_error', message: String(message || '盘古生图工具执行失败').slice(0, 1000) }
    }
    return { ok: true, result: body?.result || {}, source: config.source }
  } catch (error) {
    const aborted = controller.signal.aborted
    return {
      ok: false,
      code: aborted ? 'pango_timeout' : 'pango_request_failed',
      message: aborted ? '图片生成等待超时，请稍后重试' : `盘古生图服务不可用：${String(error?.message || error).slice(0, 300)}`,
    }
  } finally {
    clearTimeout(timer)
    externalSignal?.removeEventListener?.('abort', abort)
  }
}

function imagePayload(block) {
  if (!block || typeof block !== 'object') return null
  const mimeType = String(block.mimeType || block.mime_type || 'image/png').toLowerCase()
  let value = String(block.data || block.base64 || '').trim()
  if (block.type !== 'image' && !value) return null
  const match = value.match(/^data:([^;,]+);base64,(.+)$/s)
  if (match) {
    value = match[2]
    if ((block.mimeType || block.mime_type) && mimeType !== match[1].toLowerCase()) {
      return { mimeType, base64: value, code: 'image_mime_mismatch' }
    }
    return { mimeType: match[1].toLowerCase(), base64: value }
  }
  return { mimeType, base64: value }
}

function solidBackgroundRequest(value) {
  if (value == null) return null
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const match = String(value.color || '').trim().match(/^#([0-9a-f]{6})$/i)
  if (!match || Object.keys(value).some(key => key !== 'color')) return false
  const hex = match[1].toUpperCase()
  return {
    color: `#${hex}`,
    rgb: [0, 2, 4].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16)),
  }
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] || 0
}

async function normalizeSolidBackground(buffer, request, opts = {}) {
  if (!request) return { ok: true, buffer, mimeType: '', evidence: null }
  if (opts.signal?.aborted) return imageFailure('image_cancelled')
  try {
    sharp.cache(false)
    const decoded = await sharp(buffer, { animated: false, failOn: 'warning', limitInputPixels: 32 * 1024 * 1024 })
      .rotate()
      .toColourspace('srgb')
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    if (opts.signal?.aborted) return imageFailure('image_cancelled')
    const { width, height, channels } = decoded.info
    if (!width || !height || channels !== 4) return imageFailure('image_background_normalization_failed')
    const pixels = decoded.data
    const border = []
    const addBorder = index => border.push([pixels[index], pixels[index + 1], pixels[index + 2]])
    for (let x = 0; x < width; x += 1) {
      addBorder(x * channels)
      if (height > 1) addBorder(((height - 1) * width + x) * channels)
    }
    for (let y = 1; y < height - 1; y += 1) {
      addBorder((y * width) * channels)
      if (width > 1) addBorder((y * width + width - 1) * channels)
    }
    const seed = [0, 1, 2].map(channel => median(border.map(pixel => pixel[channel])))
    const toleranceSquared = 96 * 96
    const candidate = pixelIndex => {
      const offset = pixelIndex * channels
      if (pixels[offset + 3] === 0) return true
      const dr = pixels[offset] - seed[0]
      const dg = pixels[offset + 1] - seed[1]
      const db = pixels[offset + 2] - seed[2]
      return dr * dr + dg * dg + db * db <= toleranceSquared
    }
    const total = width * height
    const visited = new Uint8Array(total)
    const queue = new Uint32Array(total)
    let head = 0
    let tail = 0
    const enqueue = index => {
      if (visited[index] || !candidate(index)) return
      visited[index] = 1
      queue[tail++] = index
    }
    for (let x = 0; x < width; x += 1) {
      enqueue(x)
      enqueue((height - 1) * width + x)
    }
    for (let y = 1; y < height - 1; y += 1) {
      enqueue(y * width)
      enqueue(y * width + width - 1)
    }
    while (head < tail) {
      const index = queue[head++]
      const x = index % width
      const y = Math.floor(index / width)
      if (x > 0) enqueue(index - 1)
      if (x + 1 < width) enqueue(index + 1)
      if (y > 0) enqueue(index - width)
      if (y + 1 < height) enqueue(index + width)
    }
    const ratio = tail / total
    if (ratio < 0.05 || ratio > 0.95) return imageFailure('image_background_not_detected')
    for (let index = 0; index < total; index += 1) {
      if (!visited[index]) continue
      const offset = index * channels
      pixels[offset] = request.rgb[0]
      pixels[offset + 1] = request.rgb[1]
      pixels[offset + 2] = request.rgb[2]
      pixels[offset + 3] = 255
    }
    const output = await sharp(pixels, { raw: { width, height, channels } }).png().toBuffer()
    return {
      ok: true,
      buffer: output,
      mimeType: 'image/png',
      evidence: {
        protocol: 'knowme.solid-background/v1',
        source: 'deterministic-border-connected-pixels',
        color: request.color,
        replacedPixels: tail,
        replacedRatio: Number(ratio.toFixed(6)),
        verified: true,
      },
    }
  } catch {
    return imageFailure(opts.signal?.aborted ? 'image_cancelled' : 'image_background_normalization_failed')
  }
}

async function saveValidatedImage(buffer, mimeType, index, opts = {}) {
  let outputBuffer = buffer
  let outputMimeType = mimeType
  let backgroundEvidence = null
  const initial = await validateImageBytes(outputBuffer, outputMimeType, opts)
  if (!initial.ok) return initial
  if (opts.solidBackground) {
    const normalized = await normalizeSolidBackground(outputBuffer, opts.solidBackground, opts)
    if (!normalized.ok) return normalized
    outputBuffer = normalized.buffer
    outputMimeType = normalized.mimeType
    backgroundEvidence = normalized.evidence
  }
  const validated = opts.solidBackground
    ? await validateImageBytes(outputBuffer, outputMimeType, opts)
    : initial
  if (!validated.ok) return validated
  if (opts.signal?.aborted) return imageFailure('image_cancelled')
  if (!opts.userData || !path.isAbsolute(String(opts.userData))) return imageFailure('image_save_failed')
  const safeRunId = String(opts.runId || 'image-run').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100)
  const outputDir = path.join(String(opts.userData), 'generated-images', safeRunId)
  const extension = IMAGE_MIME_EXTENSIONS[validated.mimeType]
  const digest = crypto.createHash('sha256').update(outputBuffer).digest('hex').slice(0, 16)
  const file = path.join(outputDir, `generated-${String(index + 1).padStart(2, '0')}-${digest}${extension}`)
  let temp = ''
  let ownsTemp = false
  try {
    fs.mkdirSync(outputDir, { recursive: true })
    if (fs.existsSync(file)) {
      const stat = fs.lstatSync(file)
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== outputBuffer.length || !fs.readFileSync(file).equals(outputBuffer)) {
        return imageFailure('image_save_failed')
      }
    } else {
      temp = `${file}.${crypto.randomBytes(8).toString('hex')}.tmp`
      const handle = fs.openSync(temp, 'wx')
      ownsTemp = true
      try { fs.writeFileSync(handle, outputBuffer) } finally { fs.closeSync(handle) }
      fs.renameSync(temp, file)
    }
    return { ok: true, artifact: {
      id: `image_${digest}`,
      kind: 'image',
      type: 'image',
      title: `生成图片 ${index + 1}`,
      targetPath: file,
      path: file,
      mimeType: validated.mimeType,
      meta: { image: {
        protocol: 'knowme.image-metadata/v1', source: 'decoded-file',
        width: validated.displayWidth, height: validated.displayHeight,
        frames: validated.pages, mimeType: validated.mimeType, byteLength: outputBuffer.length,
        sha256: crypto.createHash('sha256').update(outputBuffer).digest('hex'),
        ...(backgroundEvidence ? { solidBackground: backgroundEvidence } : {}),
      } },
    } }
  } catch {
    return imageFailure('image_save_failed')
  } finally {
    if (ownsTemp) { try { fs.unlinkSync(temp) } catch { /* already renamed */ } }
  }
}

async function persistImageBlocks(content, opts = {}) {
  const payloads = []
  for (const block of Array.isArray(content) ? content : []) {
    const payload = imagePayload(block)
    if (payload) payloads.push(payload)
    if (payloads.length === 4) break
  }
  if (!payloads.length) return { ok: false, code: 'pango_no_image', message: '生图服务未返回图片数据，请重试或更换模型。' }
  const artifactRefs = []
  const rejectedImages = []
  for (const [index, payload] of payloads.entries()) {
    let result
    if (payload.code) result = imageFailure(payload.code)
    else if (payload.base64.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4) result = imageFailure('image_budget_exceeded')
    else if (!payload.base64 || payload.base64.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(payload.base64)) result = imageFailure('image_invalid')
    else {
      const bytes = Buffer.from(payload.base64, 'base64')
      result = bytes.toString('base64') !== payload.base64 ? imageFailure('image_invalid')
        : await saveValidatedImage(bytes, payload.mimeType, index, opts)
    }
    if (result.ok) artifactRefs.push(result.artifact)
    else rejectedImages.push({ index, code: result.code })
  }
  return artifactRefs.length
    ? { ok: true, artifactRefs, rejectedImages }
    : { ...imageFailure(rejectedImages[0].code), rejectedImages }
}

/** CDN links are candidates, not artifacts: download, decode and save before receipting. */
async function persistImageUrls(content, opts = {}) {
  const urls = new Set()
  for (const block of Array.isArray(content) ? content : []) {
    if (block?.type !== 'text') continue
    const source = String(block.text || '').slice(0, 12000)
    let match
    while (urls.size < 4 && (match = IMAGE_URL_PATTERN.exec(source))) urls.add(match[0])
    IMAGE_URL_PATTERN.lastIndex = 0
    if (urls.size === 4) break
  }
  const values = [...urls]
  if (!values.length) return { ok: false, code: 'pango_no_image', message: '生图服务未返回图片数据，请重试或更换模型。' }
  const artifactRefs = []
  const rejectedImages = []
  const deadline = Date.now() + 30000
  for (const [index, url] of values.entries()) {
    const remaining = deadline - Date.now()
    const downloaded = remaining <= 0 ? imageFailure('image_download_timeout') : await downloadImageBytes(url, {
      ...opts.imageDownload, signal: opts.signal, timeoutMs: Math.min(remaining, Number(opts.imageDownload?.timeoutMs) || 15000),
    })
    const result = downloaded.ok
      ? await saveValidatedImage(downloaded.bytes, downloaded.mimeType, index, { ...opts, allowUndeclared: true })
      : downloaded
    if (result.ok) artifactRefs.push(result.artifact)
    else rejectedImages.push({ index, code: result.code })
  }
  return artifactRefs.length ? { ok: true, artifactRefs, rejectedImages } : { ...imageFailure(rejectedImages[0].code), rejectedImages }
}

function withoutImageUrls(value) {
  return String(value || '')
    .replace(IMAGE_URL_PATTERN, '')
    .replace(/(?:预览|图片)?链接\s*[:：]\s*(?=$|\n)/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function resultText(result) {
  return (Array.isArray(result?.content) ? result.content : [])
    .filter(item => item?.type === 'text')
    .map(item => String(item.text || '').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 12000)
}

function buildImageTools(opts = {}) {
  const resolveConfig = () => resolvePangoMcpConfig(opts)
  const handlers = {
    list_paint_models: async () => {
      const called = await callPangoTool(resolveConfig(), 'list_paint_models', {}, opts)
      if (!called.ok) return { ...called, text: called.message }
      return { ok: true, text: resultText(called.result) || '盘古当前没有返回可用模型。' }
    },
    generate_image: async (args = {}) => {
      const prompt = String(args.prompt || '').trim()
      if (!prompt) return createPreDispatchFailure('invalid_args', 'generate_image 需要完整 prompt')
      const solidBackground = solidBackgroundRequest(args.solid_background)
      if (solidBackground === false) {
        return createPreDispatchFailure('invalid_args', 'solid_background 需要且只接受 #RRGGBB color')
      }
      const { solid_background: _solidBackground, ...providerArgs } = args
      let references = args.reference_images
      if (Array.isArray(references) && references.length && opts.resolveMediaReference) {
        try {
          references = await Promise.all(references.map(value => opts.resolveMediaReference(value)))
        } catch (error) {
          return createPreDispatchFailure('media_reference_unavailable', String(error.message || error))
        }
      }
      const called = await callPangoTool(resolveConfig(), 'generate_image', {
        ...providerArgs,
        ...(references ? { reference_images: references } : {}),
        prompt,
        n: Math.max(1, Math.min(4, Math.floor(Number(args.n) || 1))),
        include_cos_urls: args.include_cos_urls !== false,
      }, opts)
      if (!called.ok) return { ...called, text: called.message }
      const persistenceOptions = { ...opts, ...(solidBackground ? { solidBackground } : {}) }
      const persisted = await persistImageBlocks(called.result?.content, persistenceOptions)
      const imageResult = persisted.code === 'pango_no_image'
        ? await persistImageUrls(called.result?.content, persistenceOptions)
        : persisted
      if (!imageResult.ok) return { ...imageResult, text: imageResult.message }
      const count = imageResult.artifactRefs.length
      const providerNote = withoutImageUrls(resultText(called.result))
      return {
        ok: true,
        text: [`已生成 ${count} 张图片，预览已附在成果区。`,
          ...imageResult.artifactRefs.map(describeImageMetadata),
          ...(solidBackground ? [`已确定性归一化边界连通背景为 ${solidBackground.color}；颜色与像素范围记录在图片回执中。`] : []),
          '尺寸和格式来自实际文件解码，不是请求参数；不代表画面内容已通过验收。',
          imageResult.rejectedImages?.length ? `${imageResult.rejectedImages.length} 张图片因校验、下载或保存失败而未保存。` : '',
          providerNote ? `服务返回说明（未核验，不能覆盖上述文件事实）：\n${providerNote}` : '',
        ].filter(Boolean).join('\n').slice(0, 12000),
        artifactRefs: imageResult.artifactRefs,
        receipt: {
          effects: imageResult.artifactRefs.map(artifact => ({ type: 'save', target: artifact.id })),
          images: imageResult.artifactRefs.map(artifact => ({ artifactId: artifact.id, ...artifact.meta.image })),
        },
        meta: { provider: 'pango', imageCount: count, model: String(args.model || ''), rejectedImages: imageResult.rejectedImages || [] },
      }
    },
  }
  return { definitions: IMAGE_TOOL_DEFS, handlers }
}

module.exports = {
  PANGO_SERVER_NAMES,
  PANGO_CONNECTOR_ID,
  IMAGE_TOOL_DEFS,
  resolvePangoConnectorConfig,
  resolvePangoMcpConfig,
  callPangoTool,
  persistImageBlocks,
  persistImageUrls,
  buildImageTools,
}

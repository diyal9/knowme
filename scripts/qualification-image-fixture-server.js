'use strict'

const http = require('http')
const zlib = require('zlib')

// The fixture is not a professional image score, but it must look like a
// usable preview. A 1x1 pixel made the UI path pass while hiding broken sizing,
// crop and version behavior. Keep the image deterministic and self-contained
// so QA never depends on a remote asset.
const PNG_WIDTH = 256
const PNG_HEIGHT = 256

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const name = Buffer.from(type, 'ascii')
  const payload = Buffer.concat([name, data])
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(payload), 0)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  return Buffer.concat([length, payload, checksum])
}

function setPixel(rgba, x, y, color) {
  if (x < 0 || x >= PNG_WIDTH || y < 0 || y >= PNG_HEIGHT) return
  const offset = (y * PNG_WIDTH + x) * 4
  rgba[offset] = color[0]
  rgba[offset + 1] = color[1]
  rgba[offset + 2] = color[2]
  rgba[offset + 3] = 255
}

function fillRect(rgba, left, top, right, bottom, color) {
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) setPixel(rgba, x, y, color)
  }
}

function fillCircle(rgba, cx, cy, radius, color) {
  const radiusSquared = radius * radius
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= radiusSquared) setPixel(rgba, x, y, color)
    }
  }
}

function buildFixturePng(variant = 0) {
  const rgba = Buffer.alloc(PNG_WIDTH * PNG_HEIGHT * 4)
  const background = variant === 0 ? [246, 249, 250] : [239, 246, 248]
  const body = [11, 48, 102]
  const bodyShadow = [7, 35, 77]
  const face = [225, 231, 237]
  const eye = variant === 0 ? [0, 220, 238] : [37, 205, 225]
  const smile = [197, 204, 213]
  for (let index = 0; index < rgba.length; index += 4) {
    rgba[index] = background[0]
    rgba[index + 1] = background[1]
    rgba[index + 2] = background[2]
    rgba[index + 3] = 255
  }

  fillRect(rgba, 124, 24, 132, 57, bodyShadow)
  fillCircle(rgba, 128, 63, 11, body)
  fillRect(rgba, 43, 105, 64, 151, bodyShadow)
  fillRect(rgba, 192, 105, 213, 151, bodyShadow)
  fillRect(rgba, 52, 96, 204, 163, bodyShadow)
  for (let y = 55; y <= 194; y++) {
    for (let x = 54; x <= 202; x++) {
      const corner = (x < 75 || x > 181) && (y < 76 || y > 173)
      const dx = x < 75 ? x - 75 : x > 181 ? x - 181 : 0
      const dy = y < 76 ? y - 76 : y > 173 ? y - 173 : 0
      if (!corner || dx * dx + dy * dy <= 22 * 22) setPixel(rgba, x, y, body)
    }
  }
  fillRect(rgba, 74, 80, 182, 164, face)
  fillCircle(rgba, 103, 119, 17, eye)
  fillCircle(rgba, 153, 119, 17, eye)
  for (let x = 96; x <= 160; x++) {
    const y = Math.round(177 - 0.006 * (x - 128) ** 2)
    for (let offset = -3; offset <= 3; offset++) setPixel(rgba, x, y + offset, smile)
  }

  const scanlines = Buffer.alloc((PNG_WIDTH * 4 + 1) * PNG_HEIGHT)
  for (let y = 0; y < PNG_HEIGHT; y++) {
    const row = y * (PNG_WIDTH * 4 + 1)
    scanlines[row] = 0
    rgba.copy(scanlines, row + 1, y * PNG_WIDTH * 4, (y + 1) * PNG_WIDTH * 4)
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(PNG_WIDTH, 0)
  header.writeUInt32BE(PNG_HEIGHT, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(scanlines)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]).toString('base64')
}

const PNG_BASE64 = buildFixturePng(0)
const PNG_VARIANTS = [PNG_BASE64, buildFixturePng(1)]
let generationCount = 0

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.setEncoding('utf8')
    req.on('data', chunk => {
      raw += chunk
      if (raw.length > 4 * 1024 * 1024) {
        reject(new Error('fixture request too large'))
        req.destroy()
      }
    })
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}) } catch (error) { reject(error) }
    })
    req.on('error', reject)
  })
}

function json(res, body, status = 200) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function textFromMessage(message) {
  const content = message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map(item => item?.text || '').join('\n')
  return ''
}

function transcriptText(messages) {
  return (Array.isArray(messages) ? messages : [])
    .map(message => `${message?.role || ''}\n${textFromMessage(message)}\n${JSON.stringify(message?.tool_calls || '')}`)
    .join('\n')
}

function lastUserPrompt(messages) {
  const user = [...(Array.isArray(messages) ? messages : [])]
    .reverse()
    .find(message => message?.role === 'user')
  return textFromMessage(user).slice(0, 8000) || 'qualification image fixture'
}

function chatCompletion(body) {
  const messages = Array.isArray(body?.messages) ? body.messages : []
  const hasToolResult = messages.some(message => message?.role === 'tool')
  if (!hasToolResult) {
    const transcript = transcriptText(messages)
    const prompt = /不返回图片|无图片|故障注入/.test(transcript)
      ? `${lastUserPrompt(messages)}\n故障注入：不返回图片`
      : lastUserPrompt(messages)
    const isRevision = /上一版|previous_deliverable|验收后|修改轮/.test(transcript)
    const previousArtifact = transcript.match(/artifact:(image_[a-zA-Z0-9_-]+)/)?.[1]
    const args = {
      prompt,
      aspect_ratio: /4:3/.test(prompt) ? '4:3' : '1:1',
      n: 1,
    }
    if (isRevision && previousArtifact) args.reference_images = [`artifact:${previousArtifact}`]
    return {
      id: `fixture-${Date.now()}`,
      object: 'chat.completion',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [{
            id: `generate-image-${Date.now()}`,
            type: 'function',
            function: {
              name: 'generate_image',
              arguments: JSON.stringify(args),
            },
          }],
        },
        finish_reason: 'tool_calls',
      }],
    }
  }

  const failed = /不返回图片|无图片|pango_no_image|未返回图片/.test(transcriptText(messages))
  return {
    id: `fixture-${Date.now()}`,
    object: 'chat.completion',
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: failed
          ? '工具没有返回可验证的图片文件，因此本次不能交付图片成果。我已保留任务背景，可以重试或更换生图模型。'
          : '已收到真实图片文件并完成基础完整性检查，请查看对话中的图片预览。',
      },
      finish_reason: 'stop',
    }],
  }
}

function mcpResult(body) {
  const name = String(body?.params?.name || '')
  const args = body?.params?.arguments || {}
  if (body?.method === 'tools/list') {
    return {
      tools: [
        { name: 'list_paint_models', description: 'Qualification fixture model discovery' },
        { name: 'generate_image', description: 'Qualification fixture image generation' },
      ],
    }
  }
  if (name === 'list_paint_models') {
    return { content: [{ type: 'text', text: 'qualification-image-fixture' }] }
  }
  if (name !== 'generate_image') {
    return { isError: true, content: [{ type: 'text', text: `unknown fixture tool: ${name}` }] }
  }
  const prompt = String(args.prompt || '')
  if (/不返回图片|无图片|故障注入/.test(prompt)) {
    return { content: [{ type: 'text', text: '测试工具成功返回文本，但按故障注入约定不返回图片数据。' }] }
  }
  const image = PNG_VARIANTS[generationCount++ % PNG_VARIANTS.length]
  return {
    content: [
      { type: 'image', mimeType: 'image/png', data: image },
      { type: 'text', text: 'fixture generated a decodable image payload' },
    ],
  }
}

function createServer(kind) {
  return http.createServer(async (req, res) => {
    if (req.method !== 'POST') return json(res, { error: 'POST required' }, 405)
    try {
      const body = await readBody(req)
      if (kind === 'llm') return json(res, chatCompletion(body))
      return json(res, { jsonrpc: '2.0', id: body?.id || 'fixture', result: mcpResult(body) })
    } catch (error) {
      return json(res, { error: String(error?.message || error) }, 400)
    }
  })
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  return server.address().port
}

async function main() {
  const llm = createServer('llm')
  const mcp = createServer('mcp')
  const [llmPort, mcpPort] = await Promise.all([listen(llm), listen(mcp)])
  process.stdout.write(JSON.stringify({
    apiEndpoint: `http://127.0.0.1:${llmPort}/v1/chat/completions`,
    mcpEndpoint: `http://127.0.0.1:${mcpPort}/mcp`,
  }) + '\n')
  const close = () => Promise.all([
    new Promise(resolve => llm.close(() => resolve())),
    new Promise(resolve => mcp.close(() => resolve())),
  ]).finally(() => process.exit(0))
  process.once('SIGINT', close)
  process.once('SIGTERM', close)
}

if (require.main === module) main().catch(error => {
  process.stderr.write(`${error?.stack || error}\n`)
  process.exitCode = 1
})

module.exports = { PNG_BASE64, PNG_HEIGHT, PNG_VARIANTS, PNG_WIDTH, buildFixturePng, chatCompletion, mcpResult }

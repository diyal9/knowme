'use strict'

// Controlled adapter replay of RQA24 originals. No provider or model calls.
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const assert = require('node:assert/strict')
require('../../../../scripts/register-ts.js')
const { buildImageTools } = require('../../../../src/lib/agent-image-tools')
const { buildMediaObservation } = require('../../../../src/lib/agent-media-resources')

async function main() {
  const sourceRoot = 'D:/USERCA~1/Temp/knowme-expert-qualification-e3808573825e42908aef0a0f2d0f20de/generated-images'
  const sources = [
    ['v1', 'image/jpeg', 'expert_task-mtphk5gg-jinbr_mtpi45c0/generated-01-6c8124d9d8735d9b.jpg'],
    ['v2', 'image/png', 'expert_task-mtphk5gg-jinbr_mtpidoxs/generated-01-b35a1e161e1cbf3d.png'],
  ]
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-rqa25-image-replay-'))
  const outputs = []
  for (const [version, mimeType, relative] of sources) {
    const source = path.join(sourceRoot, relative)
    const bytes = fs.readFileSync(source)
    const beforeHash = crypto.createHash('sha256').update(bytes).digest('hex')
    const result = await buildImageTools({ userData, runId: `rqa25-replay-${version}`,
      config: { url: 'https://replay.example.test/mcp' },
      fetchImpl: async () => ({ ok: true, json: async () => ({ result: { content: [
        { type: 'text', text: 'requested size=1080x1440' },
        { type: 'image', mimeType, data: bytes.toString('base64') },
      ] } }) }),
    }).handlers.generate_image({ prompt: 'Controlled replay, no new generation', size: '1080x1440', n: 1 })
    assert.equal(result.ok, true)
    const artifact = result.artifactRefs[0]
    assert.equal(artifact.meta.image.sha256, beforeHash)
    assert.deepEqual(fs.readFileSync(artifact.targetPath), bytes)
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'), beforeHash)
    outputs.push({ version, source, beforeHash, text: result.text, artifact,
      receipt: result.receipt, observation: await buildMediaObservation([artifact], { supportsVision: false }) })
  }
  console.log(JSON.stringify({ stage: 'RQA25', at: new Date().toISOString(),
    mode: 'controlled replay of real RQA24 bytes; no new provider/model call', userData, outputs }))
}

main().catch(error => { console.error(error); process.exitCode = 1 })

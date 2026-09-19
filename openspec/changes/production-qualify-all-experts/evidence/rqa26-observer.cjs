'use strict'
// Isolated-QA-only observation. No headers; prompts remain sensitive test data.
// Redaction is defense in depth, not a guarantee about arbitrary natural text.
const crypto = require('node:crypto')
const hash = value => crypto.createHash('sha256').update(value).digest('hex')
function scrub(value, key = '') {
  if (/authorization|api.?key|token|password|credential|secret|headers/i.test(key)) return '[redacted]'
  if (Array.isArray(value)) return value.map(item => scrub(item))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrub(v, k)]))
  if (typeof value !== 'string') return value
  if (/^\s*[\[{]/.test(value)) { try { return JSON.stringify(scrub(JSON.parse(value))) } catch {} }
  const data = value.match(/^data:(image\/[\w.+-]+);base64,(.+)$/s)
  if (data) { const bytes = Buffer.from(data[2], 'base64'); return { kind: 'image-bytes', mimeType: data[1], sha256: hash(bytes), byteLength: bytes.length } }
  if (value.length > 10000 && /^[A-Za-z0-9+/]+=*$/.test(value)) { const bytes = Buffer.from(value, 'base64'); return { kind: 'inline-bytes', sha256: hash(bytes), byteLength: bytes.length } }
  return value.replace(/https?:\/\/[^\s"<>]+/g, found => {
    try { const u = new URL(found); return u.origin + u.pathname } catch { return '[unparseable URL]' }
  }).replace(/\b(api[_-]?key|access[_-]?token|password|authorization)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
}
function install(expectedRoot) {
  const { app } = require('electron')
  const path = require('node:path')
  if (path.resolve(app.getPath('userData')).toLowerCase() !== path.resolve(expectedRoot).toLowerCase()) throw new Error('QA profile mismatch')
  if (global.__rqa26Observer) throw new Error('Observer already installed')
  const state = { label: 'discovery', records: [], restored: false }
  const restores = []
  function record(raw, transport) {
    try {
      if (state.records.length >= 64 || Buffer.byteLength(raw) > 12 * 1024 * 1024) {
        state.omittedRequests = (state.omittedRequests || 0) + 1
        return null
      }
      const body = JSON.parse(raw)
      if (!Array.isArray(body.messages) && body.method !== 'tools/call') return null
      const row = { label: state.label, transport, startedAt: new Date().toISOString(), body: scrub(body) }
      state.records.push(row)
      return row
    } catch { return null }
  }
  for (const name of ['node:http', 'node:https']) {
    const mod = require(name), original = mod.request
    mod.request = function (...args) {
      const request = original.apply(this, args), chunks = []
      const write = request.write, end = request.end
      let size = 0
      function append(chunk) {
        if (typeof chunk !== 'string' && !Buffer.isBuffer(chunk)) return
        size += Buffer.byteLength(chunk)
        if (size <= 12 * 1024 * 1024) chunks.push(Buffer.from(chunk))
      }
      request.write = function (chunk, ...rest) { append(chunk); return write.call(this, chunk, ...rest) }
      request.end = function (chunk, ...rest) {
        append(chunk)
        if (size <= 12 * 1024 * 1024) record(Buffer.concat(chunks).toString(), name)
        return end.call(this, chunk, ...rest)
      }
      return request
    }
    restores.push(() => { mod.request = original })
  }
  const originalFetch = global.fetch
  global.fetch = async function (input, init) {
    const row = typeof init?.body === 'string' ? record(init.body, 'fetch') : null
    try {
      const response = await originalFetch.call(this, input, init)
      if (row) {
        row.status = response.status
        row.returnedAt = new Date().toISOString()
        // Do not clone/consume provider responses. Task receipts and subsequent
        // model observations provide result evidence without a second body read.
      }
      return response
    } catch (error) { if (row) row.error = scrub(String(error?.message || error)); throw error }
  }
  restores.push(() => { global.fetch = originalFetch })
  state.restore = () => { restores.reverse().forEach(fn => fn()); state.restored = true }
  global.__rqa26Observer = state
  return { installed: true, pid: process.pid }
}
module.exports = { install, scrub }

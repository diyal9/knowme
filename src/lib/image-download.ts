'use strict'
const https = require('https')
const dns = require('dns').promises
const net = require('net')
const { assertSafeUrl } = require('./web-fetch-ssrf')
const { MAX_IMAGE_BYTES, imageFailure } = require('./image-validation')

function requestImageHop(url, records, opts, signal, maxBytes) {
  return new Promise(resolve => {
    let settled = false
    let request
    let response
    const finish = result => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', abort)
      // Also close redirect/oversized streams without consuming an unbounded body.
      response?.destroy()
      request?.destroy()
      resolve(result)
    }
    const abort = () => finish(imageFailure('image_cancelled'))
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) { abort(); return }
    try {
      request = (opts.requestImpl || https.request)(url, {
        method: 'GET', agent: false, signal,
        headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif', 'Accept-Encoding': 'identity' },
        // Use precisely the checked addresses; do not resolve the hostname a second time.
        lookup: (_hostname, lookupOptions, callback) => {
          if (lookupOptions?.all) callback(null, records)
          else callback(null, records[0].address, records[0].family)
        },
      }, incoming => {
        response = incoming
        if (settled) { response.destroy(); return }
        const status = response.statusCode || 0
        if ([301, 302, 303, 307, 308].includes(status)) {
          finish({ ok: true, location: response.headers.location || '' })
          return
        }
        if (status < 200 || status >= 300 || (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity')) {
          finish(imageFailure('image_download_failed')); return
        }
        if (Number(response.headers['content-length']) > maxBytes) {
          finish(imageFailure('image_budget_exceeded')); return
        }
        const chunks = []
        let length = 0
        response.on('error', () => finish(imageFailure('image_download_failed')))
        response.on('aborted', () => finish(imageFailure('image_download_failed')))
        response.on('data', chunk => {
          if (settled) return
          length += chunk.length
          if (length > maxBytes) { finish(imageFailure('image_budget_exceeded')); return }
          chunks.push(Buffer.from(chunk))
        })
        response.on('end', () => finish({ ok: true, bytes: Buffer.concat(chunks, length), mimeType: response.headers['content-type'] || '' }))
      })
      request.on('error', () => finish(imageFailure('image_download_failed')))
      request.end()
    } catch { finish(imageFailure('image_download_failed')) }
  })
}

async function downloadImageBytes(rawUrl, opts = {}) {
  const controller = new AbortController()
  const cancel = () => controller.abort()
  opts.signal?.addEventListener('abort', cancel, { once: true })
  if (opts.signal?.aborted) controller.abort()
  const timeoutMs = Math.max(1, Math.min(15000, Number(opts.timeoutMs) || 15000))
  const maxBytes = Math.max(1, Math.min(MAX_IMAGE_BYTES, Number(opts.maxBytes) || MAX_IMAGE_BYTES))
  const timer = setTimeout(cancel, timeoutMs)
  let wakeAbort
  const aborted = new Promise(resolve => { wakeAbort = () => resolve(null) })
  controller.signal.addEventListener('abort', wakeAbort, { once: true })
  try {
    let target = rawUrl
    for (let hop = 0; hop < 4; hop += 1) {
      if (controller.signal.aborted) return imageFailure(opts.signal?.aborted ? 'image_cancelled' : 'image_download_timeout')
      let url
      try { url = new URL(target) } catch { return imageFailure('image_download_blocked') }
      if (url.protocol !== 'https:' || url.username || url.password) return imageFailure('image_download_blocked')
      let records = []
      const checking = assertSafeUrl(url.href, { lookup: async (host, options) => {
        records = await (opts.lookup || dns.lookup)(host, options)
        return records
      } })
      // OS DNS lookup cannot be cancelled, but after deadline no late socket is opened.
      const safe = await Promise.race([checking, aborted])
      if (controller.signal.aborted || !safe) return imageFailure(opts.signal?.aborted ? 'image_cancelled' : 'image_download_timeout')
      if (!safe.ok) return imageFailure('image_download_blocked')
      // Native HTTPS skips DNS for literal IPs. Keep the callback safe too, without
      // inventing a DNS result before the same private-address check has passed.
      const address = safe.url.hostname.replace(/^\[|\]$/g, '')
      const family = net.isIP(address)
      if (family) records = [{ address, family }]
      const result = await requestImageHop(safe.url, records, opts, controller.signal, maxBytes)
      if (controller.signal.aborted) return imageFailure(opts.signal?.aborted ? 'image_cancelled' : 'image_download_timeout')
      if (!result.ok || result.bytes) return result
      if (!result.location) return imageFailure('image_download_blocked')
      try { target = new URL(result.location, safe.url).href } catch { return imageFailure('image_download_blocked') }
    }
    return imageFailure('image_download_blocked')
  } catch {
    return imageFailure('image_download_failed')
  } finally {
    clearTimeout(timer)
    controller.signal.removeEventListener('abort', wakeAbort)
    opts.signal?.removeEventListener('abort', cancel)
  }
}

module.exports = { downloadImageBytes }

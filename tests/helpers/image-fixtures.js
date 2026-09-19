'use strict'
const sharp = require('sharp')
const { EventEmitter } = require('node:events')
const { Readable } = require('node:stream')

async function imageFixture(format = 'png', options = {}) {
  return sharp({ create: { width: 3, height: 2, channels: 4, background: '#397ecc', ...options } })
    .toFormat(format).toBuffer()
}

// Only transport is mocked. Every accepted fixture is decoded by the real native library.
function mockImageRequest(hops, seen = []) {
  return (url, options, callback) => {
    const req = new EventEmitter()
    req.destroyed = false
    req.destroy = error => {
      req.destroyed = true
      req.response?.destroy()
      if (error) queueMicrotask(() => req.emit('error', error))
    }
    req.end = () => queueMicrotask(() => {
      if (req.destroyed) return
      const hop = hops[Math.min(seen.length, hops.length - 1)]
      seen.push({ url: String(url), options, req })
      if (hop.stall) return
      const response = Readable.from(hop.chunks || [hop.bytes || Buffer.alloc(0)])
      response.statusCode = hop.status || 200
      response.headers = hop.headers || { 'content-type': 'image/png' }
      req.response = response
      callback(response)
    })
    return req
  }
}

module.exports = { imageFixture, mockImageRequest }

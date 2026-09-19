'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { downloadImageBytes } = require('../src/lib/image-download')
const { mockImageRequest } = require('./helpers/image-fixtures')
const lookup = async () => [{ address: '93.184.216.34', family: 4 }]

test('public HTTPS IPv4/IPv6 literals need no DNS and provide safe single/all lookup records', async () => {
  for (const [host, address, family] of [
    ['93.184.216.34', '93.184.216.34', 4],
    ['[2606:4700:4700::1111]', '2606:4700:4700::1111', 6],
  ]) {
    const seen = []
    const result = await downloadImageBytes(`https://${host}/image.png`, {
      lookup: async () => assert.fail('IP literals must not resolve DNS'),
      requestImpl: mockImageRequest([{ bytes: Buffer.from('image bytes') }], seen),
    })
    assert.equal(result.ok, true)
    assert.equal(seen.length, 1)
    const options = seen[0].options
    assert.equal(options.rejectUnauthorized, undefined, 'TLS certificate checking must remain enabled by default')
    assert.equal(options.checkServerIdentity, undefined, 'do not bypass native certificate identity checks')
    const all = await new Promise((resolve, reject) => options.lookup(address, { all: true }, (err, records) => err ? reject(err) : resolve(records)))
    assert.deepEqual(all, [{ address, family }])
    const one = await new Promise((resolve, reject) => options.lookup(address, {}, (err, ip, version) => err ? reject(err) : resolve({ address: ip, family: version })))
    assert.deepEqual(one, { address, family })
  }
})

test('public literal redirects keep per-hop SSRF checks including private IPv6 and IPv4-mapped IPv6', async () => {
  const seen = []
  const result = await downloadImageBytes('https://images.example.test/a.png', {
    lookup, requestImpl: mockImageRequest([
      { status: 302, headers: { location: 'https://93.184.216.34/b.png' } },
      { bytes: Buffer.from('bounded') },
    ], seen),
  })
  assert.equal(result.ok, true)
  assert.equal(seen.length, 2)
  for (const host of ['127.0.0.1', '[::1]', '[fd00::1]', '[::ffff:127.0.0.1]']) {
    const hops = []
    const blocked = await downloadImageBytes('https://93.184.216.34/a.png', {
      lookup: async () => assert.fail('no DNS for literals'),
      requestImpl: mockImageRequest([{ status: 302, headers: { location: `https://${host}/b.png` } }], hops),
    })
    assert.equal(blocked.code, 'image_download_blocked')
    assert.equal(hops.length, 1, 'private redirect must not open a second request')
    const direct = await downloadImageBytes(`https://${host}/b.png`, { requestImpl: () => assert.fail('private direct request') })
    assert.equal(direct.code, 'image_download_blocked')
  }
})

test('bounded binary downloader pins checked DNS, follows relative redirects without credentials', async () => {
  const seen = []
  const result = await downloadImageBytes('https://images.example.test/a.png', {
    lookup, requestImpl: mockImageRequest([
      { status: 302, headers: { location: '/b.png' } }, { bytes: Buffer.from('bytes') },
    ], seen),
  })
  assert.equal(result.ok, true)
  assert.equal(result.bytes.toString(), 'bytes')
  assert.equal(seen.length, 2)
  assert.equal(seen[1].url, 'https://images.example.test/b.png')
  assert.equal(seen[1].options.headers.Authorization, undefined)
  const pinned = await new Promise((resolve, reject) => seen[1].options.lookup('images.example.test', { all: true }, (err, records) => err ? reject(err) : resolve(records)))
  assert.deepEqual(pinned, await lookup())
})

test('private DNS, private redirect, credentials, HTTP and redirect loops are blocked', async () => {
  for (const url of ['http://images.example.test/a.png', 'https://u:secret@images.example.test/a.png', 'https://127.0.0.1/a.png']) {
    assert.equal((await downloadImageBytes(url, { lookup, requestImpl: () => assert.fail('no request') })).ok, false)
  }
  const privateDns = await downloadImageBytes('https://images.example.test/a.png', {
    lookup: async () => [{ address: '10.0.0.1', family: 4 }], requestImpl: () => assert.fail('no private request'),
  })
  assert.equal(privateDns.code, 'image_download_blocked')
  for (const target of ['https://127.0.0.1/a.png', '/loop.png']) {
    const seen = []
    const result = await downloadImageBytes('https://images.example.test/a.png', {
      lookup, requestImpl: mockImageRequest([{ status: 302, headers: { location: target } }], seen),
    })
    assert.equal(result.code, 'image_download_blocked')
    assert.ok(seen.length <= 4)
  }
})

test('declared and streaming overflow destroy the request; compressed HTTP bodies are not expanded', async () => {
  for (const hop of [
    { headers: { 'content-length': '100' } },
    { chunks: [Buffer.alloc(8), Buffer.alloc(8)] },
    { headers: { 'content-encoding': 'gzip' }, bytes: Buffer.from('compressed') },
  ]) {
    const seen = []
    const result = await downloadImageBytes('https://images.example.test/a.png', { lookup, maxBytes: 12, requestImpl: mockImageRequest([hop], seen) })
    assert.equal(result.ok, false)
    assert.equal(seen[0].req.destroyed, true)
  }
})

test('total deadline and user abort destroy stalled network I/O; stalled DNS cannot open a late socket', async () => {
  const seen = []
  const result = await downloadImageBytes('https://images.example.test/a.png', {
    lookup, timeoutMs: 20, requestImpl: mockImageRequest([{ stall: true }], seen),
  })
  assert.equal(result.code, 'image_download_timeout')
  assert.equal(seen[0].req.destroyed, true)
  const controller = new AbortController()
  const promise = downloadImageBytes('https://images.example.test/a.png', {
    lookup, signal: controller.signal, requestImpl: mockImageRequest([{ stall: true }]),
  })
  controller.abort()
  assert.equal((await promise).code, 'image_cancelled')
  let resolveDns
  const dnsResult = await downloadImageBytes('https://images.example.test/a.png', {
    timeoutMs: 20, lookup: () => new Promise(resolve => { resolveDns = resolve }), requestImpl: () => assert.fail('late socket'),
  })
  assert.equal(dnsResult.code, 'image_download_timeout')
  resolveDns(await lookup())
  await new Promise(resolve => setImmediate(resolve))
})

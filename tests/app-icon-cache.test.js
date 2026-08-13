const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const { materializeWindowsIcon } = require('../src/lib/app-icon')

describe('Windows app icon cache', () => {
  it('uses an immutable content-addressed path for each icon version', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-icon-'))
    const sourcePath = path.join(tempDir, 'source.ico')

    try {
      const firstBytes = Buffer.from('first-icon-version')
      fs.writeFileSync(sourcePath, firstBytes)
      const firstPath = materializeWindowsIcon(sourcePath, tempDir)
      const firstDigest = crypto.createHash('sha256').update(firstBytes).digest('hex').slice(0, 12)

      assert.equal(path.basename(firstPath), `app-icon-${firstDigest}.ico`)
      assert.deepEqual(fs.readFileSync(firstPath), firstBytes)
      assert.equal(materializeWindowsIcon(sourcePath, tempDir), firstPath, 'same content reuses its path')

      const secondBytes = Buffer.from('second-icon-version')
      fs.writeFileSync(sourcePath, secondBytes)
      const secondPath = materializeWindowsIcon(sourcePath, tempDir)

      assert.notEqual(secondPath, firstPath, 'changed content receives a new path')
      assert.deepEqual(fs.readFileSync(secondPath), secondBytes)
      assert.deepEqual(fs.readFileSync(firstPath), firstBytes, 'previous cached path stays immutable')
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })
})

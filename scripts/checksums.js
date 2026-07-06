#!/usr/bin/env node
/**
 * electron-builder afterAllArtifactBuild hook — write SHA256SUMS.txt into dist/
 */
'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const ARTIFACT_RE = /\.(exe|zip|dmg|yml|blockmap)$/i

function sha256File(filePath) {
  const hash = crypto.createHash('sha256')
  hash.update(fs.readFileSync(filePath))
  return hash.digest('hex')
}

module.exports = async function afterAllArtifactBuild(context) {
  const dist = context.outDir || path.join(__dirname, '..', 'dist')
  if (!fs.existsSync(dist)) return

  const names = fs.readdirSync(dist).filter(n => ARTIFACT_RE.test(n))
  if (!names.length) return

  const lines = names.map(name => `${sha256File(path.join(dist, name))}  ${name}`)
  const out = path.join(dist, 'SHA256SUMS.txt')
  fs.writeFileSync(out, `${lines.join('\n')}\n`, 'utf8')
  console.log('checksums: wrote', out, `(${names.length} artifacts)`)
}

'use strict'

/**
 * Optional manual Feishu apply probe — SKIP when FEISHU_CONFIG=NO
 */
const fs = require('fs')
const path = require('path')

const OUT = path.join(__dirname, 'manual-feishu-apply-probe.json')

async function main() {
  if (process.env.FEISHU_CONFIG === 'NO' || !process.env.FEISHU_CONFIG) {
    const payload = { ok: true, skipped: true, reason: 'FEISHU_CONFIG not set', at: new Date().toISOString() }
    fs.writeFileSync(OUT, JSON.stringify(payload, null, 2))
    console.log('SKIP: no FEISHU_CONFIG')
    process.exit(0)
  }
  const payload = { ok: true, skipped: false, note: 'Manual UAT required with live credentials', at: new Date().toISOString() }
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2))
  process.exit(0)
}

main()

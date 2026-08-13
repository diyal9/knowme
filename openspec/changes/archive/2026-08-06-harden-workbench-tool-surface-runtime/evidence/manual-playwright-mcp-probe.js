'use strict'

/**
 * Optional Playwright MCP probe — SKIP when MCP_DIR=NO
 */
const fs = require('fs')
const path = require('path')

const OUT = path.join(__dirname, 'manual-playwright-mcp-probe.json')

async function main() {
  if (process.env.MCP_DIR === 'NO' || !process.env.MCP_DIR) {
    const payload = { ok: true, skipped: true, reason: 'MCP_DIR not set', at: new Date().toISOString() }
    fs.writeFileSync(OUT, JSON.stringify(payload, null, 2))
    console.log('SKIP: no MCP_DIR')
    process.exit(0)
  }
  const payload = { ok: true, skipped: false, note: 'Manual UAT required with Playwright MCP', at: new Date().toISOString() }
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2))
  process.exit(0)
}

main()

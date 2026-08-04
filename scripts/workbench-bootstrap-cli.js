'use strict'

/**
 * KnowMe Workbench bootstrap CLI — deploy workflows + optional compat patch.
 * Does NOT commit/push the external workbench repository.
 */

const bootstrap = require('../src/lib/workbench-bootstrap')

function parseArgs(argv) {
  return {
    applyCompat: argv.includes('--apply-compat'),
    deployOnly: argv.includes('--deploy-only'),
    dryRun: argv.includes('--dry-run'),
    statusOnly: argv.includes('--status'),
    installPath: (() => {
      const idx = argv.indexOf('--install')
      return idx >= 0 ? String(argv[idx + 1] || '').trim() : ''
    })(),
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const settings = { workbenchInstall: { path: args.installPath } }

  if (args.statusOnly) {
    const status = bootstrap.buildPublicStatus(settings)
    console.log(JSON.stringify(status, null, 2))
    process.exit(status.ok ? 0 : 1)
  }

  const result = bootstrap.runBootstrap(settings, {
    installPath: args.installPath,
    deploy: !args.deployOnly || true,
    applyCompat: args.applyCompat,
    dryRun: args.dryRun,
  })

  console.log(JSON.stringify(result, null, 2))
  process.exit(result.ok ? 0 : 1)
}

main()

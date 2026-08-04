'use strict'

/** @deprecated Use scripts/workbench-bootstrap-cli.js */
const bootstrap = require('../src/lib/workbench-bootstrap')

function main() {
  const installPath = process.env.KNOWME_WORKBENCH_INSTALL
    || process.env.KNOWME_WORKBENCH_ROOT
    || ''
  const settings = { workbenchInstall: { path: installPath } }
  const result = bootstrap.runBootstrap(settings, {
    installPath,
    deploy: true,
    applyCompat: true,
  })
  console.log(JSON.stringify(result, null, 2))
  process.exit(result.ok ? 0 : 1)
}

main()

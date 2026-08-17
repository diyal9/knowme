'use strict'

/**
 * Retired: VM chunk splitting is forbidden.
 * Main process uses explicit require() modules (src/main/part-*.ts + ipc-bind.ts).
 */
console.error('split-main-index-chunks.js is retired. Do not reintroduce vm chunk loading.')
process.exit(1)

'use strict'

const { normalizeBenchmarkResult } = require('../benchmark-schema')

function createBlockedAdapter(id) {
  return {
    id,
    async prepareContext(task) {
      return { task, blocked: true }
    },
    async runTask(task) {
      return normalizeBenchmarkResult({
        finalAnswer: '',
        toolLogs: [],
        evidenceRefs: [],
        latencyMs: 0,
        rounds: 0,
        errors: [`${id} adapter not configured for live benchmark`],
        metadata: {
          product: id,
          terminal: 'BLOCKED',
          status: 'blocked',
        },
      })
    },
    async cleanup() {
      return undefined
    },
  }
}

module.exports = createBlockedAdapter('workbuddy')

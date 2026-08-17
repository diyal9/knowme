'use strict'

const DEFAULT_HISTOGRAM_LIMIT = 128

function finiteNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function percentile(values, ratio) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))
  return sorted[index]
}

class AgentRuntimeMetrics {
  constructor(opts = {}) {
    this.now = typeof opts.now === 'function' ? opts.now : () => Date.now()
    this.histogramLimit = Math.max(8, finiteNumber(opts.histogramLimit, DEFAULT_HISTOGRAM_LIMIT))
    this.counters = new Map()
    this.gauges = new Map()
    this.histograms = new Map()
    this.lastEvents = new Map()
  }

  increment(name, amount = 1, details = null) {
    const key = String(name || '')
    if (!key) return 0
    const next = (this.counters.get(key) || 0) + finiteNumber(amount, 1)
    this.counters.set(key, next)
    if (details && typeof details === 'object') {
      this.lastEvents.set(key, {
        at: new Date(this.now()).toISOString(),
        code: details.code ? String(details.code).slice(0, 120) : undefined,
        backend: details.backend ? String(details.backend).slice(0, 80) : undefined,
        outcome: details.outcome ? String(details.outcome).slice(0, 80) : undefined,
      })
    }
    return next
  }

  gauge(name, value) {
    const key = String(name || '')
    if (!key) return 0
    const next = finiteNumber(value)
    this.gauges.set(key, next)
    return next
  }

  observe(name, value) {
    const key = String(name || '')
    if (!key) return
    const sample = Math.max(0, finiteNumber(value))
    const values = this.histograms.get(key) || []
    values.push(sample)
    if (values.length > this.histogramLimit) values.splice(0, values.length - this.histogramLimit)
    this.histograms.set(key, values)
  }

  snapshot(extraGauges = {}) {
    for (const [key, value] of Object.entries(extraGauges || {})) this.gauge(key, value)
    const histograms = {}
    for (const [key, values] of this.histograms.entries()) {
      histograms[key] = {
        count: values.length,
        max: values.length ? Math.max(...values) : 0,
        p50: percentile(values, 0.5),
        p95: percentile(values, 0.95),
      }
    }
    return {
      version: 1,
      at: new Date(this.now()).toISOString(),
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms,
      lastEvents: Object.fromEntries(this.lastEvents),
    }
  }
}

function createAgentRuntimeMetrics(opts = {}) {
  return new AgentRuntimeMetrics(opts)
}

module.exports = {
  AgentRuntimeMetrics,
  createAgentRuntimeMetrics,
  DEFAULT_HISTOGRAM_LIMIT,
}

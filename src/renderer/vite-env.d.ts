/// <reference types="vite/client" />

interface KnowmePerf {
  uiThrottle?: boolean
  liveNowIntervalMs?: number
  runTelemetryIntervalMs?: number
}

interface Window {
  knowme?: {
    perf?: KnowmePerf
    [key: string]: unknown
  }
}

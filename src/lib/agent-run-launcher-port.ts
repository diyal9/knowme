'use strict'

/**
 * Launcher → RunManager 端口：登记子 run、总线消息、等待终态。
 */

const { RunPhase } = require('./agent-run-ports')
const {
  BACKEND_LOCAL,
  BUS_VERSION,
  createMessageId,
  isTerminalStatus,
  validateHandoffPayload,
} = require('./agent-run-launcher-shared')
const { mapTerminalToStatus } = require('./agent-run-launcher-adapters')

function createLauncherRunManagerPort(launcher, opts = {}) {
  if (!launcher) throw new Error('createLauncherRunManagerPort requires launcher')

  const runs = opts.runs || new Map()
  const busMessages = opts.busMessages || new Map()
  const waiters = new Map()

  const notifyWaiters = (runId, record) => {
    const list = waiters.get(runId) || []
    waiters.delete(runId)
    for (const w of list) {
      clearTimeout(w.timer)
      w.resolve(record)
    }
  }

  const getRunRecord = (runId) => {
    const id = String(runId || '')
    return runs.get(id) || null
  }

  const buildStatusResponse = (record) => {
    if (!record) return { ok: false, code: 'not_found', message: '子 Run 不存在' }
    const durationMs = (record.endedAt || Date.now()) - (record.startedAt || Date.now())
    return {
      ok: true,
      runId: record.runId,
      status: record.status,
      phase: record.phase || record.terminal || 'PREPARE',
      terminal: record.terminal || null,
      stopReason: record.stopReason || null,
      durationMs,
      expertId: record.expertId,
      builderId: record.backend,
      summary: record.summary || record.text || '',
    }
  }

  return {
    runs,
    busMessages,

    async createAndLaunchChild(spec = {}) {
      const handoffCheck = validateHandoffPayload(spec.handoff)
      if (!handoffCheck.ok) return handoffCheck

      const runId = String(spec.runId || spec.subRunId || '')
      const parentRunId = String(spec.parentRunId || '')
      if (!runId) return { ok: false, code: 'invalid_args', text: '缺少 runId' }

      const backend = spec.backend || launcher.defaultBackend || BACKEND_LOCAL
      const record = {
        runId,
        parentRunId,
        rootRunId: spec.rootRunId || parentRunId,
        expertId: spec.expertId,
        status: 'pending',
        phase: RunPhase.PREPARE,
        backend,
        handoff: spec.handoff,
        startedAt: Date.now(),
        prompt: spec.prompt,
      }
      runs.set(runId, record)

      try {
        await launcher.launch({
          ...spec,
          runId,
          backend,
        }, {
          signal: spec.parentSignal,
          emit: spec.onEmit,
          onTerminal: (info) => {
            record.status = mapTerminalToStatus(info.terminal)
            record.phase = info.terminal
            record.terminal = info.terminal
            record.endedAt = Date.now()
            record.summary = info.text
            record.text = info.text
            record.report = info.report
            record.stopReason = info.error || null
            notifyWaiters(runId, buildStatusResponse(record))
            spec.onTerminal?.(info)
          },
        })
        if (!isTerminalStatus(record.status)) {
          record.status = 'running'
          record.phase = RunPhase.PREPARE
        }
        return {
          ok: true,
          launched: true,
          subRunId: runId,
          runId,
          status: 'running',
          text: `子 Run ${runId} 已启动`,
          meta: { subRunId: runId, expertId: spec.expertId, backend },
        }
      } catch (err) {
        record.status = 'failed'
        record.phase = RunPhase.ERROR
        record.terminal = RunPhase.ERROR
        record.endedAt = Date.now()
        record.stopReason = String(err?.message || err)
        notifyWaiters(runId, buildStatusResponse(record))
        return {
          ok: false,
          code: err.code || 'launch_failed',
          text: String(err?.message || err).slice(0, 500),
          meta: { subRunId: runId },
        }
      }
    },

    getRunStatus(runId) {
      const record = getRunRecord(runId)
      if (record) return buildStatusResponse(record)
      return launcher.getStatus(runId)
    },

    async awaitRun(runId, timeoutMs = 60000) {
      const id = String(runId || '')
      const existing = getRunRecord(id)
      if (existing && isTerminalStatus(existing.status)) {
        return { ok: true, ...buildStatusResponse(existing) }
      }

      const deadline = Math.max(1000, Number(timeoutMs) || 60000)
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          const list = waiters.get(id) || []
          waiters.set(id, list.filter((w) => w.timer !== timer))
          resolve({
            ok: false,
            code: 'subrun_timeout',
            text: `子 Run ${id} 在 ${deadline}ms 内未达终态`,
            runId: id,
          })
        }, deadline)

        const list = waiters.get(id) || []
        list.push({
          timer,
          resolve: (record) => {
            resolve({ ok: true, ...record })
          },
        })
        waiters.set(id, list)

        const latest = getRunRecord(id)
        if (latest && isTerminalStatus(latest.status)) {
          clearTimeout(timer)
          waiters.set(id, list.filter((w) => w.timer !== timer))
          resolve({ ok: true, ...buildStatusResponse(latest) })
        }
      })
    },

    async cancelRun(runId, reason) {
      const id = String(runId || '')
      const record = getRunRecord(id)
      const result = await launcher.cancel(id, reason)
      if (record) {
        record.status = 'cancelled'
        record.phase = RunPhase.CANCELLED
        record.terminal = RunPhase.CANCELLED
        record.endedAt = Date.now()
        record.stopReason = reason || 'cancelled'
        notifyWaiters(id, buildStatusResponse(record))
      }
      return { ok: result.ok !== false, ...result, runId: id }
    },

    async cancelAllChildren(parentRunId, reason) {
      return launcher.cancelAllForParent(parentRunId, reason)
    },

    sendMessage(msg = {}) {
      const protocolVersion = msg.protocolVersion ?? msg.busVersion ?? BUS_VERSION
      if (protocolVersion !== BUS_VERSION) {
        return { ok: false, code: 'protocol_unsupported', text: `不支持的 bus 协议版本: ${protocolVersion}` }
      }

      const payload = msg.payload || {}
      const payloadCheck = validateHandoffPayload(payload)
      if (!payloadCheck.ok && (msg.kind === 'handoff' || msg.type === 'handoff.request')) {
        return payloadCheck
      }

      const envelope = {
        busVersion: BUS_VERSION,
        version: BUS_VERSION,
        messageId: msg.messageId || createMessageId(),
        correlationId: msg.correlationId || null,
        runId: msg.runId || msg.sourceRunId,
        sourceRunId: msg.sourceRunId || msg.runId,
        targetRunId: msg.targetRunId,
        parentRunId: msg.parentRunId || null,
        kind: msg.kind || msg.type || 'status',
        schemaRef: msg.schemaRef || null,
        payload,
        ts: new Date().toISOString(),
        idempotencyKey: msg.idempotencyKey || null,
      }

      const target = String(envelope.targetRunId || envelope.runId || '')
      const list = busMessages.get(target) || []
      list.push(envelope)
      busMessages.set(target, list)

      return { ok: true, envelope }
    },

    getMessages(runId) {
      return busMessages.get(String(runId || '')) || []
    },
  }
}

module.exports = {
  createLauncherRunManagerPort,
}

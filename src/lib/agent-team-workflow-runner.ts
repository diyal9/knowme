'use strict'

const {
  validateTeamPackage,
  validateAgentPackage,
  mapToBackend,
} = require('./agent-package-runtime')
const { validateHandoffPayload } = require('./agent-run-launcher')

const NODE_PENDING = 'pending'
const NODE_RUNNING = 'running'
const NODE_COMPLETED = 'completed'
const NODE_FAILED = 'failed'
const NODE_BLOCKED = 'blocked'

function asManifest(value) {
  if (value?.manifest) return value.manifest
  return value
}

function terminalSucceeded(status = {}) {
  return status.ok === true && ['done', 'completed'].includes(String(status.status || status.terminal || '').toLowerCase())
}

function boundedSummary(value) {
  return String(value || '').trim().slice(0, 4000)
}

function uniqueRefs(values) {
  const seen = new Set()
  const result = []
  for (const value of values.flat().filter(Boolean)) {
    const key = typeof value === 'string' ? value : value.id || value.digest || JSON.stringify(value)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(value)
    if (result.length >= 32) break
  }
  return result
}

class AgentTeamWorkflowRunner {
  constructor(opts = {}) {
    if (!opts.runManager) throw new Error('AgentTeamWorkflowRunner requires runManager')
    this.runManager = opts.runManager
    this.resolveAgentPackage = typeof opts.resolveAgentPackage === 'function'
      ? opts.resolveAgentPackage
      : () => null
    this.resolveAgentProfile = typeof opts.resolveAgentProfile === 'function'
      ? opts.resolveAgentProfile
      : () => null
    this.requestGateDecision = typeof opts.requestGateDecision === 'function'
      ? opts.requestGateDecision
      : async () => ({ approved: false, reason: 'approval_handler_missing' })
    this.emit = typeof opts.emit === 'function' ? opts.emit : () => {}
    this.defaultTimeoutMs = Number.isFinite(opts.defaultTimeoutMs) ? opts.defaultTimeoutMs : 10 * 60 * 1000
    this.specialtyHandlers = opts.specialtyHandlers && typeof opts.specialtyHandlers === 'object'
      ? opts.specialtyHandlers
      : {}
  }

  _resolvePackage(packageId, profileId = '') {
    const raw = this.resolveAgentPackage(packageId, profileId)
    if (!raw) return { ok: false, code: 'unresolved_member', message: `Agent Package 不存在: ${packageId}` }
    if (raw.ok === false) return raw
    const candidate = asManifest(raw)
    const validated = candidate?.schemaVersion ? validateAgentPackage(candidate) : raw
    if (!validated?.ok) return validated || { ok: false, code: 'invalid_package' }
    return validated
  }

  _validateTeam(teamPackage) {
    const raw = asManifest(teamPackage)
    return validateTeamPackage(raw, {
      resolveAgentPackage: (id) => this._resolvePackage(id),
    })
  }

  _dependencies(workflow) {
    const incoming = new Map(workflow.nodes.map(node => [node.id, []]))
    const outgoing = new Map(workflow.nodes.map(node => [node.id, []]))
    const edgeIndex = new Map()
    for (const edge of workflow.edges || []) {
      incoming.get(edge.to)?.push(edge.from)
      outgoing.get(edge.from)?.push(edge.to)
      edgeIndex.set(`${edge.from}->${edge.to}`, edge)
    }
    return { incoming, outgoing, edgeIndex }
  }

  _depsSatisfied(nodeId, incoming, edgeIndex, nodeStates, nodeResults) {
    return (incoming.get(nodeId) || []).every(dep => {
      if (nodeStates.get(dep) !== NODE_COMPLETED) return false
      const edge = edgeIndex.get(`${dep}->${nodeId}`)
      const branch = edge?.branch
      if (!branch) return true
      const result = nodeResults.get(dep)
      return String(result?.branch || '') === String(branch)
    })
  }

  _evaluateCondition(node, incoming, nodeResults, input) {
    const cfg = node.condition && typeof node.condition === 'object' ? node.condition : {}
    const leftKey = String(cfg.left || 'input').trim() || 'input'
    const compare = String(cfg.compare || 'equal').trim() || 'equal'
    const right = String(cfg.right ?? '').trim()

    let leftValue = ''
    if (leftKey === 'input' || leftKey.startsWith('input.')) {
      const path = leftKey === 'input' ? '' : leftKey.slice('input.'.length)
      let cursor = input
      if (!path) leftValue = typeof input === 'string' ? input : JSON.stringify(input ?? '')
      else {
        for (const part of path.split('.').filter(Boolean)) cursor = cursor?.[part]
        leftValue = cursor == null ? '' : String(cursor)
      }
    } else {
      const preds = incoming.get(node.id) || []
      for (const pred of preds) {
        const result = nodeResults.get(pred)
        if (result?.summary && leftKey === 'summary') {
          leftValue = String(result.summary)
          break
        }
      }
      if (!leftValue && preds.length) leftValue = String(nodeResults.get(preds[0])?.summary || '')
    }

    let matched = false
    if (compare === 'not_equal') matched = leftValue !== right
    else if (compare === 'blank') matched = !String(leftValue).trim()
    else if (compare === 'contains') matched = String(leftValue).includes(right)
    else matched = leftValue === right

    return {
      ok: true,
      status: NODE_COMPLETED,
      nodeId: node.id,
      branch: matched ? 'true' : 'false',
      summary: `条件${matched ? '成立' : '不成立'}: ${leftKey} ${compare} ${right}`,
      artifactRefs: [],
      evidenceRefs: [],
    }
  }

  _collectHandoff(nodeId, incoming, nodeResults, input) {
    const predecessorResults = (incoming.get(nodeId) || []).map(id => {
      const result = nodeResults.get(id) || {}
      return {
        nodeId: id,
        status: result.status,
        summary: boundedSummary(result.summary),
        artifactRefs: result.artifactRefs || [],
        evidenceRefs: result.evidenceRefs || [],
      }
    })
    const handoff = { input, predecessorResults }
    const check = validateHandoffPayload(handoff)
    return check.ok ? { ok: true, handoff } : check
  }

  async _runAgentNode({ rootRunId, node, incoming, nodeResults, input, timeoutMs, runAttempt }) {
    const packageResult = this._resolvePackage(node.agentPackageId, node.profileId)
    if (!packageResult.ok) return packageResult
    const manifest = packageResult.manifest
    const profileResult = node.profileId ? this.resolveAgentProfile(node.profileId) : null
    const profile = profileResult?.ok ? profileResult.profile : null
    const handoffResult = this._collectHandoff(node.id, incoming, nodeResults, input)
    if (!handoffResult.ok) return handoffResult
    const requestedBackend = mapToBackend(manifest)
    const backendHealth = this.runManager.launcher?.probeHealth?.(requestedBackend)
    const backend = backendHealth?.ok === false && manifest.compatibility?.fallbackLocal === true
      ? 'local-executor'
      : requestedBackend

    const created = this.runManager.createChildRun(rootRunId, {
      expertId: manifest.packageId,
      agentPackageId: manifest.packageId,
      packageRef: `${manifest.packageId}@${manifest.version}`,
      packageSnapshotHash: packageResult.contentHash,
      backend,
      builderId: manifest.builder,
      prompt: [
        profile?.roleOverlay || node.role || '',
        profile?.promptOverlay || '',
        node.intent || `执行 Team Workflow 节点 ${node.id}`,
      ].filter(Boolean).join('\n\n'),
      handoff: handoffResult.handoff,
      permissions: profile?.permissions,
      budget: profile?.budget,
      profileId: profile?.id || node.profileId || '',
      profileSnapshot: profile ? {
        profileId: profile.id,
        profileVersion: profile.version,
        profileHash: profile.profileHash,
        roleOverlay: profile.roleOverlay,
        promptOverlay: profile.promptOverlay,
        skillRefs: profile.skillRefs,
        knowledgeRefs: profile.knowledgeRefs,
        knowledgePolicy: profile.knowledgePolicy,
        connectorRefs: profile.connectorRefs,
        permissions: profile.permissions,
        memoryPolicy: profile.memoryPolicy,
        modelPolicy: profile.modelPolicy,
        outputContract: profile.outputContract,
        budget: profile.budget,
      } : null,
      idempotencyKey: `${rootRunId}:${node.id}:${runAttempt}`,
      meta: {
        workflowNodeId: node.id,
        expertId: manifest.packageId,
        builderId: manifest.builder,
        backend,
        profileId: profile?.id || node.profileId || '',
        skillRefs: profile?.skillRefs || [],
        knowledgeRefs: profile?.knowledgeRefs || [],
        knowledgePolicy: profile?.knowledgePolicy || {},
        connectorRefs: profile?.connectorRefs || [],
      },
    })
    if (!created.ok) return created

    this.emit({
      type: 'team.node.started',
      rootRunId,
      nodeId: node.id,
      runId: created.runId,
      packageId: manifest.packageId,
      builder: manifest.builder,
    })

    const terminal = await this.runManager.awaitRun(created.runId, timeoutMs)
    const runHit = this.runManager.getRun(created.runId)
    const run = runHit.ok ? runHit.run : {}
    const result = {
      ok: terminalSucceeded(terminal),
      code: terminal.ok === false ? terminal.code : (terminalSucceeded(terminal) ? null : 'child_failed'),
      nodeId: node.id,
      runId: created.runId,
      status: terminalSucceeded(terminal) ? NODE_COMPLETED : NODE_FAILED,
      terminal: terminal.terminal || terminal.status,
      summary: boundedSummary(terminal.summary || run.meta?.summary || terminal.stopReason),
      artifactRefs: uniqueRefs([run.artifactRefs || []]),
      evidenceRefs: uniqueRefs([run.evidenceRefs || []]),
      metrics: terminal.metrics || run.meta?.metrics || {},
      builder: manifest.builder,
      packageId: manifest.packageId,
      stopReason: terminal.stopReason || null,
    }
    this.emit({
      type: result.ok ? 'team.node.completed' : 'team.node.failed',
      rootRunId,
      ...result,
    })
    return result
  }

  _upstreamText(nodeId, incoming, nodeResults, input) {
    const preds = incoming.get(nodeId) || []
    const parts = []
    for (const pred of preds) {
      const result = nodeResults.get(pred)
      if (result?.summary) parts.push(String(result.summary))
    }
    if (parts.length) return parts.join('\n\n').slice(0, 12000)
    if (typeof input === 'string') return input
    if (input && typeof input === 'object') {
      if (input.text) return String(input.text)
      if (input.prompt) return String(input.prompt)
      try { return JSON.stringify(input).slice(0, 8000) } catch { return '' }
    }
    return ''
  }

  _applyPromptTemplate(prompt, upstream) {
    const base = String(prompt || '').trim()
    if (!base) return upstream || ''
    if (base.includes('{{input}}')) return base.split('{{input}}').join(upstream || '')
    if (!upstream) return base
    return `${base}\n\n${upstream}`
  }

  async _runSpecialtyNode({ rootRunId, node, incoming, nodeResults, input }) {
    const type = String(node.type || '')
    const handler = this.specialtyHandlers[type]
    const upstream = this._upstreamText(node.id, incoming, nodeResults, input)
    this.emit({ type: 'team.node.started', rootRunId, nodeId: node.id, specialty: type })
    if (typeof handler !== 'function') {
      const result = {
        ok: false,
        code: 'specialty_handler_missing',
        message: `未配置 ${type} 执行器`,
        nodeId: node.id,
        status: NODE_FAILED,
        summary: `未配置 ${type} 执行器`,
        artifactRefs: [],
        evidenceRefs: [],
      }
      this.emit({ type: 'team.node.failed', rootRunId, ...result })
      return result
    }
    try {
      const raw = await handler({
        node,
        config: node.config || {},
        upstream,
        input,
        rootRunId,
        prompt: this._applyPromptTemplate(node.config?.prompt || node.intent || '', upstream),
      })
      const okResult = raw && raw.ok !== false
      const result = {
        ok: okResult,
        code: okResult ? null : (raw?.code || 'specialty_failed'),
        message: okResult ? null : (raw?.message || raw?.error || `${type} 执行失败`),
        nodeId: node.id,
        status: okResult ? NODE_COMPLETED : NODE_FAILED,
        summary: boundedSummary(raw?.summary || raw?.text || (okResult ? `${type} completed` : `${type} failed`)),
        artifactRefs: uniqueRefs([raw?.artifactRefs || []]),
        evidenceRefs: uniqueRefs([raw?.evidenceRefs || []]),
        metrics: raw?.metrics || {},
        stopReason: raw?.stopReason || null,
      }
      this.emit({ type: result.ok ? 'team.node.completed' : 'team.node.failed', rootRunId, ...result })
      return result
    } catch (err) {
      const result = {
        ok: false,
        code: 'specialty_failed',
        message: err?.message || String(err),
        nodeId: node.id,
        status: NODE_FAILED,
        summary: boundedSummary(err?.message || `${type} failed`),
        artifactRefs: [],
        evidenceRefs: [],
      }
      this.emit({ type: 'team.node.failed', rootRunId, ...result })
      return result
    }
  }

  async _runGateNode({ rootRunId, node, team, gateAttempts }) {
    const gate = team.gates.find(item => item.id === node.gateRef)
    if (!gate) {
      return { ok: false, code: 'gate_missing', status: NODE_FAILED, nodeId: node.id }
    }
    this.emit({ type: 'team.gate.waiting', rootRunId, nodeId: node.id, gate })
    const decision = await this.requestGateDecision({
      rootRunId,
      node,
      gate,
      attempt: (gateAttempts.get(node.id) || 0) + 1,
    })
    if (decision?.approved === true) {
      this.emit({ type: 'team.gate.approved', rootRunId, nodeId: node.id, gateId: gate.id })
      return { ok: true, status: NODE_COMPLETED, nodeId: node.id, summary: 'gate approved' }
    }

    const rollback = gate.params?.onReject
    const attempts = gateAttempts.get(node.id) || 0
    const maxAttempts = Math.max(0, Number(rollback?.maxAttempts) || 0)
    if (rollback?.action === 'rollback' && rollback.targetNodeId && attempts < maxAttempts) {
      gateAttempts.set(node.id, attempts + 1)
      this.emit({
        type: 'team.gate.rollback',
        rootRunId,
        nodeId: node.id,
        gateId: gate.id,
        targetNodeId: rollback.targetNodeId,
        reason: decision?.reason || 'gate_rejected',
      })
      return {
        ok: false,
        rollback: true,
        targetNodeId: String(rollback.targetNodeId),
        status: NODE_BLOCKED,
        nodeId: node.id,
      }
    }
    return {
      ok: false,
      code: 'gate_rejected',
      status: NODE_FAILED,
      nodeId: node.id,
      stopReason: decision?.reason || 'gate_rejected',
    }
  }

  _resetRollbackPath(targetNodeId, gateNodeId, outgoing, nodeStates, nodeResults) {
    const queue = [targetNodeId]
    const visited = new Set()
    while (queue.length) {
      const current = queue.shift()
      if (visited.has(current)) continue
      visited.add(current)
      nodeStates.set(current, NODE_PENDING)
      nodeResults.delete(current)
      if (current === gateNodeId) continue
      for (const next of outgoing.get(current) || []) queue.push(next)
    }
    nodeStates.set(gateNodeId, NODE_PENDING)
    nodeResults.delete(gateNodeId)
  }

  async run(teamPackage, input = {}, opts = {}) {
    const validated = this._validateTeam(teamPackage)
    if (!validated.ok) return validated
    const team = validated.manifest
    const workflow = team.workflow
    const rootRunId = String(opts.rootRunId || '')
    if (!rootRunId) return { ok: false, code: 'missing_root_run_id', message: 'Team Workflow 缺少 rootRunId' }

    const adopted = this.runManager.adoptRunningRun({
      runId: rootRunId,
      packageRef: `${team.packageId}@${team.version}`,
      joinStrategy: workflow.joinStrategy,
      governanceEnvelope: opts.governanceEnvelope || {},
      budget: opts.budget || {},
      meta: { teamPackageId: team.packageId, workflowVersion: team.version },
    })
    if (!adopted.ok) return adopted

    const { incoming, outgoing, edgeIndex } = this._dependencies(workflow)
    const nodeStates = new Map(workflow.nodes.map(node => [node.id, NODE_PENDING]))
    const nodeResults = new Map()
    const gateAttempts = new Map()
    const runAttempts = new Map()
    const parallelism = Math.max(1, Number(workflow.parallelism) || 1)
    const timeoutMs = Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : this.defaultTimeoutMs
    let failed = null

    while (!failed) {
      const unfinished = workflow.nodes.filter(node => nodeStates.get(node.id) === NODE_PENDING)
      if (!unfinished.length) break
      const ready = unfinished.filter(node =>
        this._depsSatisfied(node.id, incoming, edgeIndex, nodeStates, nodeResults))
      if (!ready.length) {
        // nodes only on unselected condition branches become unreachable — complete them as skipped
        const blockedByBranch = unfinished.filter(node => {
          const deps = incoming.get(node.id) || []
          return deps.length && deps.every(dep => nodeStates.get(dep) === NODE_COMPLETED)
            && !this._depsSatisfied(node.id, incoming, edgeIndex, nodeStates, nodeResults)
        })
        if (blockedByBranch.length === unfinished.length) {
          for (const node of blockedByBranch) {
            nodeStates.set(node.id, NODE_COMPLETED)
            nodeResults.set(node.id, {
              ok: true,
              skipped: true,
              status: NODE_COMPLETED,
              nodeId: node.id,
              summary: 'condition branch skipped',
              artifactRefs: [],
              evidenceRefs: [],
            })
          }
          continue
        }
        failed = { ok: false, code: 'workflow_deadlock', message: 'Team Workflow 无可执行节点' }
        break
      }

      const agentBatch = ready.filter(node => node.type === 'agent').slice(0, parallelism)
      if (agentBatch.length) {
        for (const node of agentBatch) nodeStates.set(node.id, NODE_RUNNING)
        const results = await Promise.all(agentBatch.map(node => {
          const attempt = (runAttempts.get(node.id) || 0) + 1
          runAttempts.set(node.id, attempt)
          return this._runAgentNode({
            rootRunId,
            node,
            incoming,
            nodeResults,
            input,
            timeoutMs,
            runAttempt: attempt,
          })
        }))
        for (let index = 0; index < agentBatch.length; index += 1) {
          const node = agentBatch[index]
          const result = results[index]
          nodeResults.set(node.id, result)
          nodeStates.set(node.id, result.ok ? NODE_COMPLETED : NODE_FAILED)
          if (!result.ok && workflow.joinStrategy !== 'partial') {
            failed = result
            break
          }
        }
        continue
      }

      const specialtyBatch = ready
        .filter(node => node.type === 'llm' || node.type === 'tool' || node.type === 'knowledge')
        .slice(0, parallelism)
      if (specialtyBatch.length) {
        for (const node of specialtyBatch) nodeStates.set(node.id, NODE_RUNNING)
        const results = await Promise.all(specialtyBatch.map(node => this._runSpecialtyNode({
          rootRunId,
          node,
          incoming,
          nodeResults,
          input,
        })))
        for (let index = 0; index < specialtyBatch.length; index += 1) {
          const node = specialtyBatch[index]
          const result = results[index]
          nodeResults.set(node.id, result)
          nodeStates.set(node.id, result.ok ? NODE_COMPLETED : NODE_FAILED)
          if (!result.ok && workflow.joinStrategy !== 'partial') {
            failed = result
            break
          }
        }
        continue
      }

      const node = ready[0]
      if (node.type === 'condition') {
        nodeStates.set(node.id, NODE_RUNNING)
        const result = this._evaluateCondition(node, incoming, nodeResults, input)
        nodeResults.set(node.id, result)
        nodeStates.set(node.id, NODE_COMPLETED)
        this.emit({ type: 'team.condition.completed', rootRunId, ...result })
        continue
      }
      if (node.type === 'gate') {
        nodeStates.set(node.id, NODE_RUNNING)
        const gateResult = await this._runGateNode({ rootRunId, node, team, gateAttempts })
        if (gateResult.rollback) {
          this._resetRollbackPath(gateResult.targetNodeId, node.id, outgoing, nodeStates, nodeResults)
        } else {
          nodeResults.set(node.id, gateResult)
          nodeStates.set(node.id, gateResult.ok ? NODE_COMPLETED : NODE_FAILED)
          if (!gateResult.ok) failed = gateResult
        }
        continue
      }

      if (node.type === 'join' || node.type === 'terminal') {
        const result = {
          ok: true,
          nodeId: node.id,
          status: NODE_COMPLETED,
          summary: node.type === 'join' ? `join ${node.joinStrategy || workflow.joinStrategy}` : 'workflow completed',
          artifactRefs: uniqueRefs((incoming.get(node.id) || []).map(id => nodeResults.get(id)?.artifactRefs || [])),
          evidenceRefs: uniqueRefs((incoming.get(node.id) || []).map(id => nodeResults.get(id)?.evidenceRefs || [])),
        }
        nodeResults.set(node.id, result)
        nodeStates.set(node.id, NODE_COMPLETED)
        this.emit({ type: `team.${node.type}.completed`, rootRunId, ...result })
        continue
      }

      failed = { ok: false, code: 'unsupported_node_type', message: `不支持节点类型: ${node.type}` }
    }

    const results = Object.fromEntries(nodeResults)
    const artifacts = uniqueRefs([...nodeResults.values()].map(item => item.artifactRefs || []))
    const evidence = uniqueRefs([...nodeResults.values()].map(item => item.evidenceRefs || []))
    if (failed) {
      this.runManager.completeAdoptedRun(rootRunId, {
        terminal: 'failed',
        status: 'failed',
        summary: failed.message || failed.stopReason || failed.code,
        stopReason: failed.stopReason || failed.code,
        artifactRefs: artifacts,
        evidenceRefs: evidence,
      })
      return { ...failed, rootRunId, nodeStates: Object.fromEntries(nodeStates), results }
    }

    const summary = boundedSummary(
      [...nodeResults.values()].reverse().find(item => item.summary)?.summary || 'Team Workflow completed',
    )
    this.runManager.completeAdoptedRun(rootRunId, {
      terminal: 'completed',
      status: 'completed',
      summary,
      artifactRefs: artifacts,
      evidenceRefs: evidence,
      metrics: {
        workflowNodes: workflow.nodes.length,
        gateRollbacks: [...gateAttempts.values()].reduce((sum, count) => sum + count, 0),
      },
    })
    return {
      ok: true,
      rootRunId,
      status: 'completed',
      summary,
      nodeStates: Object.fromEntries(nodeStates),
      results,
      artifactRefs: artifacts,
      evidenceRefs: evidence,
      gateRollbacks: [...gateAttempts.values()].reduce((sum, count) => sum + count, 0),
    }
  }
}

module.exports = {
  AgentTeamWorkflowRunner,
  NODE_PENDING,
  NODE_RUNNING,
  NODE_COMPLETED,
  NODE_FAILED,
  NODE_BLOCKED,
  terminalSucceeded,
}

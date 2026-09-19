'use strict'

const { MY_KNOWME_PROFILE_ID } = require('../lib/personal-agent')

/** Unified Local Brain IPC. Renderer receives DTOs, never storage paths. */
function registerBrainIpc(ipcMain, deps) {
  const {
    app,
    MEMORY_DIR,
    brainService,
    buildFabricCtx,
    listRegistryProviders,
    knowledgeProvider,
    knowledgeOs,
    productMemory,
    getAgentProfileStore,
    ensureCapabilityHub,
    loadSettings,
  } = deps

  const mergeEffects = (effects = []) => effects.reduce((patch, effect) => {
    if (!effect || typeof effect !== 'object') return patch
    const value = effect.patch || effect.value || (effect.op ? null : effect)
    return value && typeof value === 'object' ? { ...patch, ...value } : patch
  }, {})

  const applyPartnerGrowth = async (proposal) => {
    if (typeof getAgentProfileStore !== 'function') return { ok: false, error: '伙伴 Profile 服务不可用' }
    const profileStore = getAgentProfileStore()
    const current = profileStore.get(MY_KNOWME_PROFILE_ID)
    if (!current?.ok) return current
    const patch = mergeEffects(proposal.effects)
    const saved = profileStore.save({ ...current.profile, ...patch, id: MY_KNOWME_PROFILE_ID }, { confirmedRisk: true })
    if (!saved?.ok) return saved
    return { ok: true, profile: saved.profile, reverseEffects: [{ op: 'restore_profile', value: current.profile }] }
  }

  const undoPartnerGrowth = async (event) => {
    const restore = (event.reverseEffects || []).find(effect => effect.op === 'restore_profile')
    if (!restore?.value || typeof getAgentProfileStore !== 'function') return { ok: false, error: '缺少可恢复的伙伴设置' }
    return getAgentProfileStore().save(restore.value, { confirmedRisk: true })
  }

  const applyCapabilityOperations = async (effects = []) => {
    if (typeof ensureCapabilityHub !== 'function') return { ok: false, error: '能力中心服务不可用' }
    const hub = ensureCapabilityHub()
    const reverseEffects = []
    const applied = []
    for (const effect of effects) {
      const op = String(effect?.op || '')
      const id = String(effect?.id || effect?.capabilityId || '')
      if (!id) return { ok: false, error: '能力成长缺少能力 ID' }
      const listed = await hub.listCapabilities({})
      const previous = (listed?.items || []).find(item => item.id === id)
      let result
      if (op === 'capability_enable') result = await hub.enableCapability({ id, riskConfirmed: true })
      else if (op === 'capability_disable') result = await hub.disableCapability({ id })
      else if (op === 'capability_install') result = await hub.installCapability({ id, enabled: effect.enabled !== false, riskConfirmed: true })
      else return { ok: false, error: `不支持的能力成长操作：${op || '未指定'}` }
      if (result?.ok === false) return result
      applied.push(result)
      if (!previous && op === 'capability_install') reverseEffects.unshift({ op: 'capability_uninstall', id })
      else if (previous?.enabled === false) reverseEffects.unshift({ op: 'capability_disable', id })
      else reverseEffects.unshift({ op: 'capability_enable', id })
    }
    return { ok: true, applied, reverseEffects }
  }

  const undoCapabilityGrowth = async (event) => {
    if (typeof ensureCapabilityHub !== 'function') return { ok: false, error: '能力中心服务不可用' }
    const hub = ensureCapabilityHub()
    for (const effect of event.reverseEffects || []) {
      const result = effect.op === 'capability_uninstall'
        ? await hub.uninstallCapability({ id: effect.id })
        : effect.op === 'capability_disable'
          ? await hub.disableCapability({ id: effect.id })
          : await hub.enableCapability({ id: effect.id, riskConfirmed: true })
      if (result?.ok === false) return result
    }
    return { ok: true }
  }

  const context = () => {
    const providers = listRegistryProviders()
    let settings: { industry?: string; occupationId?: string } = {}
    try { settings = typeof loadSettings === 'function' ? (loadSettings() || {}) : {} } catch { /* use the generic role scaffold */ }
    return {
      ...buildFabricCtx(),
      brainV1: knowledgeOs.loadConfig(app.getPath('userData')).brainV1 !== false,
      memoryDir: MEMORY_DIR,
      providers,
      brainProfile: {
        industry: settings.industry,
        occupationId: settings.occupationId,
      },
      reviewMemoryPattern: (id, action, summary) => productMemory.reviewPattern(
        MEMORY_DIR,
        String(id || ''),
        action,
        summary
      ),
      listCollections: (provider) => knowledgeProvider.listCollections(
        providers.find(item => item.id === provider.id) || provider
      ),
      applyPartnerGrowth,
      undoPartnerGrowth,
      applyCapabilityGrowth: proposal => applyCapabilityOperations(proposal.effects),
      undoCapabilityGrowth,
    }
  }

  const userData = () => app.getPath('userData')
  const safe = (fallback, fn) => {
    try { return fn() } catch (error) { return { ...fallback, ok: false, error: error.message || String(error) } }
  }

  ipcMain.handle('brain-snapshot', (_event, options = {}) => safe({ nodes: [], claims: [], proposals: [] }, () => (
    brainService.snapshot(userData(), options, context())
  )))
  ipcMain.handle('brain-neighborhood', (_event, payload = {}) => safe({ nodes: [], claims: [] }, () => (
    brainService.getNeighborhood(userData(), payload.nodeId || 'self:me', payload, context())
  )))
  ipcMain.handle('brain-query', async (_event, request = {}) => {
    try { return await brainService.query(userData(), request, context()) }
    catch (error) { return { ok: false, hits: [], error: error.message || String(error) } }
  })
  ipcMain.handle('brain-node-get', (_event, nodeId) => safe({}, () => brainService.getNode(userData(), nodeId, context())))
  ipcMain.handle('brain-explain', (_event, ref) => safe({}, () => brainService.explain(userData(), ref, context())))
  ipcMain.handle('brain-path', (_event, payload = {}) => safe({ nodeIds: [], claimIds: [] }, () => (
    brainService.findPath(userData(), payload.fromId, payload.toId, payload, context())
  )))
  ipcMain.handle('brain-proposal-list', (_event, options = {}) => safe({ proposals: [] }, () => {
    const snapshot = brainService.snapshot(userData(), { includeResolved: options.includeResolved === true }, context())
    return { ok: true, proposals: snapshot.proposals }
  }))
  ipcMain.handle('brain-proposal-create', (_event, payload = {}) => safe({}, () => brainService.propose(userData(), payload)))
  ipcMain.handle('brain-observe', (_event, payload = {}) => safe({ proposals: [] }, () => (
    brainService.observeConversation(userData(), payload, context())
  )))
  ipcMain.handle('brain-reference-save', (_event, payload = {}) => safe({}, () => brainService.saveReference(userData(), payload)))
  ipcMain.handle('brain-proposal-confirm', async (_event, payload = {}) => {
    try { return await brainService.confirm(userData(), payload.id, payload.patch || {}, context()) }
    catch (error) { return { ok: false, error: error.message || String(error) } }
  })
  ipcMain.handle('brain-proposal-reject', (_event, id) => safe({}, () => brainService.reject(userData(), id, context())))
  ipcMain.handle('brain-proposal-snooze', (_event, id) => safe({}, () => brainService.snooze(userData(), id)))
  ipcMain.handle('brain-forget', (_event, id) => safe({}, () => brainService.forget(userData(), id)))
  ipcMain.handle('brain-rebuild', () => safe({ nodes: [], claims: [] }, () => brainService.rebuild(userData(), context())))
  ipcMain.handle('brain-provider-sync', async (_event, providerId) => {
    try { return await brainService.syncProvider(userData(), providerId, context()) }
    catch (error) { return { ok: false, error: error.message || String(error) } }
  })
  ipcMain.handle('brain-layout-save', (_event, positions = {}) => safe({}, () => brainService.saveLayout(userData(), positions)))
  ipcMain.handle('brain-growth-list', (_event, options = {}) => safe({ events: [] }, () => brainService.growthList(userData(), options)))
  ipcMain.handle('brain-growth-undo', async (_event, eventId) => {
    try { return await brainService.undoGrowth(userData(), eventId, context()) }
    catch (error) { return { ok: false, error: error.message || String(error) } }
  })
}

module.exports = { registerBrainIpc }

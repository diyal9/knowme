'use strict'

/**
 * Workbench load / workflow / pick-files IPC.
 */
function registerWorkbenchLoadIpc(ipcMain, deps) {
  const {
    path,
    fs,
    loadWorkbenchDaemonOverview,
    listLocalWorkbenchAgents,
    workbenchDaemon,
    refreshWorkbenchModeProjections,
    getWorkbenchAutomationStore,
    getWorkbenchWorkflowPackageStore,
    getWorkbenchTaskDraftStore,
    getWorkbenchContextStore,
    workbenchRepo,
    loadSourcesStore,
    buildVerticalPipelineFactsInput,
    buildWorkflowShelf,
    buildWorkbenchConsoleProjection,
    attachWorkflowDefinitions,
    ensureOfficialWorkflowExperts,
    readJsonSafe,
    readTextSafe,
    workbenchModel,
    showOpenDialogFor,
  } = deps

  ipcMain.handle('workbench-load', async () => {
    await ensureOfficialWorkflowExperts().catch(() => null)
    const daemon = await loadWorkbenchDaemonOverview()
    const localAgents = listLocalWorkbenchAgents()
    const catalogs = workbenchDaemon.partitionAgentExperts(localAgents, daemon)
    const modes = await refreshWorkbenchModeProjections(daemon)
    const automation = getWorkbenchAutomationStore().list()
    const personalWorkflows = getWorkbenchWorkflowPackageStore().list().packages
    const taskDraft = getWorkbenchTaskDraftStore().get().draft
    const repo = workbenchRepo.resolveActiveRepo(loadSourcesStore())
    if (!repo.ok) {
      const pipelineFacts = await buildVerticalPipelineFactsInput({
        modes,
        daemon,
        agents: catalogs.localAgents,
      })
      const shelf = buildWorkflowShelf({
        workflows: [],
        daemon,
        personal: personalWorkflows,
        pipelineFacts,
        agents: [...catalogs.localAgents, ...catalogs.daemonAgents],
        repoActive: false,
      })
      const workflowPackages = shelf.packages
      const consoleProjection = buildWorkbenchConsoleProjection({
        modes,
        workflows: [],
        workflowPackages,
        daemon,
        automation,
        taskDraft,
        agents: catalogs.localAgents,
      })
      return {
        ok: true,
        root: '',
        repo: null,
        repoError: repo.error || '当前仓库不可用',
        agents: catalogs.localAgents,
        daemonAgents: catalogs.daemonAgents,
        agentSource: catalogs.localAgents.length ? 'local' : 'none',
        workflows: [],
        workflowPackages,
        supply: { diagnostics: shelf.diagnostics, stats: shelf.stats },
        daemon,
        automation,
        console: consoleProjection,
        taskDraft,
        workContext: getWorkbenchContextStore().get().context,
        modes,
      }
    }
    const { root, agentsDir, workflowsDir, source } = repo

    // 1) Agent 注册表（优先）+ 目录扫描兜底
    const registry = readJsonSafe(path.join(root, 'tools', 'workflow_runner', 'agents_registry.json'))
    let agentEntries = []
    if (registry && Array.isArray(registry.agents)) {
      agentEntries = registry.agents.map(a => ({ id: a.id, title: a.title, rel: a.path }))
    } else if (fs.existsSync(agentsDir)) {
      try {
        agentEntries = fs.readdirSync(agentsDir, { withFileTypes: true })
          .filter(d => d.isDirectory() && !d.name.startsWith('_'))
          .map(d => ({ id: d.name, title: d.name, rel: `.cursor/agents/${d.name}` }))
      } catch { agentEntries = [] }
    }
    const agents = []
    for (const entry of agentEntries) {
      const dir = workbenchRepo.resolveAgentDir(root, entry.rel, entry.id)
      if (!dir) continue
      const manifest = readJsonSafe(path.join(dir, 'agent.manifest.json'))
      const fm = workbenchModel.parseAgentFrontmatter(readTextSafe(path.join(dir, 'AGENT.md')))
      if (!manifest && !fm.description) continue
      const agent = workbenchModel.parseAgentManifest(manifest || { id: entry.id, title: entry.title }, {
        id: entry.id,
        title: entry.title,
        description: fm.description,
        path: entry.rel || '',
      })
      if (!agent.persona.role && fm.persona.role) agent.persona.role = fm.persona.role
      if (!agent.model && fm.model) agent.model = fm.model
      agents.push(agent)
    }
    const repositoryAgents = agents.map(agent => ({
      ...agent,
      source: 'repository',
      origin: 'repository',
      editable: false,
    }))
    // 2) 工作流索引
    const wfIndex = readJsonSafe(path.join(workflowsDir, 'index.json'))
    let workflows = []
    if (wfIndex && Array.isArray(wfIndex.workflows)) {
      workflows = wfIndex.workflows.map(w => ({
        id: w.id, name: w.name, summary: w.summary || w.purpose || '', description: w.description || '',
        tags: Array.isArray(w.tags) ? w.tags : [], path: w.path || '',
        catalog: w.catalog && typeof w.catalog === 'object' ? w.catalog : null,
      }))
    }
    const pipelineFacts = await buildVerticalPipelineFactsInput({
      modes,
      daemon,
      agents: [...catalogs.localAgents, ...repositoryAgents],
    })
    const shelf = buildWorkflowShelf({
      workflows: attachWorkflowDefinitions(root, workflows),
      daemon,
      personal: personalWorkflows,
      pipelineFacts,
      agents: [...catalogs.localAgents, ...repositoryAgents, ...catalogs.daemonAgents],
      repoActive: true,
    })
    const workflowPackages = shelf.packages
    const consoleProjection = buildWorkbenchConsoleProjection({
      modes,
      workflows,
      workflowPackages,
      daemon,
      automation,
      taskDraft,
      agents: [...catalogs.localAgents, ...repositoryAgents],
    })
    return {
      ok: true,
      root,
      repo: { id: source.id, name: source.displayName, type: source.type },
      agents: catalogs.localAgents,
      repositoryAgents,
      daemonAgents: catalogs.daemonAgents,
      agentSource: catalogs.localAgents.length ? 'local' : (repositoryAgents.length ? 'repository' : 'none'),
      workflows,
      workflowPackages,
      supply: { diagnostics: shelf.diagnostics, stats: shelf.stats },
      repoError: '',
      daemon,
      automation,
      console: consoleProjection,
      taskDraft,
      workContext: getWorkbenchContextStore().get().context,
      modes,
    }
  })

  ipcMain.handle('workbench-workflow', (_e, payload = {}) => {
    const repo = workbenchRepo.resolveActiveRepo(loadSourcesStore())
    if (!repo.ok) return repo
    const rel = String(payload.path || '').trim()
    if (!rel) return { ok: false, error: '缺少工作流路径' }
    const file = workbenchRepo.resolveWorkflowFile(repo.root, rel)
    if (!file) return { ok: false, error: '非法工作流路径' }
    const json = readJsonSafe(file)
    if (!json) return { ok: false, error: `无法读取工作流：${rel}` }
    const workflow = workbenchModel.parseWorkflow(json, { id: payload.id, name: payload.name, path: rel })
    return { ok: true, repo: { id: repo.source.id, name: repo.source.displayName }, workflow }
  })

  ipcMain.handle('workbench-pick-files', async (e, payload = {}) => {
    try {
      const multi = payload.multi !== false
      const { canceled, filePaths } = await showOpenDialogFor(e.sender, {
        title: String(payload.title || '选择文件'),
        properties: multi ? ['openFile', 'multiSelections'] : ['openFile'],
        filters: Array.isArray(payload.filters) && payload.filters.length
          ? payload.filters
          : [
            { name: '补充材料', extensions: ['md', 'markdown', 'txt', 'doc', 'docx', 'pdf', 'png', 'jpg', 'jpeg', 'webp', 'fig', 'xlsx', 'xls', 'csv', 'json'] },
            { name: '全部文件', extensions: ['*'] },
          ],
      })
      if (canceled || !filePaths?.length) return { ok: true, canceled: true, files: [] }
      return {
        ok: true,
        canceled: false,
        files: filePaths.map(filePath => ({
          path: filePath,
          name: path.basename(filePath),
        })),
      }
    } catch (error) {
      return { ok: false, error: (error && error.message) || '选择文件失败' }
    }
  })
}

module.exports = { registerWorkbenchLoadIpc }

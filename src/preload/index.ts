const { contextBridge, ipcRenderer } = require("electron")
const core = require("./api-core")
const extended = require("./api-extended")

const api = { ...core, ...extended }

if (process.env.KNOWME_AGENT_OUTPUT_FIXTURE === "1") {
  api.agentOutputFixtureRun = payload => ipcRenderer.invoke("agent-output-fixture-run", payload || {})
}

contextBridge.exposeInMainWorld('api', api)

const capInvoke = (ch, ...args) => ipcRenderer.invoke(ch, ...args)

contextBridge.exposeInMainWorld('knowme', {
  /** 主进程根据远程/GPU 降级自动写入；渲染层定时器据此降频。 */
  perf: {
    uiThrottle: process.env.KNOWME_UI_THROTTLE === '1',
    liveNowIntervalMs: Number(process.env.KNOWME_UI_LIVE_MS || 0) || (process.env.KNOWME_UI_THROTTLE === '1' ? 1000 : 500),
    runTelemetryIntervalMs: Number(process.env.KNOWME_UI_TELEMETRY_MS || 0) || (process.env.KNOWME_UI_THROTTLE === '1' ? 4000 : 1600),
  },
  capability: {
    list: opts => capInvoke('capability-list', opts),
    favoriteList: () => capInvoke('capability-favorite-list'),
    favoriteToggle: payload => capInvoke('capability-favorite-toggle', payload),
    install: payload => capInvoke('capability-install', payload),
    installPrecheck: payload => capInvoke('capability-install-precheck', payload),
    uninstall: payload => capInvoke('capability-uninstall', payload),
    enable: payload => capInvoke('capability-enable', payload),
    disable: payload => capInvoke('capability-disable', payload),
    update: payload => capInvoke('capability-update', payload),
    import: payload => capInvoke('capability-import', payload),
    importPrecheck: payload => capInvoke('capability-import-precheck', payload),
    pickLocalFolder: () => capInvoke('capability-pick-local-folder'),
    pickZipFile: () => capInvoke('capability-pick-zip-file'),
    pickCursorRepository: () => capInvoke('capability-pick-cursor-repository'),
    scanCursorRepository: payload => capInvoke('capability-scan-cursor-repository', payload),
    importCursorRepository: payload => capInvoke('capability-import-cursor-repository', payload),
  },
  skill: {
    list: () => capInvoke('skill-list'),
    load: payload => capInvoke('skill-load', payload),
    readResource: payload => capInvoke('skill-read-resource', payload),
    runScript: payload => capInvoke('skill-run-script', payload),
    migrateLegacy: payload => capInvoke('skill-migrate-legacy', payload),
    tasks: () => capInvoke('skill-task-list'),
  },
  expert: {
    list: () => capInvoke('expert-list'),
    get: expertId => capInvoke('expert-get', expertId),
    save: payload => capInvoke('expert-save', payload),
    delete: payload => capInvoke('expert-delete', payload),
    tryChat: payload => capInvoke('expert-try-chat', payload),
    snapshot: payload => capInvoke('expert-snapshot', payload),
  },
  connector: {
    health: payload => capInvoke('connector-health', payload),
    toolsPreview: payload => capInvoke('connector-tools-preview', payload),
    saveAllowlist: payload => capInvoke('connector-save-allowlist', payload),
  },
})

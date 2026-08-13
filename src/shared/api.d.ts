/**
 * Typed subset of KnowMe preload `window.api`.
 * Keep in sync with src/preload.js — expand as renderer surfaces migrate.
 */
export interface KnowMeApi {
  workbenchLoad: () => Promise<unknown>
  workbenchModeList: () => Promise<unknown>
  appInfo: () => Promise<unknown>
  getSettings: () => unknown
  openSettings: (tab?: string) => void
  openSettingsWindow: (tab?: string) => void
  llmProfile: () => Promise<unknown>
  agentSessionList: () => Promise<unknown>
  [key: string]: unknown
}

declare global {
  interface Window {
    api?: KnowMeApi
    Workbench?: {
      init: (opts: Record<string, unknown>) => void
      openPage?: (page: string) => void
      [key: string]: unknown
    }
    WorkspaceAgent?: {
      init: (opts: Record<string, unknown>) => void
      [key: string]: unknown
    }
  }
}

export {}

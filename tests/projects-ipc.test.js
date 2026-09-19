'use strict'

const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const sourcesLib = require('../src/lib/sources')
const projectsLib = require('../src/lib/projects')
const { registerProjectsIpc } = require('../src/ipc/projects')

describe('projects IPC', () => {
  let dir
  let sourceStore
  let handlers
  let refreshes

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-project-ipc-'))
    const alphaRoot = path.join(dir, 'alpha')
    const betaRoot = path.join(dir, 'beta')
    fs.mkdirSync(alphaRoot)
    fs.mkdirSync(betaRoot)
    sourceStore = {
      version: 1,
      activeSourceId: 'source-alpha',
      sources: [
        { id: 'source-alpha', type: 'local', displayName: 'Alpha', rootPath: alphaRoot },
        { id: 'source-beta', type: 'local', displayName: 'Beta', rootPath: betaRoot },
      ],
    }
    handlers = new Map()
    refreshes = 0
    registerProjectsIpc({ handle: (channel, handler) => handlers.set(channel, handler) }, {
      BrowserWindow: { fromWebContents: () => null },
      dialog: { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) },
      shell: { openPath: async () => '' },
      app: { getPath: () => dir },
      sourcesLib,
      loadSourcesStore: () => sourceStore,
      saveSourcesStore: (next) => { sourceStore = next; return next },
      notifyWorkspaceRefresh: () => { refreshes += 1 },
    })
  })

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  it('lists deterministic projects and keeps legacy active source aligned on selection', async () => {
    const listed = await handlers.get('projects-list')()
    assert.equal(listed.projects.length, 2)
    const betaId = projectsLib.projectIdForSource('source-beta')
    const selected = await handlers.get('projects-set-active')({}, betaId)

    assert.equal(selected.activeProjectId, betaId)
    assert.equal(sourceStore.activeSourceId, 'source-beta')
    assert.equal(refreshes, 1)
  })

  it('archives metadata without deleting the workspace directory', async () => {
    const projectId = projectsLib.projectIdForSource('source-alpha')
    const rootPath = sourceStore.sources[0].rootPath
    const result = await handlers.get('projects-archive')({}, projectId, true)

    assert.equal(result.projects.find(item => item.id === projectId).status, 'archived')
    assert.equal(fs.existsSync(rootPath), true)
  })
})

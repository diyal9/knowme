'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const projects = require('../src/lib/projects');

function source(id, rootPath, type = 'local', displayName = id) {
  return { id, type, displayName, rootPath, createdAt: '2026-01-01T00:00:00.000Z' };
}

describe('project store', () => {
  it('creates one deterministic project for each writable source and excludes web caches', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-project-'));
    const sourcesStore = {
      sources: [
        source('local-1', root, 'local', 'Local docs'),
        source('web-1', root, 'web', 'Reference page'),
      ],
      activeSourceId: 'local-1',
    };
    const first = projects.reconcileStore({}, sourcesStore);
    const second = projects.reconcileStore(first, sourcesStore);
    assert.equal(first.projects.length, 1);
    assert.equal(first.projects[0].workspaceSourceId, 'local-1');
    assert.equal(first.projects[0].name, 'Local docs');
    assert.equal(first.projects[0].id, projects.projectIdForSource('local-1'));
    assert.equal(second.projects.length, 1);
    assert.equal(second.activeProjectId, first.projects[0].id);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('persists migration and never stores user file bodies', () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-project-store-'));
    const workspace = path.join(temp, 'workspace');
    fs.mkdirSync(workspace);
    fs.writeFileSync(path.join(workspace, 'private.md'), 'not project metadata');
    const file = path.join(temp, 'projects.json');
    const store = projects.loadStore(file, {
      sources: [source('s1', workspace)],
      activeSourceId: 's1',
    });
    assert.equal(store.projects.length, 1);
    const persisted = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(persisted, /not project metadata/);
    assert.equal(JSON.parse(persisted).activeProjectId, store.projects[0].id);
    fs.rmSync(temp, { recursive: true, force: true });
  });

  it('keeps project identity stable when the current project changes', () => {
    const a = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-project-a-'));
    const b = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-project-b-'));
    const store = projects.reconcileStore({}, {
      sources: [source('a', a), source('b', b)],
      activeSourceId: 'a',
    });
    const projectA = store.projects.find(item => item.workspaceSourceId === 'a');
    const projectB = store.projects.find(item => item.workspaceSourceId === 'b');
    const task = { id: 'task-1', projectId: projectA.id };
    const switched = projects.setActive(store, projectB.id);
    assert.equal(switched.ok, true);
    assert.equal(switched.store.activeProjectId, projectB.id);
    assert.equal(task.projectId, projectA.id);
    fs.rmSync(a, { recursive: true, force: true });
    fs.rmSync(b, { recursive: true, force: true });
  });

  it('marks unavailable workspaces missing and preserves explicit archive state', () => {
    const missingRoot = path.join(os.tmpdir(), `knowme-missing-${Date.now()}`);
    const base = projects.reconcileStore({}, {
      sources: [source('s1', missingRoot)],
      activeSourceId: 's1',
    });
    assert.equal(base.projects[0].status, 'missing');
    const archived = projects.updateProject(base, base.projects[0].id, { status: 'archived' });
    assert.equal(archived.ok, true);
    const reconciled = projects.reconcileStore(archived.store, {
      sources: [source('s1', missingRoot)],
      activeSourceId: 's1',
    });
    assert.equal(reconciled.projects[0].status, 'archived');
  });

  it('resolves explicit context and blocks writes for readonly projects', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-project-context-'));
    const sourcesStore = {
      sources: [source('s1', root), source('ref', root, 'web')],
      activeSourceId: 's1',
    };
    let store = projects.reconcileStore({}, sourcesStore);
    const id = store.projects[0].id;
    store = projects.updateProject(store, id, {
      status: 'readonly',
      referenceSourceIds: ['ref'],
      outputPolicy: { deliverablesDir: 'deliverables' },
    }).store;
    const context = projects.resolveProjectContext(store, sourcesStore, id);
    assert.equal(context.ok, true);
    assert.equal(context.workspace.sourceId, 's1');
    assert.equal(context.permissions.readWorkspace, true);
    assert.equal(context.permissions.writeWorkspace, false);
    assert.equal(context.references[0].sourceId, 'ref');
    assert.equal(context.project.outputPolicy.deliverablesDir, 'deliverables');
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('detaches metadata without deleting or immediately recreating the source project', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-project-detach-'));
    const sourcesStore = { sources: [source('s1', root)], activeSourceId: 's1' };
    const store = projects.reconcileStore({}, sourcesStore);
    fs.writeFileSync(path.join(root, 'keep.md'), 'keep');
    const detached = projects.detachProject(store, store.projects[0].id);
    const reconciled = projects.reconcileStore(detached.store, sourcesStore);
    assert.equal(reconciled.projects.length, 0);
    assert.equal(fs.readFileSync(path.join(root, 'keep.md'), 'utf8'), 'keep');
    fs.rmSync(root, { recursive: true, force: true });
  });
});


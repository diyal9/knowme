'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const VERSION = 1;
const WORKSPACE_SOURCE_TYPES = new Set(['local', 'gitlab', 'github']);
const PROJECT_STATUSES = new Set(['active', 'archived', 'missing', 'readonly']);
const CONFLICT_STRATEGIES = new Set(['version', 'overwrite', 'ask']);

function nowIso() {
  return new Date().toISOString();
}

function text(value, max = 300) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

function normalizeRelativeDir(value, fallback = 'outputs') {
  const normalized = text(value, 240).replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalized || normalized.includes('\0')) return fallback;
  const parts = normalized.split('/').filter(Boolean);
  if (!parts.length || parts.some(part => part === '..')) return fallback;
  return parts.join('/');
}

function projectIdForSource(sourceId) {
  const digest = crypto.createHash('sha256').update(String(sourceId || '')).digest('hex').slice(0, 16);
  return `project_${digest}`;
}

function isWorkspaceSource(source) {
  return !!source && WORKSPACE_SOURCE_TYPES.has(String(source.type || '')) && !!text(source.rootPath, 2000);
}

function workspaceAvailable(source) {
  if (!isWorkspaceSource(source)) return false;
  try {
    return fs.existsSync(source.rootPath) && fs.statSync(source.rootPath).isDirectory();
  } catch {
    return false;
  }
}

function normalizeProject(raw = {}) {
  const workspaceSourceId = text(raw.workspaceSourceId, 160);
  if (!workspaceSourceId) return null;
  const createdAt = text(raw.createdAt, 40) || nowIso();
  const referenceSourceIds = [...new Set((Array.isArray(raw.referenceSourceIds) ? raw.referenceSourceIds : [])
    .map(value => text(value, 160))
    .filter(value => value && value !== workspaceSourceId))];
  const conflictStrategy = CONFLICT_STRATEGIES.has(raw.outputPolicy?.conflictStrategy)
    ? raw.outputPolicy.conflictStrategy
    : 'version';
  return {
    id: text(raw.id, 100) || projectIdForSource(workspaceSourceId),
    name: text(raw.name, 160) || '未命名项目',
    description: text(raw.description, 1000),
    workspaceSourceId,
    referenceSourceIds,
    outputPolicy: {
      deliverablesDir: normalizeRelativeDir(raw.outputPolicy?.deliverablesDir, 'outputs'),
      conflictStrategy,
    },
    brainPolicy: {
      observeCompletedTasks: raw.brainPolicy?.observeCompletedTasks !== false,
      createProposals: raw.brainPolicy?.createProposals !== false,
    },
    status: PROJECT_STATUSES.has(raw.status) ? raw.status : 'active',
    createdAt,
    updatedAt: text(raw.updatedAt, 40) || createdAt,
    lastOpenedAt: text(raw.lastOpenedAt, 40) || null,
  };
}

function projectFromSource(source) {
  if (!isWorkspaceSource(source)) return null;
  const createdAt = text(source.createdAt, 40) || nowIso();
  return normalizeProject({
    id: projectIdForSource(source.id),
    name: text(source.displayName, 160) || path.basename(source.rootPath) || '未命名项目',
    workspaceSourceId: source.id,
    status: workspaceAvailable(source) ? 'active' : 'missing',
    createdAt,
    updatedAt: createdAt,
  });
}

function readRawStore(file) {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function reconcileStore(raw = {}, sourcesStore = {}) {
  const sources = Array.isArray(sourcesStore.sources) ? sourcesStore.sources : [];
  const sourcesById = new Map(sources.map(source => [String(source.id), source]));
  const detachedSourceIds = [...new Set((Array.isArray(raw.detachedSourceIds) ? raw.detachedSourceIds : [])
    .map(value => text(value, 160))
    .filter(Boolean))];
  const detached = new Set(detachedSourceIds);
  const projects = [];
  const seenProjectIds = new Set();
  const seenWorkspaceIds = new Set();

  for (const value of Array.isArray(raw.projects) ? raw.projects : []) {
    const project = normalizeProject(value);
    if (!project || seenProjectIds.has(project.id) || seenWorkspaceIds.has(project.workspaceSourceId)) continue;
    const source = sourcesById.get(project.workspaceSourceId);
    let status = project.status;
    if (status !== 'archived' && status !== 'readonly') {
      status = workspaceAvailable(source) ? 'active' : 'missing';
    }
    projects.push(status === project.status ? project : { ...project, status, updatedAt: nowIso() });
    seenProjectIds.add(project.id);
    seenWorkspaceIds.add(project.workspaceSourceId);
  }

  for (const source of sources) {
    const sourceId = text(source?.id, 160);
    if (!isWorkspaceSource(source) || detached.has(sourceId) || seenWorkspaceIds.has(sourceId)) continue;
    const project = projectFromSource(source);
    if (!project) continue;
    projects.push(project);
    seenProjectIds.add(project.id);
    seenWorkspaceIds.add(project.workspaceSourceId);
  }

  const selectable = projects.filter(project => project.status !== 'archived');
  const requestedActiveId = text(raw.activeProjectId, 100);
  const sourceActiveProject = projects.find(project => project.workspaceSourceId === sourcesStore.activeSourceId && project.status !== 'archived');
  const activeProjectId = selectable.some(project => project.id === requestedActiveId)
    ? requestedActiveId
    : (sourceActiveProject?.id || selectable[0]?.id || null);

  return { version: VERSION, projects, activeProjectId, detachedSourceIds };
}

function writeStore(file, store) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(store, null, 2), 'utf8');
  return store;
}

function loadStore(file, sourcesStore = {}) {
  const raw = readRawStore(file);
  const reconciled = reconcileStore(raw, sourcesStore);
  if (JSON.stringify(raw) !== JSON.stringify(reconciled)) writeStore(file, reconciled);
  return reconciled;
}

function saveStore(file, store, sourcesStore = {}) {
  return writeStore(file, reconcileStore(store, sourcesStore));
}

function setActive(store, projectId) {
  const id = text(projectId, 100);
  const project = (store.projects || []).find(item => item.id === id && item.status !== 'archived');
  if (!project) return { ok: false, error: '项目不存在或已归档' };
  const openedAt = nowIso();
  return {
    ok: true,
    project: { ...project, lastOpenedAt: openedAt },
    store: {
      ...store,
      activeProjectId: id,
      projects: store.projects.map(item => item.id === id ? { ...item, lastOpenedAt: openedAt } : item),
    },
  };
}

function updateProject(store, projectId, patch = {}) {
  const id = text(projectId, 100);
  const index = (store.projects || []).findIndex(item => item.id === id);
  if (index < 0) return { ok: false, error: '项目不存在' };
  const current = store.projects[index];
  const next = normalizeProject({
    ...current,
    name: patch.name == null ? current.name : patch.name,
    description: patch.description == null ? current.description : patch.description,
    referenceSourceIds: patch.referenceSourceIds == null ? current.referenceSourceIds : patch.referenceSourceIds,
    outputPolicy: patch.outputPolicy == null ? current.outputPolicy : { ...current.outputPolicy, ...patch.outputPolicy },
    brainPolicy: patch.brainPolicy == null ? current.brainPolicy : { ...current.brainPolicy, ...patch.brainPolicy },
    status: patch.status == null ? current.status : patch.status,
    id: current.id,
    workspaceSourceId: current.workspaceSourceId,
    createdAt: current.createdAt,
    updatedAt: nowIso(),
  });
  if (!next) return { ok: false, error: '项目数据无效' };
  const projects = [...store.projects];
  projects[index] = next;
  const activeProjectId = next.status === 'archived' && store.activeProjectId === id
    ? (projects.find(item => item.status !== 'archived' && item.id !== id)?.id || null)
    : store.activeProjectId;
  return { ok: true, project: next, store: { ...store, projects, activeProjectId } };
}

function detachProject(store, projectId) {
  const id = text(projectId, 100);
  const project = (store.projects || []).find(item => item.id === id);
  if (!project) return { ok: false, error: '项目不存在' };
  const projects = store.projects.filter(item => item.id !== id);
  const detachedSourceIds = [...new Set([...(store.detachedSourceIds || []), project.workspaceSourceId])];
  const activeProjectId = store.activeProjectId === id
    ? (projects.find(item => item.status !== 'archived')?.id || null)
    : store.activeProjectId;
  return { ok: true, project, store: { ...store, projects, activeProjectId, detachedSourceIds } };
}

function resolveProjectContext(store, sourcesStore, projectId) {
  const id = text(projectId || store.activeProjectId, 100);
  const project = (store.projects || []).find(item => item.id === id);
  if (!project) return { ok: false, error: '未选择项目' };
  const sources = Array.isArray(sourcesStore.sources) ? sourcesStore.sources : [];
  const workspace = sources.find(source => source.id === project.workspaceSourceId) || null;
  const references = project.referenceSourceIds
    .map(sourceId => sources.find(source => source.id === sourceId))
    .filter(Boolean);
  const available = workspaceAvailable(workspace);
  const writable = available && project.status === 'active';
  return {
    ok: true,
    project,
    workspace: workspace ? {
      sourceId: workspace.id,
      type: workspace.type,
      displayName: workspace.displayName,
      rootPath: workspace.rootPath,
      branch: workspace.branch || '',
      repositoryRef: workspace.projectPath || workspace.ownerRepo || '',
      available,
      writable,
    } : null,
    references: references.map(source => ({
      sourceId: source.id,
      type: source.type,
      displayName: source.displayName,
      rootPath: source.rootPath,
      readable: workspaceAvailable(source) || source.type === 'web',
    })),
    permissions: {
      readWorkspace: available,
      writeWorkspace: writable,
      readReferences: true,
    },
  };
}

module.exports = {
  VERSION,
  WORKSPACE_SOURCE_TYPES,
  PROJECT_STATUSES,
  normalizeRelativeDir,
  projectIdForSource,
  isWorkspaceSource,
  workspaceAvailable,
  normalizeProject,
  projectFromSource,
  reconcileStore,
  loadStore,
  saveStore,
  setActive,
  updateProject,
  detachProject,
  resolveProjectContext,
};


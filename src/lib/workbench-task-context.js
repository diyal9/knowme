'use strict'

const MAX_PROJECT_ID = 240
const MAX_REF = 240
const MAX_COMMIT = 128
const MAX_PATH = 512
const MAX_RESOURCES = 40

function cleanText(value, max, label) {
  const text = String(value == null ? '' : value).trim()
  if (text.length > max) {
    const error = new Error(`${label}过长`)
    error.code = 'invalid_context'
    throw error
  }
  if (/[\u0000\r\n]/.test(text)) {
    const error = new Error(`${label}包含非法字符`)
    error.code = 'invalid_context'
    throw error
  }
  return text
}

function normalizeRepoPath(value, label, { optional = true } = {}) {
  const raw = cleanText(value, MAX_PATH, label).replace(/\\/g, '/')
  if (!raw) {
    if (optional) return ''
    const error = new Error(`${label}不能为空`)
    error.code = 'invalid_context_path'
    throw error
  }
  if (
    raw.startsWith('/') ||
    /^[a-zA-Z]:\//.test(raw) ||
    raw.split('/').some(part => part === '..')
  ) {
    const error = new Error(`${label}必须是仓库内相对路径`)
    error.code = 'invalid_context_path'
    throw error
  }
  return raw.replace(/^\.\/+/, '').replace(/\/{2,}/g, '/')
}

function normalizeResources(value) {
  const list = Array.isArray(value)
    ? value
    : String(value == null ? '' : value)
        .split(/[,;\n]/)
        .map(item => item.trim())
        .filter(Boolean)
  if (list.length > MAX_RESOURCES) {
    const error = new Error(`资源路径不能超过 ${MAX_RESOURCES} 项`)
    error.code = 'invalid_context'
    throw error
  }
  return [...new Set(list.map((item, index) =>
    normalizeRepoPath(item, `资源路径 ${index + 1}`),
  ).filter(Boolean))]
}

function hasContextValues(raw) {
  if (!raw || typeof raw !== 'object') return false
  const workspace = raw.workspace || {}
  const inputs = raw.inputs || {}
  const outputs = raw.outputs || {}
  return [
    workspace.projectId,
    workspace.project_id,
    workspace.ref,
    workspace.commit,
    inputs.root,
    inputs.prd,
    inputs.resources,
    outputs.root,
  ].some(value => Array.isArray(value) ? value.length : String(value || '').trim())
}

function normalizeTaskContext(raw) {
  if (!hasContextValues(raw)) return null
  const source = raw && typeof raw === 'object' ? raw : {}
  const workspace = source.workspace && typeof source.workspace === 'object' ? source.workspace : {}
  const inputs = source.inputs && typeof source.inputs === 'object' ? source.inputs : {}
  const outputs = source.outputs && typeof source.outputs === 'object' ? source.outputs : {}
  const context = {
    protocolVersion: '1',
    workspace: {
      provider: 'gitlab',
      projectId: cleanText(workspace.projectId || workspace.project_id, MAX_PROJECT_ID, 'GitLab 项目'),
      ref: cleanText(workspace.ref, MAX_REF, 'GitLab 分支或 ref'),
      commit: cleanText(workspace.commit, MAX_COMMIT, 'GitLab commit'),
    },
    inputs: {
      root: normalizeRepoPath(inputs.root, '输入制品目录'),
      prd: normalizeRepoPath(inputs.prd, 'PRD 路径'),
      resources: normalizeResources(inputs.resources),
    },
    outputs: {
      root: normalizeRepoPath(outputs.root, '输出制品目录'),
      mode: cleanText(outputs.mode || 'gitlab', 32, '输出模式') || 'gitlab',
    },
  }
  if (!context.workspace.projectId) {
    const error = new Error('GitLab 项目不能为空')
    error.code = 'invalid_context'
    throw error
  }
  if (!context.inputs.root && !context.inputs.prd && !context.inputs.resources.length) {
    const error = new Error('至少填写一个输入制品路径')
    error.code = 'invalid_context'
    throw error
  }
  return context
}

function normalizeTaskContextDefaults(raw) {
  if (!hasContextValues(raw)) return null
  const source = raw && typeof raw === 'object' ? raw : {}
  const workspace = source.workspace && typeof source.workspace === 'object' ? source.workspace : {}
  const inputs = source.inputs && typeof source.inputs === 'object' ? source.inputs : {}
  const outputs = source.outputs && typeof source.outputs === 'object' ? source.outputs : {}
  return {
    protocolVersion: '1',
    workspace: {
      provider: cleanText(workspace.provider || 'gitlab', 32, '仓库提供方') || 'gitlab',
      projectId: cleanText(workspace.projectId || workspace.project_id, MAX_PROJECT_ID, 'GitLab 项目'),
      ref: cleanText(workspace.ref, MAX_REF, 'GitLab 分支或 ref'),
      commit: cleanText(workspace.commit, MAX_COMMIT, 'GitLab commit'),
    },
    inputs: {
      root: normalizeRepoPath(inputs.root, '输入制品目录'),
      prd: normalizeRepoPath(inputs.prd, 'PRD / asset 文件'),
      resources: normalizeResources(inputs.resources),
    },
    outputs: {
      root: normalizeRepoPath(outputs.root, '输出制品目录'),
      mode: cleanText(outputs.mode || 'gitlab', 32, '输出模式') || 'gitlab',
    },
  }
}

function summarizeTaskContext(context) {
  if (!context) return ''
  const workspace = context.workspace || {}
  const inputs = context.inputs || {}
  const outputs = context.outputs || {}
  const inputParts = [inputs.root, inputs.prd, ...(inputs.resources || [])].filter(Boolean)
  return [
    workspace.projectId && `GitLab：${workspace.projectId}`,
    workspace.ref && `ref：${workspace.ref}`,
    workspace.commit && `commit：${workspace.commit}`,
    inputParts.length && `输入：${inputParts.join('、')}`,
    outputs.root && `输出：${outputs.root}`,
  ].filter(Boolean).join(' · ')
}

module.exports = {
  MAX_PROJECT_ID,
  MAX_REF,
  MAX_COMMIT,
  MAX_PATH,
  normalizeRepoPath,
  normalizeResources,
  normalizeTaskContext,
  normalizeTaskContextDefaults,
  summarizeTaskContext,
}

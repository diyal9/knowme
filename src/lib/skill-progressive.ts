'use strict'

const path = require('path')
const { TextDecoder } = require('util')

const DEFAULT_RESOURCE_PAGE_BYTES = 12000
const MAX_RESOURCE_PAGE_BYTES = 32768

function skillRequiredTools(raw) {
  const values = raw == null || raw === '' ? [] : (Array.isArray(raw) ? raw : [raw])
  const issues = []
  const requiredTools = []
  for (const value of values) {
    if (typeof value !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_.-]*$/.test(value.trim())) {
      issues.push({ path: 'requiredTools', message: 'requiredTools 必须包含有效工具标识（内置名称或命名空间名称）' })
    } else if (!requiredTools.includes(value.trim())) requiredTools.push(value.trim())
  }
  return { requiredTools, issues }
}

// Invocation is host context, never a field accepted from model tool arguments.
function skillInvocation(record, options = {}) {
  const explicit = options.invocation === 'explicit-user'
    || (Array.isArray(options.explicitUserSkillIds) && options.explicitUserSkillIds.includes(record.id))
  if (record.disableModelInvocation && !explicit) {
    return { ok: false, code: 'model_invocation_disabled', message: `技能 ${record.id} 禁止模型自动调用；请由用户通过技能选择器或显式命令调用。` }
  }
  return { ok: true, invocation: explicit ? 'explicit-user' : 'model' }
}

function skillBudgetFailure(id, requiredChars, maxChars) {
  return {
    ok: false, code: 'skill_l1_budget_exceeded', requiredChars, maxChars,
    message: `技能 ${id} 的完整 L1 需要 ${requiredChars} 字符，当前预算 ${maxChars}；尚未激活。请由宿主增加 L1/上下文预算，或将可选资料移至 references/ 后重试。必需指令不可截断。`,
  }
}

function skillActivationMetadata(record, groundingContract, hash, invocation) {
  const manifest = record.capabilityManifest || {}
  return {
    activation: { skillId: record.id, status: 'active', complete: true, source: record.source, contentHash: hash, invocation },
    groundingContract,
    executionContract: {
      skillId: record.id,
      requiredTools: groundingContract?.requiredTools || [],
      requiredEvidence: groundingContract?.requiredEvidence || [],
      completionConditions: groundingContract?.completionConditions || [],
      permissions: manifest.permissions || {}, inputs: manifest.inputs || [], outputs: manifest.outputs || [],
    },
    // Metadata does not authorize dependencies or expand the host tool surface.
    dependencies: manifest.dependencies || [],
  }
}

function validateResourcePage(options = {}) {
  const offset = options.offset === undefined ? 0 : options.offset
  const maxBytes = options.maxBytes === undefined ? DEFAULT_RESOURCE_PAGE_BYTES : options.maxBytes
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(maxBytes) || maxBytes < 4 || maxBytes > MAX_RESOURCE_PAGE_BYTES) {
    return { ok: false, code: 'invalid_args', message: `offset 必须为非负安全整数；max_bytes 必须为 4–${MAX_RESOURCE_PAGE_BYTES} 的整数。` }
  }
  return { ok: true, offset, maxBytes }
}

function validateSkillFileBoundary(fsImpl, root, abs) {
  try {
    const realRoot = fsImpl.realpathSync(root)
    const realFile = fsImpl.realpathSync(abs)
    const relative = path.relative(realRoot, realFile)
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      return { ok: false, code: 'invalid_path', message: '资源实际路径超出技能目录' }
    }
    if (!fsImpl.statSync(realFile).isFile()) return { ok: false, code: 'invalid_path', message: '仅支持单文件读取' }
    return { ok: true, abs: realFile }
  } catch {
    return { ok: false, code: 'not_found', message: '技能文件不存在或不可读' }
  }
}

function readSkillResourcePage(fsImpl, root, abs, options = {}) {
  const page = validateResourcePage(options)
  if (!page.ok) return page
  const safe = validateSkillFileBoundary(fsImpl, root, abs)
  if (!safe.ok) return safe
  let fd
  try {
    fd = fsImpl.openSync(safe.abs, 'r')
    const totalBytes = fsImpl.fstatSync(fd).size
    if (page.offset > totalBytes) return { ok: false, code: 'invalid_args', message: `offset 超出文件大小 ${totalBytes}` }
    // One lookahead byte lets us stop before a partial UTF-8 code point.
    const buffer = Buffer.alloc(Math.min(page.maxBytes + 1, totalBytes - page.offset))
    const read = fsImpl.readSync(fd, buffer, 0, buffer.length, page.offset)
    let end = Math.min(page.maxBytes, read)
    if (end < read) while (end > 0 && (buffer[end] & 0xc0) === 0x80) end--
    const content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer.subarray(0, end))
    if (content.includes('\0')) return { ok: false, code: 'unsupported_encoding', message: '仅支持 UTF-8 文本资源；二进制资源请通过文件/脚本工具使用。' }
    const next = page.offset + end
    return { ok: true, content, pagination: { offset: page.offset, nextOffset: next < totalBytes ? next : null, complete: next >= totalBytes, totalBytes, returnedBytes: end } }
  } catch (error) {
    return { ok: false, code: 'resource_read_failed', message: `资源读取失败；请确认文件为 UTF-8 文本并使用上一页 nextOffset：${error.message}` }
  } finally {
    if (fd !== undefined) fsImpl.closeSync(fd)
  }
}

module.exports = { skillRequiredTools, skillInvocation, skillBudgetFailure, skillActivationMetadata, validateResourcePage, validateSkillFileBoundary, readSkillResourcePage, DEFAULT_RESOURCE_PAGE_BYTES, MAX_RESOURCE_PAGE_BYTES }

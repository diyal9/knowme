'use strict'

/** 缺失资源检测与 artifact ref 合并；供工具失败回退提示使用。 */

function mergeArtifactRefs(...lists) {
  const merged = new Map()
  for (const item of lists.flat().filter(Boolean)) {
    const ref = typeof item === 'string' ? { id: item } : item
    const id = String(ref?.id || ref?.artifactId || ref?.path || ref?.url || '').trim()
    if (!id) continue
    merged.set(id, { ...(merged.get(id) || {}), ...ref, id })
    if (merged.size >= 32) break
  }
  return [...merged.values()]
}

function isMissingResourceText(text = '') {
  const raw = String(text || '').trim()
  if (!raw) return false
  return /(enoent|no such file|not found|does not exist|404|找不到|未找到|不存在|路径无效|缺少资源)/i.test(raw)
}

function buildMissingResourceHint(entries = []) {
  const list = Array.isArray(entries) ? entries : []
  const failed = [...list].reverse().find(item =>
    item?.status === 'error' && isMissingResourceText(item?.text),
  )
  if (!failed) return ''
  return '我尝试读取目标内容，但未找到对应资源。\n请先确认路径是否正确、文件是否已生成，再让我继续读取。'
}

module.exports = {
  mergeArtifactRefs,
  isMissingResourceText,
  buildMissingResourceHint,
}

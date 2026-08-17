'use strict'

/**
 * 工作流展示名（纯渲染层）：不改 package.name 真源。
 * - id / parentRef 短名表
 * - 去掉「（我的版本）」后缀
 * - 管道公式（A → B）取结果侧短名
 */

const DISPLAY_NAME_BY_ID = Object.freeze({
  'office-meeting-to-actions': '会议纪要与待办',
  'engineering-delivery': '研发交付',
  'visual-brief-to-export': '视觉 Brief 出图',
  'official-office-meeting-loop': '会议闭环',
  'official-engineering-team-delivery': '三角色协作交付',
  'official-visual-brief-review': 'Brief 出图审阅',
})

const MINE_SUFFIX_RE = /(?:（我的版本）|\(我的版本\))\s*$/u
const PIPELINE_SPLIT_RE = /\s*(?:→|->|—|–)\s*/u
const PIPELINE_TEST_RE = /(?:→|->|—|–)/u

function text(value) {
  return String(value == null ? '' : value).trim()
}

function stripMineSuffix(name) {
  return text(name).replace(MINE_SUFFIX_RE, '').trim()
}

function lookupIdDisplayName(id) {
  const key = text(id)
  if (!key) return ''
  if (DISPLAY_NAME_BY_ID[key]) return DISPLAY_NAME_BY_ID[key]
  for (const [seedId, label] of Object.entries(DISPLAY_NAME_BY_ID)) {
    if (key === seedId || key.startsWith(`${seedId}-`) || key.startsWith(`${seedId}_`)) {
      return label
    }
  }
  return ''
}

function pipelineToShortName(name) {
  const parts = text(name).split(PIPELINE_SPLIT_RE).map(part => part.trim()).filter(Boolean)
  if (parts.length < 2) return text(name)
  if (parts.length === 2) return parts[1]
  return parts[parts.length - 1]
}

function workflowDisplayName(item = {}) {
  const id = text(item.id)
  const parentId = text(item.parentRef && item.parentRef.id)
  const fromId = lookupIdDisplayName(id) || lookupIdDisplayName(parentId)
  if (fromId) return fromId

  let name = stripMineSuffix(item.name)
  if (!name) return id || '未命名工作流'
  if (PIPELINE_TEST_RE.test(name)) name = pipelineToShortName(name)
  return name || id || '未命名工作流'
}

function workflowSearchHaystack(item = {}) {
  const parts = [
    item.id,
    item.name,
    workflowDisplayName(item),
    item.description,
    item.summary,
  ]
  return parts.map(text).filter(Boolean).join(' ').toLowerCase()
}

const workflowDisplayNameApi = {
  DISPLAY_NAME_BY_ID,
  stripMineSuffix,
  workflowDisplayName,
  workflowSearchHaystack,
}

if (typeof module === 'object' && module.exports) module.exports = workflowDisplayNameApi
if (typeof window !== 'undefined') window.WorkflowDisplayName = workflowDisplayNameApi

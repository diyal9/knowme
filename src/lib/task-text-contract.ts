'use strict'

// Canonical intent is not a card summary. Validate at write boundaries; never
// silently shorten stored intent when reading/re-normalizing an existing task.
const TASK_GOAL_MAX = 32000
const REVIEW_COMMENT_MAX = 8000
const MATERIAL_TEXT_MAX = 8000
const MATERIAL_COUNT_MAX = 32

function taskText(value) {
  return String(value == null ? '' : value).trim()
}

function validateTaskTextFields(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, code: 'task_input_invalid', error: '任务内容格式无效，本次内容未提交。' }
  }
  const fields = [
    ['任务目标', input.goal, TASK_GOAL_MAX],
    ['任务目标', input.brief?.goal, TASK_GOAL_MAX],
    ['计划目标', input.plan?.goal, TASK_GOAL_MAX],
    ['计划目标', input.brief?.plan?.goal, TASK_GOAL_MAX],
    ['计划快照目标', input.assignmentSnapshot?.plan?.goal, TASK_GOAL_MAX],
  ]
  for (const materials of [input.materials, input.brief?.materials]) {
    if (materials == null) continue
    if (!Array.isArray(materials)) return { ok: false, code: 'task_input_invalid', error: '材料必须是列表，本次内容未提交。' }
    if (materials.length > MATERIAL_COUNT_MAX) return { ok: false, code: 'task_input_too_long',
      error: `任务材料超过 ${MATERIAL_COUNT_MAX} 项，本次文字和附件均未提交。` }
    for (const item of materials) {
      // Legacy title-only references remain supported; they are not text evidence.
      if (typeof item === 'string') continue
      if (!item || typeof item !== 'object' || Array.isArray(item)) return { ok: false, code: 'task_input_invalid',
        error: '材料格式无效，本次文字和附件均未提交。' }
      fields.push(['材料正文', item.content, MATERIAL_TEXT_MAX], ['材料正文', item.text, MATERIAL_TEXT_MAX])
    }
  }
  for (const item of Array.isArray(input.deliverables) ? input.deliverables : []) {
    for (const comment of Array.isArray(item?.comments) ? item.comments : []) {
      fields.push(['验收意见', comment?.body || comment?.text, REVIEW_COMMENT_MAX])
    }
  }
  for (const [label, value, limit] of fields) {
    if (value == null) continue
    if (typeof value !== 'string') return { ok: false, code: 'task_input_invalid', error: `${label}必须是文字，本次内容未提交。` }
    if (value.trim().length > limit) return { ok: false, code: 'task_input_too_long',
      error: `${label}超过 ${limit} 字，本次内容未提交；请拆分材料或缩短后重新提交。` }
  }
  return { ok: true }
}

module.exports = { TASK_GOAL_MAX, REVIEW_COMMENT_MAX, taskText, validateTaskTextFields }

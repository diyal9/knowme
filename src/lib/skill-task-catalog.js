'use strict'

/**
 * skill-task-catalog — 纯函数合并 Skill 动态 task 与 Pack legacy scene fallback。
 * 动态 task 优先；仅为无 dynamic task 的 scene 生成 display-safe fallback DTO。
 */

const { computeTasksRevision } = require('./skill-experience')

const LEGACY_SCENE_TASK_IDS = Object.freeze({
  'feishu-chats': 'relatedChats',
  'feishu-meeting': 'meetingSummary',
  'feishu-docs': 'docKbSuggest',
})

const LEGACY_SCENE_PREFLIGHT = Object.freeze({
  relatedChats: {
    type: 'connector-auth',
    connector: 'feishu',
    message: '要分析跟你相关的聊天，我得先连上飞书读取你今天的会话。请到「设置 → 连接器」授权飞书（user 身份）后，再点一次「分析跟我相关的聊天」。',
  },
  meetingSummary: {
    type: 'connector-auth',
    connector: 'feishu',
    message: '要做会议总结，我得先连上飞书读取你的会议记录。请到「设置 → 连接器」授权飞书（user 身份）后，再点一次「会议总结」。',
  },
  docKbSuggest: {
    type: 'connector-auth',
    connector: 'feishu',
    message: '要查文档/知识库，我得先连上飞书读取你的文件夹与知识空间。请到「设置 → 连接器」授权飞书（user 身份）后，再点一次「查文档/知识库」。',
  },
})

const UNSAFE_DTO_KEYS = new Set([
  'dir', 'path', 'body', 'script', 'scriptPath', 'scriptAbs', 'scriptsRoot',
  'skillRoot', 'repositoryRoot', 'originPath', 'originRoot', 'catalogRoot',
  'packRoot', 'skillMd', 'capabilityManifest',
])

function sceneToLegacyTaskId(sceneId) {
  const id = String(sceneId || '').trim()
  return LEGACY_SCENE_TASK_IDS[id] || id
}

function findSceneDetail(packScenes, packId, sceneId) {
  return (packScenes || []).find((item) => item.packId === packId && item.id === sceneId) || null
}

function buildLegacySceneTask(scene, packId, packScenes = []) {
  const detail = findSceneDetail(packScenes, packId, scene.id) || {}
  const taskId = sceneToLegacyTaskId(scene.id)
  const prompt = String(scene.prompt || detail.emptyPrompt || '').trim()
  const modes = Array.isArray(detail.legacyModes) && detail.legacyModes.length
    ? [...detail.legacyModes]
    : ['general']

  const dto = {
    id: taskId,
    title: String(scene.title || detail.label || scene.id || '').trim(),
    ...(scene.subtitle || detail.description
      ? { subtitle: String(scene.subtitle || detail.description || '').trim() }
      : {}),
    modes,
    surfaces: ['empty'],
    prompt,
    source: 'pack',
    ownerPackId: packId,
    legacy: true,
  }

  if (detail.skillId) dto.skillId = String(detail.skillId).trim()
  const preflight = LEGACY_SCENE_PREFLIGHT[taskId]
  if (preflight) dto.preflight = { ...preflight }
  else if (Array.isArray(detail.connectors) && detail.connectors.includes('feishu')) {
    dto.preflight = {
      type: 'connector-auth',
      connector: 'feishu',
      message: `要使用「${dto.title}」，请先在「设置 → 连接器」授权飞书（user 身份）后再试。`,
    }
  }

  return dto
}

function assertDisplaySafeTask(task) {
  for (const key of Object.keys(task)) {
    if (UNSAFE_DTO_KEYS.has(key)) {
      throw new Error(`task DTO 含不安全字段: ${key}`)
    }
    const value = task[key]
    if (typeof value === 'string' && /(?:^|[\\/])skills[\\/]|SKILL\.md|scripts[\\/]/i.test(value)) {
      throw new Error(`task DTO 含路径样字符串: ${key}`)
    }
  }
}

/**
 * @param {{
 *   skillTasksResult?: { tasks?: object[], issues?: object[], revision?: string },
 *   emptyStateGroups?: object[],
 *   packScenes?: object[],
 * }} input
 * @returns {{ tasks: object[], issues: object[], revision: string }}
 */
function mergeSkillTaskCatalog(input = {}) {
  const dynamicResult = input.skillTasksResult || {}
  const dynamicTasks = Array.isArray(dynamicResult.tasks) ? dynamicResult.tasks : []
  const issues = [...(Array.isArray(dynamicResult.issues) ? dynamicResult.issues : [])]
  const dynamicIds = new Set(dynamicTasks.map((task) => task.id))
  const tasks = dynamicTasks.map((task) => {
    assertDisplaySafeTask(task)
    return task
  })
  const revisionParts = [String(dynamicResult.revision || '')]

  for (const group of input.emptyStateGroups || []) {
    const packId = String(group.packId || '').trim()
    if (!packId) continue
    for (const scene of group.scenes || []) {
      const taskId = sceneToLegacyTaskId(scene.id)
      if (dynamicIds.has(taskId)) continue

      const fallback = buildLegacySceneTask(scene, packId, input.packScenes)
      if (dynamicIds.has(fallback.id)) continue
      assertDisplaySafeTask(fallback)
      dynamicIds.add(fallback.id)
      tasks.push(fallback)
      revisionParts.push(`legacy:${packId}:${scene.id}:${fallback.contentHash || fallback.prompt?.length || 0}`)
    }
  }

  tasks.sort((a, b) => a.id.localeCompare(b.id))
  return {
    tasks,
    issues,
    revision: computeTasksRevision(revisionParts.filter(Boolean).sort()),
  }
}

module.exports = {
  LEGACY_SCENE_TASK_IDS,
  sceneToLegacyTaskId,
  buildLegacySceneTask,
  mergeSkillTaskCatalog,
  assertDisplaySafeTask,
  UNSAFE_DTO_KEYS,
}

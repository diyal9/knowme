'use strict'

/**
 * skill-task-ui — Renderer 纯函数：动态 task 索引、surface 渲染、preflight、bounded 日期与 skillRefs。
 * Node: require('./lib/skill-task-ui')
 * Browser: <script> → window.SkillTaskUi
 */
;(function (root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root) root.SkillTaskUi = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const LEGACY_SCENE_TASK_IDS = Object.freeze({
    'feishu-chats': 'relatedChats',
    'feishu-meeting': 'meetingSummary',
    'feishu-docs': 'docKbSuggest',
  })

  function sceneToLegacyTaskId(sceneId) {
    const id = String(sceneId || '').trim()
    return LEGACY_SCENE_TASK_IDS[id] || id
  }

  function buildTaskMap(tasks = []) {
    const map = new Map()
    for (const task of tasks) {
      const id = String(task?.id || '').trim()
      if (id) map.set(id, task)
    }
    return map
  }

  function filterTasks(tasks, mode, surface, { group, ownerPackId } = {}) {
    const m = String(mode || 'general').trim() || 'general'
    const s = String(surface || '').trim()
    return (Array.isArray(tasks) ? tasks : []).filter((task) => {
      if (!Array.isArray(task.modes) || !task.modes.includes(m)) return false
      if (!Array.isArray(task.surfaces) || !task.surfaces.includes(s)) return false
      if (group && task.group !== group) return false
      if (ownerPackId && task.ownerPackId !== ownerPackId) return false
      return true
    })
  }

  function resolveEmptyStateCards(mode, legacyPresets = {}, taskMap = new Map()) {
    const presets = Array.isArray(legacyPresets[mode]) ? legacyPresets[mode] : []
    const dynamicTasks = filterTasks([...taskMap.values()], mode, 'empty')
      // general 模式的 Pack task 由 Pack 专属分组渲染；其它模式没有 Pack 分组，
      // 必须直接消费 Pack-owned task，避免写作等入口退回硬编码 legacy。
      .filter((task) => mode !== 'general' || !task.ownerPackId)
    const dynamicById = new Map(dynamicTasks.map((task) => [task.id, task]))
    const cards = []
    const used = new Set()

    for (const preset of presets) {
      const dynamic = dynamicById.get(preset.id)
      if (dynamic) {
        cards.push({
          id: dynamic.id,
          title: dynamic.title || preset.title,
          subtitle: dynamic.subtitle || preset.subtitle || '',
          dynamic: true,
          task: dynamic,
        })
      } else {
        cards.push({ ...preset, dynamic: false })
      }
      used.add(preset.id)
    }

    for (const task of dynamicTasks) {
      if (used.has(task.id)) continue
      cards.push({
        id: task.id,
        title: task.title,
        subtitle: task.subtitle || '',
        dynamic: true,
        task,
      })
    }
    return cards
  }

  function findDynamicPackTask(taskMap, taskId, packId) {
    const direct = taskMap.get(taskId)
    if (direct && !direct.legacy && direct.surfaces?.includes('empty')) {
      if (!direct.ownerPackId || direct.ownerPackId === packId) return direct
    }
    for (const task of taskMap.values()) {
      if (task.id !== taskId || task.legacy) continue
      if (!task.surfaces?.includes('empty')) continue
      if (task.ownerPackId && task.ownerPackId !== packId) continue
      return task
    }
    return null
  }

  function resolvePackEmptyCards(group = {}, taskMap = new Map()) {
    const packId = String(group.packId || '').trim()
    const usedTaskIds = new Set()
    const cards = (group.scenes || []).map((scene) => {
      const taskId = sceneToLegacyTaskId(scene.id)
      const dynamic = findDynamicPackTask(taskMap, taskId, packId)
      if (dynamic) {
        usedTaskIds.add(dynamic.id)
        return {
          id: dynamic.id,
          sceneId: scene.id,
          title: dynamic.title || scene.title,
          subtitle: dynamic.subtitle || scene.subtitle || '',
          prompt: dynamic.prompt,
          dynamic: true,
          task: dynamic,
        }
      }
      usedTaskIds.add(taskId)
      return {
        id: taskId,
        sceneId: scene.id,
        title: scene.title,
        subtitle: scene.subtitle || '',
        prompt: scene.prompt,
        dynamic: false,
      }
    })
    const unrepresentedTasks = filterTasks([...taskMap.values()], 'general', 'empty')
      .filter(task => !task.legacy && task.ownerPackId === packId && !usedTaskIds.has(task.id))
    for (const task of unrepresentedTasks) {
      cards.push({
        id: task.id,
        sceneId: '',
        title: task.title,
        subtitle: task.subtitle || '',
        prompt: task.prompt,
        dynamic: true,
        task,
      })
    }
    return cards
  }

  function partitionPackHomeCards(cards = [], maxRecommendations = 4) {
    const list = Array.isArray(cards) ? cards.filter(Boolean) : []
    const limit = Math.max(1, Number(maxRecommendations) || 4)
    const isWorkflow = card => {
      const identity = `${card?.sceneId || ''} ${card?.id || ''}`.toLowerCase()
      return identity.includes('workflow-intake')
        || identity === 'workflow'
        || !!card?.task?.defaultWorkflow
    }
    const workflow = list.find(isWorkflow) || null
    const taskCards = list.filter(card => card !== workflow)
    return {
      recommendations: taskCards.slice(0, limit),
      workflow,
      overflow: taskCards.slice(limit),
    }
  }

  function mergeQuickMenuSections(mode, legacyProfiles = {}, taskMap = new Map(), promptToTask = new Map()) {
    const key = String(mode || 'general').trim() || 'general'
    const base = legacyProfiles[key] || legacyProfiles.general || []
    const sections = base.map((section) => ({
      ...section,
      items: (section.items || []).map((item) => ({ ...item })),
    }))
    const dynamicTasks = filterTasks([...taskMap.values()], key, 'quick-menu')

    for (const section of sections) {
      const sectionKey = section.key
      const dynamicInGroup = dynamicTasks.filter((task) => task.group === sectionKey)
      for (const task of dynamicInGroup) {
        const menuItem = {
          label: task.title,
          icon: task.icon || 'note',
          prompt: task.prompt,
          taskId: task.id,
          dynamic: true,
          task,
        }
        const idx = section.items.findIndex((item) => {
          if (item.steward) return false
          if (item.taskId && item.taskId === task.id) return true
          const legacyId = item.prompt ? promptToTask.get(String(item.prompt).trim()) : ''
          return legacyId === task.id
        })
        if (idx >= 0) section.items[idx] = { ...section.items[idx], ...menuItem }
        else section.items.push(menuItem)
      }
    }
    const representedTaskIds = new Set()
    for (const section of sections) {
      for (const item of section.items || []) {
        if (item.taskId) representedTaskIds.add(item.taskId)
        const legacyId = item.prompt ? promptToTask.get(String(item.prompt).trim()) : ''
        if (legacyId) representedTaskIds.add(legacyId)
      }
    }
    const remainingTasks = dynamicTasks.filter(task => !representedTaskIds.has(task.id))
    if (remainingTasks.length) {
      sections.push({
        key: 'more-skills',
        label: '更多技能',
        icon: 'optimize',
        items: remainingTasks.map(task => ({
          label: task.title,
          icon: task.icon || 'note',
          prompt: task.prompt,
          taskId: task.id,
          dynamic: true,
          task,
        })),
      })
    }
    return sections
  }

  function flattenQuickMenuSections(sections = []) {
    return (Array.isArray(sections) ? sections : []).flatMap((section, sectionIndex) =>
      (section.items || []).map((item, itemIndex) => {
        const label = String(item.label || '快捷操作').trim()
        const description = String(item.description || item.subtitle || item.task?.subtitle || section.label || '').trim()
        return {
          ...item,
          label,
          description,
          groupKey: String(section.key || `group-${sectionIndex}`),
          groupLabel: String(section.label || '推荐操作'),
          order: sectionIndex * 100 + itemIndex,
          searchText: `${label} ${description} ${section.label || ''}`.toLocaleLowerCase('zh-CN'),
        }
      })
    )
  }

  function filterQuickCommands(commands = [], query = '') {
    const normalized = String(query || '').trim().toLocaleLowerCase('zh-CN')
    const list = Array.isArray(commands) ? commands : []
    if (!normalized) return list.slice()
    const terms = normalized.split(/\s+/).filter(Boolean)
    return list.filter((command) => {
      const haystack = String(command.searchText || `${command.label || ''} ${command.description || ''} ${command.groupLabel || ''}`)
        .toLocaleLowerCase('zh-CN')
      return terms.every(term => haystack.includes(term))
    })
  }

  function preflightToLegacySpec(preflight) {
    if (!preflight || typeof preflight !== 'object') return null
    if (preflight.type === 'connector-auth') {
      const connector = String(preflight.connector || 'feishu').trim()
      return {
        need: connector === 'feishu' ? 'feishuAuth' : 'connectorAuth',
        connector,
        ask: String(preflight.message || '').trim(),
      }
    }
    if (preflight.type === 'material') {
      return {
        need: 'material',
        ask: String(preflight.message || '').trim(),
      }
    }
    return null
  }

  function formatDateYmd(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  function addDateDays(date, days) {
    const next = new Date(date.getTime())
    next.setDate(next.getDate() + days)
    return next
  }

  /**
   * 仅消费 validator 已返回的 templateVars；支持 days(1..30) 与 today。
   * 不做 eval、不替换任意表达式。
   */
  function expandBoundedDateVars(prompt = '', templateVars = {}, now = new Date()) {
    const base = String(prompt || '').trim()
    if (!base || !templateVars || typeof templateVars !== 'object') return base

    const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const today = formatDateYmd(todayZero)
    const extras = []

    if (Object.prototype.hasOwnProperty.call(templateVars, 'days')) {
      let days = Number(templateVars.days)
      if (!Number.isFinite(days)) days = 1
      days = Math.max(1, Math.min(30, Math.floor(days)))
      const dayList = []
      for (let i = days - 1; i >= 0; i -= 1) {
        dayList.push(formatDateYmd(addDateDays(todayZero, -i)))
      }
      const range = `${dayList[0]} 至 ${dayList[dayList.length - 1]}`
      extras.push(`时间范围以点击时刻为准：近 ${days} 天（含今天 ${today}），即 ${dayList.join('、')}（范围 ${range}）。`)
    }

    if (Object.prototype.hasOwnProperty.call(templateVars, 'today') && templateVars.today !== false) {
      extras.push(`参考日期（点击时刻）：${today}。`)
    }

    if (!extras.length) return base
    return `${base}\n\n${extras.join('\n')}`
  }

  function buildDynamicTaskPrompt(task, now = new Date()) {
    const prompt = String(task?.prompt || '').trim()
    return expandBoundedDateVars(prompt, task?.templateVars, now)
  }

  function mergeSkillRefs(explicitRefs = [], prompt = '') {
    const merged = []
    const seen = new Set()
    const add = (ref) => {
      const id = String(ref || '').trim().toLowerCase()
      if (!id || seen.has(id)) return
      seen.add(id)
      merged.push(id)
    }
    for (const ref of Array.isArray(explicitRefs) ? explicitRefs : []) add(ref)
    for (const match of String(prompt || '').matchAll(/(^|\s)\/([a-z0-9][a-z0-9\-]{0,31})\b/gi)) {
      add(match[2])
    }
    return merged
  }

  function resolveTaskSkillRefs(task) {
    const skillId = String(task?.skillId || '').trim()
    return skillId ? [skillId] : []
  }

  /**
   * requiredTools 非空且无有效 skillId 时，Renderer 回退 legacy，由 main grounding 负责工具阻断。
   */
  function canActivateDynamicTask(task) {
    if (!task || task.legacy) return false
    const hasTools = Array.isArray(task.requiredTools) && task.requiredTools.length > 0
    const skillId = String(task.skillId || '').trim()
    if (hasTools && !skillId) return false
    return !!String(task.prompt || '').trim()
  }

  function resolveLegacyPreflight(taskId, legacyPreflight = {}) {
    return legacyPreflight[taskId] || null
  }

  function resolveTaskPreflight(task, taskId, legacyPreflight = {}) {
    if (task?.preflight) return preflightToLegacySpec(task.preflight)
    return resolveLegacyPreflight(taskId, legacyPreflight)
  }

  return {
    LEGACY_SCENE_TASK_IDS,
    sceneToLegacyTaskId,
    buildTaskMap,
    filterTasks,
    resolveEmptyStateCards,
    resolvePackEmptyCards,
    partitionPackHomeCards,
    mergeQuickMenuSections,
    flattenQuickMenuSections,
    filterQuickCommands,
    preflightToLegacySpec,
    formatDateYmd,
    expandBoundedDateVars,
    buildDynamicTaskPrompt,
    mergeSkillRefs,
    resolveTaskSkillRefs,
    canActivateDynamicTask,
    resolveTaskPreflight,
  }
})

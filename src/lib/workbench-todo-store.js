'use strict'

/**
 * 今日待办持久化（%APPDATA%\KnowMe\workbench-todos.json）
 *
 * 首页 hero 承诺「把琐事留在今天」，但待办原先只写渲染层 localStorage：
 * 清缓存即丢、也不随用户数据备份。这里改为落用户数据目录，与自动化 store 同构。
 */

const fs = require('fs')
const path = require('path')

const MAX_ITEMS = 50
const TEXT_MAX = 80

function nowIso() {
  return new Date().toISOString()
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function writeJson(file, data) {
  const dir = path.dirname(file)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8')
}

function makeId() {
  return `todo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function normalizeItem(item = {}) {
  const text = String(item.text || '').trim().slice(0, TEXT_MAX)
  return {
    id: String(item.id || '').trim() || makeId(),
    text,
    done: item.done === true,
    createdAt: String(item.createdAt || '').trim() || nowIso(),
    doneAt: item.done === true ? (String(item.doneAt || '').trim() || nowIso()) : '',
  }
}

/** 未完成在前、已完成沉底，各自按加入时间倒序 */
function sortItems(items) {
  return [...items].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    return String(b.createdAt).localeCompare(String(a.createdAt))
  })
}

function createStore(file) {
  function load() {
    const raw = readJson(file)
    const list = Array.isArray(raw && raw.items) ? raw.items : []
    return sortItems(list.map(normalizeItem).filter(item => item.text)).slice(0, MAX_ITEMS)
  }

  function save(items) {
    writeJson(file, { items, updatedAt: nowIso() })
  }

  function result(items) {
    return { ok: true, items, remaining: items.filter(item => !item.done).length }
  }

  function list() {
    return result(load())
  }

  function add(text) {
    const value = String(text || '').trim()
    if (!value) return { ok: false, error: '请输入待办内容' }
    const items = load()
    const next = sortItems([normalizeItem({ text: value }), ...items]).slice(0, MAX_ITEMS)
    save(next)
    return result(next)
  }

  function toggle(id) {
    const items = load()
    const target = items.find(item => item.id === id)
    if (!target) return { ok: false, error: '待办不存在' }
    const next = sortItems(items.map(item => (
      item.id === id
        ? normalizeItem({ ...item, done: !item.done, doneAt: item.done ? '' : nowIso() })
        : item
    )))
    save(next)
    return result(next)
  }

  function remove(id) {
    const items = load()
    const next = items.filter(item => item.id !== id)
    if (next.length === items.length) return { ok: false, error: '待办不存在' }
    save(next)
    return result(next)
  }

  function clearDone() {
    const items = load()
    const next = items.filter(item => !item.done)
    save(next)
    return result(next)
  }

  /** 从旧的 localStorage 数据一次性迁移（仅当仓库为空时） */
  function importLegacy(items) {
    const incoming = Array.isArray(items) ? items : []
    if (!incoming.length) return result(load())
    const current = load()
    if (current.length) return result(current)
    const next = sortItems(incoming.map(normalizeItem).filter(item => item.text)).slice(0, MAX_ITEMS)
    save(next)
    return result(next)
  }

  return { list, add, toggle, remove, clearDone, importLegacy }
}

module.exports = { createStore, normalizeItem, sortItems, MAX_ITEMS, TEXT_MAX }

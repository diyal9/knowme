'use strict'

function toolRecordName(record = {}) {
  return String(record?.name || record?.function?.name || record?.definition?.function?.name || '').trim()
}

function deriveCapabilityIdsFromToolRecords(records = [], staticCapabilities = []) {
  const ids = new Set((Array.isArray(staticCapabilities) ? staticCapabilities : [])
    .map(item => String(item || '').trim().toLowerCase())
    .filter(Boolean))
  for (const record of Array.isArray(records) ? records : []) {
    const name = toolRecordName(record).toLowerCase()
    if (!name) continue
    if (/search_web|fetch_web|\bweb\b/.test(name)) ids.add('web')
    if (/feishu|lark/.test(name)) ids.add('feishu')
    if (/knowledge|\bkb[_\.]/.test(name)) ids.add('knowledge')
    if (/file|read_text|write_text/.test(name)) ids.add('file')
    if (/process|shell|python/.test(name)) ids.add('process')
    if (/artifact/.test(name)) ids.add('artifact')
    if (/plan/.test(name)) ids.add('plan')
    if (/orchestrat|delegate|handoff/.test(name)) ids.add('orchestration')
    const connectorId = String(record?._knowme?.connectorId || record?.connectorId || '').trim().toLowerCase()
    if (connectorId) ids.add(`connector:${connectorId}`)
  }
  return [...ids].slice(0, 100)
}

module.exports = { toolRecordName, deriveCapabilityIdsFromToolRecords }

import { describe, expect, it } from 'vitest'
import { capabilityPermissionRows, capabilityRiskLabel, capabilityStatusLabel, connectorAuthorizationDisplay } from './capability-display'

describe('capability display facts', () => {
  it('distinguishes denied permissions from allowed scopes', () => {
    const denied = capabilityPermissionRows({ network: false, write: false, externalWrite: false, tools: { allowlist: [] }, connectors: { allowedConnectorIds: [] } })
    const allowed = capabilityPermissionRows({ network: true, tools: { allowlist: ['read_doc'] }, connectors: { allowedConnectorIds: ['feishu'] } })
    expect(denied.find(row => row.label === '联网')?.value).toBe('禁止')
    expect(denied.find(row => row.label === '工具范围')?.value).toBe('不允许调用')
    expect(allowed.find(row => row.label === '联网')?.value).toBe('允许')
    expect(allowed.find(row => row.label === '连接器范围')?.details).toEqual(['feishu'])
    expect(capabilityPermissionRows({ tools: {} })[0].value).toBe('未明确声明允许范围')
  })
  it.each([null, {}, { ok: false, code: 'not_found' }, { ok: false, state: 'error' }, { ok: true, connector: { status: { ok: false, state: 'offline' } } }, { ok: true, connector: { status: { state: 'ready' } } }])('does not invent authorization from %j', payload => {
    expect(connectorAuthorizationDisplay(payload).ready).toBe(false)
    expect(connectorAuthorizationDisplay(payload).label).not.toBe('已授权')
  })
  it('requires positive probe evidence and complete known permissions', () => {
    expect(connectorAuthorizationDisplay({ ok: true, connector: { status: { ok: true, userReady: true, permissions: { known: true, complete: false } } } })).toEqual({ label: '需补齐权限', ready: false })
    expect(connectorAuthorizationDisplay({ ok: true, connector: { status: { ok: true, userReady: true, permissions: { known: true, complete: true } } } })).toEqual({ label: '已授权', ready: true })
  })
  it('localizes statuses and preserves uncertainty for future enum values', () => {
    expect(capabilityStatusLabel('enabled')).toBe('已启用')
    expect(capabilityStatusLabel('future-status')).toBe('状态未知')
    expect(capabilityRiskLabel('high')).toBe('高')
    expect(capabilityRiskLabel(undefined)).toBe('未评估')
  })
})

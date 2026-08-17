/**
 * 飞书设置卡片 view-model 单元测试：一键授权主路径与就绪分支。
 */
import { describe, expect, it } from 'vitest'
import { buildFeishuCardModel, feishuUserReady } from './settings-connector-status'

describe('buildFeishuCardModel', () => {
  it('shows one-click auth when disconnected', () => {
    const card = buildFeishuCardModel({ ok: false, message: '未连接', state: 'auth_required', userReady: false })
    expect(card.primaryLabel).toBe('一键授权')
    expect(card.primaryDisabled).toBe(false)
    expect(card.primaryMode).toBe('full-auth')
    expect(card.needsConfirm).toBe(true)
    expect(card.statusText).toMatch(/未连接|等待完成账号授权|点击一次/)
  })

  it('keeps one-click auth when docs/wiki incomplete', () => {
    const card = buildFeishuCardModel({
      state: 'online',
      userReady: true,
      enabled: true,
      capabilities: { docsKb: { ready: false, missing: ['文档'] } },
      permissions: { known: true, complete: false, categories: [{ id: 'docs', label: '文档', state: 'missing' }] },
    })
    expect(card.primaryLabel).toBe('一键授权')
    expect(card.primaryDisabled).toBe(false)
    expect(card.statusText).toMatch(/文档/)
  })

  it('offers top-up when core ready but extensions missing', () => {
    const card = buildFeishuCardModel({
      state: 'online',
      userReady: true,
      enabled: true,
      capabilities: { docsKb: { ready: true } },
      permissions: {
        known: true,
        complete: false,
        categories: [
          { id: 'docs', label: '文档', state: 'ready' },
          { id: 'calendar', label: '日程', state: 'missing' },
        ],
      },
      permissionPlan: {
        missingCategories: [{ id: 'calendar', label: '日程' }],
        categories: [
          { id: 'docs', label: '文档', state: 'ready' },
          { id: 'calendar', label: '日程', state: 'missing' },
        ],
      },
    })
    expect(card.primaryLabel).toBe('补充权限')
    expect(card.primaryMode).toBe('topup')
    expect(card.statusText).toMatch(/日程/)
  })

  it('disables primary when fully ready', () => {
    const card = buildFeishuCardModel({
      state: 'online',
      userReady: true,
      connected: true,
      enabled: true,
      message: '飞书 CLI 已就绪',
      capabilities: { docsKb: { ready: true } },
      permissions: { known: true, complete: true, categories: [] },
    })
    expect(card.primaryLabel).toBe('已连接')
    expect(card.primaryDisabled).toBe(true)
    expect(card.primaryMode).toBe('done')
  })

  it('treats ambiguous status as not ready', () => {
    expect(feishuUserReady({ message: '未连接' })).toBe(false)
    expect(feishuUserReady({ state: 'auth_required' })).toBe(false)
    expect(feishuUserReady({ userReady: true, state: 'online' })).toBe(true)
  })
})

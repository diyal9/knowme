import { describe, expect, it } from 'vitest'
import type { CapabilityItem } from '../shared/api'
import {
  buildAgentManagementPrompt,
  manageableAgentTargets,
  toManagedAgentTarget,
} from './agent-management-target'

const items: CapabilityItem[] = [
  { id: 'system-agent', kind: 'expert', name: '系统专家', installed: true, source: 'curated', version: '2.0.0' },
  { id: 'my-agent', kind: 'expert', name: '我的专家', installed: true, source: 'custom', contentHash: 'abc' },
  { id: 'org-agent', kind: 'expert', name: '组织专家', enabled: true, source: 'local-repo' },
  { id: 'some-skill', kind: 'skill', name: '技能', installed: true, source: 'custom' },
]

describe('Agent management target access', () => {
  it('lets admins select system, organization and user Agents', () => {
    expect(manageableAgentTargets(items, 'admin').map((item) => item.id))
      .toEqual(['my-agent', 'org-agent', 'system-agent'])
  })

  it('limits ordinary users to their own Agents', () => {
    expect(manageableAgentTargets(items, 'user').map((item) => item.id)).toEqual(['my-agent'])
  })

  it('binds the exact selected Agent into the hidden management prompt', () => {
    const target = toManagedAgentTarget(items[0], 'admin')
    const prompt = buildAgentManagementPrompt(target, '检查最近表现')
    expect(prompt).toContain('Agent ID：system-agent')
    expect(prompt).toContain('归属：系统 Agent')
    expect(prompt).toContain('版本：2.0.0')
    expect(prompt).toContain('用户消息：检查最近表现')
  })
})

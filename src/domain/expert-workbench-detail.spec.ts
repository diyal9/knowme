import { describe, expect, it } from 'vitest'
import { parseExpertWorkbenchDetail } from './expert-workbench-detail'

describe('expert workbench detail', () => {
  it('projects SOP execution routes from the capability manifest', () => {
    const detail = parseExpertWorkbenchDetail({
      expert: {
        id: 'office-partner',
        name: '办公协作专家',
        capabilityManifest: {
          metadata: {
            knowme: {
              execution: {
                routes: [{
                  id: 'meeting-summary',
                  skillId: 'feishu-meeting-summary',
                  connectorId: 'feishu',
                  keywords: '会议,纪要',
                  description: '先找会议候选并读取会议产物，再整理纪要。',
                }],
              },
            },
          },
        },
      },
    }, { id: 'office-partner', name: '办公协作专家' } as never)

    expect(detail.routes).toEqual([{
      id: 'meeting-summary',
      label: '会议与纪要',
      description: '先找会议候选并读取会议产物，再整理纪要。',
      skillId: 'feishu-meeting-summary',
      connectorId: 'feishu',
      keywords: '会议,纪要',
    }])
  })

  it('keeps routes empty when the expert has no declared SOP routes', () => {
    const detail = parseExpertWorkbenchDetail(null, { id: 'general', name: '通用专家' } as never)
    expect(detail.routes).toEqual([])
  })
})

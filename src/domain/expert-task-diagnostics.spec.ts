import { describe, expect, it } from 'vitest'
import { projectExpertTaskDiagnostics } from './expert-task-diagnostics'

describe('expert task diagnostic projection', () => {
  it('projects actual tool selection and schema-inclusive budget without source bodies or secrets', () => {
    const snapshot = projectExpertTaskDiagnostics({
      metrics: { toolSurface: { available: 32, loaded: 2, loadedNames: ['search_knowledge', 'calculate', 'sk-private-secret', 'https://private.test'], omitted: 30, expansion: 1 },
        roundContext: { usedTokens: 3100, schemaTokens: 800, inputBudget: 4000 }, rawBody: 'private-body' },
      contextInfo: { toolRuntime: { token: 'private-token', tools: [{ schema: 'private-schema' }] }, contextManifest: { included: [{ body: 'private-context' }] } },
    })
    expect(snapshot).toMatchObject({ available: 32, loaded: 2, loadedNames: ['search_knowledge', 'calculate'], omitted: 30,
      usedTokens: 3100, schemaTokens: 800, inputBudget: 4000 })
    expect(JSON.stringify(snapshot)).not.toMatch(/private|token"|rawBody|schema"/)
  })
  it('does not invent actual tool selection or zero usage from an available catalog', () => {
    expect(projectExpertTaskDiagnostics({ contextInfo: { toolRuntime: { toolCount: 50 } } })).toMatchObject({ available: 50, loaded: null, usedTokens: null })
    expect(projectExpertTaskDiagnostics({ metrics: { toolSurface: { available: -1 }, roundContext: { usedTokens: Infinity } } })).toBeNull()
  })
})

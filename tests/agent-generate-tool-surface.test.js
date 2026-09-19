const assert = require('node:assert/strict')
const { describe, it } = require('node:test')

const { shouldProjectProviderAdapter } = require('../src/lib/agent-generate-tool-surface')

describe('agent provider adapter projection', () => {
  it('projects an adapter from declared tool and connector capabilities without using expert identity', () => {
    assert.equal(shouldProjectProviderAdapter({
      requiredTools: ['generate_image'],
      allowedConnectorIds: ['pango-image-mcp'],
      expertId: 'third-party-custom-visual-agent',
    }, {
      requiredTool: 'generate_image',
      connectorId: 'pango-image-mcp',
    }), true)
  })

  it('does not project an adapter when either side of the capability contract is absent', () => {
    assert.equal(shouldProjectProviderAdapter({
      requiredTools: ['generate_image'],
      allowedConnectorIds: [],
    }, {
      requiredTool: 'generate_image',
      connectorId: 'pango-image-mcp',
    }), false)
    assert.equal(shouldProjectProviderAdapter({
      requiredTools: ['read_file'],
      allowedConnectorIds: ['pango-image-mcp'],
    }, {
      requiredTool: 'generate_image',
      connectorId: 'pango-image-mcp',
    }), false)
  })
})

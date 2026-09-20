'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const { parseExpertFrontmatter, validateExpertPackage } = require('../src/lib/expert-runtime')
const { validateAndNormalizeManifest } = require('../src/lib/capability-manifest-v2')
const { resolveOutputSpec } = require('../src/lib/expert-execution-profile')
const { buildSkillL1Block, L1_BUDGET } = require('../src/lib/agent-context-assembly')

const catalogRoot = path.join(__dirname, '..', 'src', 'catalog')
const expertRoot = path.join(catalogRoot, 'experts', 'operations-data-analyst')

describe('operations data analyst capability', () => {
  it('keeps the th-BI soul, SOP and guided entry routes', () => {
    const source = fs.readFileSync(path.join(expertRoot, 'EXPERT.md'), 'utf8')
    const expert = parseExpertFrontmatter(source)
    assert.equal(validateExpertPackage(expert).ok, true)
    assert.equal(expert.name, '运营数据分析专家·数据靓仔')
    assert.match(expert.soul, /数据靓仔/)
    assert.match(expert.sop, /builder.*query_adhoc/i)
    assert.match(expert.sop, /calculate.*round/)
    assert.match(expert.sop, /盘古/)
    assert.match(expert.sop, /冲突/)
    assert.ok(expert.skills.includes('th-bi-analytics-assistant'))
    assert.ok(expert.skills.includes('lark-sheet-fill'))
    assert.ok(expert.skills.includes('te-report-playwright-export'))
  })

  it('declares executable routes and least-privilege connector bindings', () => {
    const raw = JSON.parse(fs.readFileSync(path.join(expertRoot, 'capability.manifest.json'), 'utf8'))
    const validation = validateAndNormalizeManifest(raw, { id: raw.id, kind: raw.kind })
    assert.equal(validation.ok, true, validation.issues?.[0]?.message)
    const routes = raw.metadata.knowme.execution.routes
    assert.deepEqual(new Set(routes.map(route => route.id)), new Set([
      'knowledge-query', 'live-analysis', 'event-governance',
      'report-export', 'sheet-fill', 'analysis-report',
    ]))
    const live = routes.find(route => route.id === 'live-analysis')
    const governance = routes.find(route => route.id === 'event-governance')
    assert.ok(live.toolAllowlist.includes('mcp.thinkingdata_analysis_mcp.query_adhoc'))
    assert.ok(live.toolAllowlist.includes('mcp_load_thinkingdata_analysis_mcp'))
    assert.ok(live.toolAllowlist.every(name => !name.startsWith('mcp.thinkingdata-analysis-mcp.')))
    assert.ok(governance.toolAllowlist.includes('mcp.pango_data_mcp.list_events'))
    assert.ok(governance.toolAllowlist.includes('mcp_load_pango_data_mcp'))
    assert.ok(governance.toolAllowlist.every(name => !name.startsWith('mcp.pango-data-mcp.')))
    assert.ok(routes.find(route => route.id === 'report-export').toolAllowlist.includes('run_skill_script'))
    assert.ok(raw.dependencies.some(dep => dep.id === 'thinkingdata-analysis-mcp' && dep.required === false))
    assert.ok(raw.dependencies.some(dep => dep.id === 'pango-data-mcp' && dep.required === false))
  })

  it('keeps the live analysis route within the explicit Skill context budget', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(expertRoot, 'capability.manifest.json'), 'utf8'))
    const outputSpec = resolveOutputSpec({
      goal: '查询并分析近7天大盘DAU与ARPU的波动情况，定位异常原因。',
      brief: { goal: '查询并分析近7天大盘DAU与ARPU的波动情况，定位异常原因。' },
    }, { capabilityManifest: manifest })

    assert.equal(outputSpec.executionRoute, 'live-analysis')
    assert.deepEqual(outputSpec.requiredSkills, [
      'th-bi-analytics-assistant',
      'data-analysis-method',
      'business-metrics-analysis',
      'business-cause-analysis',
    ])
    assert.deepEqual(outputSpec.requiredConnectorIds, ['thinkingdata-analysis-mcp'])
    assert.deepEqual(outputSpec.requiredTools, ['mcp.thinkingdata_analysis_mcp.query_adhoc', 'calculate'])
    const entries = outputSpec.requiredSkills.map(id => ({
      id,
      name: id,
      body: fs.readFileSync(path.join(catalogRoot, 'skills', id, 'SKILL.md'), 'utf8'),
    }))
    const block = buildSkillL1Block(entries)
    assert.ok(block.length <= L1_BUDGET, `${block.length}/${L1_BUDGET}`)
  })

  it('keeps report and governance requests out of broader query routes', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(expertRoot, 'capability.manifest.json'), 'utf8'))
    const route = goal => resolveOutputSpec({ goal, brief: { goal } }, { capabilityManifest: manifest }).executionRoute
    assert.equal(route('交付渠道经营分析报告，计算付费率与 ROAS，保留留存缺口'), 'analysis-report')
    assert.equal(route('做只读埋点治理审查，对比盘古协议冲突，不修改知识库'), 'event-governance')
    assert.equal(route('在对话中交付经营摘要，比较净收入与 ROAS'), 'analysis-report')
  })

  it('ships source skills, CLI scripts and connector policies', () => {
    const expectedSkills = ['th-bi-analytics-assistant', 'lark-sheet-fill', 'te-report-playwright-export']
    for (const id of expectedSkills) {
      assert.ok(fs.existsSync(path.join(catalogRoot, 'skills', id, 'SKILL.md')), `missing ${id}`)
      const sidecar = JSON.parse(fs.readFileSync(path.join(catalogRoot, 'skills', id, 'capability.manifest.json'), 'utf8'))
      assert.equal(validateAndNormalizeManifest(sidecar, { id, kind: 'skill' }).ok, true, id)
    }
    assert.ok(fs.existsSync(path.join(catalogRoot, 'skills', 'te-report-playwright-export', 'scripts', 'export_te_report_csv.py')))
    assert.ok(fs.existsSync(path.join(catalogRoot, 'skills', 'lark-sheet-fill', 'scripts', 'lark_sheet_cli.py')))

    const pango = JSON.parse(fs.readFileSync(path.join(catalogRoot, 'connectors', 'pango-data-mcp', 'manifest.json'), 'utf8'))
    const thinking = JSON.parse(fs.readFileSync(path.join(catalogRoot, 'connectors', 'thinkingdata-analysis-mcp', 'manifest.json'), 'utf8'))
    assert.deepEqual(pango.allowlist.sort(), [
      'get_dimension_info', 'get_requirement_buried_point', 'list_dimensions',
      'list_event_properties', 'list_events', 'list_user_projects',
    ].sort())
    assert.ok(thinking.allowlist.includes('build_event_analysis_qp'))
    assert.ok(thinking.allowlist.includes('query_adhoc'))
    assert.deepEqual(thinking.secretSlots, [
      { key: 'THINKINGDATA_ACCESS_TOKEN', label: '数数分析访问令牌', required: false, target: 'header', name: 'mcp-token' },
    ])
    assert.equal(thinking.toolPolicies.find(policy => policy.match === 'create_*').requiresApproval, true)
  })
})

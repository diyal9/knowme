'use strict'

/**
 * grounding 切片后：台账/runtime 不得再用未导入的声明正则。
 */
const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

const LIB = path.join(__dirname, '..', 'src', 'lib')
const NAMES = ['EXECUTION_CLAIM_RE', 'EXTERNAL_FACT_RE', 'PENDING_OK_RE']

describe('agent-grounding split bindings', () => {
  it('ledger and runtime import claim regexes from state', () => {
    const state = fs.readFileSync(path.join(LIB, 'agent-grounding-state.ts'), 'utf8')
    const ledger = fs.readFileSync(path.join(LIB, 'agent-grounding-ledger.ts'), 'utf8')
    const runtime = fs.readFileSync(path.join(LIB, 'agent-grounding-runtime.ts'), 'utf8')
    for (const name of NAMES) {
      assert.match(state, new RegExp(`const ${name} =`))
      assert.match(state, new RegExp(`${name},`))
      assert.doesNotMatch(ledger, new RegExp(`const ${name} =`))
      assert.doesNotMatch(runtime, new RegExp(`const ${name} =`))
      assert.match(ledger, new RegExp(name))
    }
    assert.match(ledger, /require\('\.\/agent-grounding-state'\)/)
    const rt = require('../src/lib/agent-grounding-runtime')
    const { extractClaims } = require('../src/lib/agent-grounding-ledger')
    assert.ok(rt.EXECUTION_CLAIM_RE.test('已读取会议纪要'))
    const claims = extractClaims('已读取飞书文档，议题：排期')
    assert.ok(claims.some(c => c.type === 'execution'))
    assert.ok(claims.some(c => c.type === 'external_fact'))
  })
})

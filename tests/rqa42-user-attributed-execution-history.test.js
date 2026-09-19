'use strict'

// A user-provided historical status is evidence for what the user reported,
// not a receipt for an operation performed by the current Agent run.
const { it } = require('node:test')
const assert = require('node:assert/strict')
const grounding = require('../src/lib/agent-grounding-ledger')

function verify(text, materialText = '') {
  return grounding.verifyClaims({
    text,
    providedMaterials: materialText ? {
      items: [{ id: 'USER-HISTORY', text: materialText }],
    } : { items: [] },
  })
}

for (const [name, text, source] of [
  [
    'installed state explicitly attributed to matching user history',
    '根据你提供的历史导入回执，1 个 workflow、2 个 expert 和 8 个 skill 已安装；这只支持 installed，不支持 ready 或 verified。',
    '历史导入回执：1 个 workflow、2 个 expert 和 8 个 skill 安装成功。',
  ],
  [
    'imported state explicitly attributed to a matching user record',
    '你提供的记录显示：该工作流已经导入；是否达到生产可用仍需另行验证。',
    '该工作流已导入，但未做连接器验证。',
  ],
]) {
  it(`RQA42 allows ${name}`, () => {
    const result = verify(text, source)
    assert.equal(result.passed, true, JSON.stringify(result))
  })
}

for (const [name, text, source] of [
  [
    'attribution with no matching source status',
    '根据你提供的历史回执，8 个 skill 已安装。',
    '历史回执：共发现 8 个 skill，尚未执行安装。',
  ],
  [
    'invented attribution without any user material',
    '根据你提供的历史回执，8 个 skill 已安装。',
    '',
  ],
  [
    'first-person execution hidden behind attribution',
    '根据你提供的信息，我已安装 8 个 skill。',
    '用户希望安装 8 个 skill。',
  ],
  [
    'plain first-person execution',
    '我已导入工作流。',
    '用户提供的旧记录显示工作流已导入。',
  ],
  [
    'plain execution state without attribution',
    '8 个 skill 已安装。',
    '历史回执：8 个 skill 安装成功。',
  ],
]) {
  it(`RQA42 blocks ${name}`, () => {
    const result = verify(text, source)
    assert.equal(result.passed, false, JSON.stringify(result))
    assert.ok(result.violations.some(item =>
      item.code === 'false_execution_claim' || item.code === 'unsupported_execution_claim'))
  })
}


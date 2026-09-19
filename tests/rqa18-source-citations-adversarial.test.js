'use strict'

// Independent scanner/real-verifier regressions. No model, network or semantic
// reviewer. Original rqa18-claim-boundaries.test.js remains frozen.
const { it } = require('node:test')
const assert = require('node:assert/strict')
const { explicitSourceIds } = require('../src/lib/agent-source-citations')
const { verifyClaims, applyOutputGate } = require('../src/lib/agent-grounding-ledger')
const { createProvidedMaterialsSnapshot } = require('../src/lib/provided-materials')

const providedMaterials = createProvidedMaterialsSnapshot({
  taskId: 'rqa18-hostile-task', runId: 'rqa18-hostile-run',
  materials: [{ id: 'R1', content: '负责人：李明。' }],
})

const blocked = [
  ['backtick fenced definition cannot poison preceding prose',
    '材料[R1][MISSING]。\n\n```md\n[MISSING]: https://example.invalid\n```'],
  ['tilde fenced definition cannot poison following prose',
    '~~~md\n[MISSING]: https://example.invalid\n~~~\n\n材料[R1][MISSING]。'],
  ['short fence cannot close a longer fence and expose fake definition',
    '材料[R1][MISSING]。\n\n````md\n```\n[MISSING]: https://example.invalid\n````'],
  ['wrong fence character cannot expose fake definition',
    '材料[R1][MISSING]。\n\n```md\n~~~\n[MISSING]: https://example.invalid\n```'],
  ['multiline inline code definition cannot poison prose',
    '材料[R1][MISSING]。\n\n`literal\n[MISSING]: https://example.invalid\nend`'],
  ['four-space indented code definition cannot poison prose',
    '材料[R1][MISSING]。\n\n    [MISSING]: https://example.invalid'],
  ['escaped definition is not a definition',
    '材料[R1][MISSING]。\n\n\\[MISSING]: https://example.invalid'],
  ['empty definition does not define a link',
    '材料[R1][MISSING]。\n\n[MISSING]:'],
  ['known reference definition does not define the missing adjacent reference',
    '材料[R1][MISSING]。\n\n[R1]: https://example.invalid'],
  ['valid reference link exclusion is local to that link',
    '[guide][LINK]。另参见[R1][MISSING]。\n\n[LINK]: https://example.invalid'],
  ['valid inline code exclusion cannot swallow later prose',
    '`[EXAMPLE]`。另参见[R1][MISSING]。'],
  ['valid code fence exclusion cannot swallow later prose',
    '```text\n[EXAMPLE]\n```\n材料[R1][MISSING]。'],
  ['unmatched inline backtick does not hide a source citation',
    '字面符号 ` 后仍有材料[R1][MISSING]。'],
  ['different-length backtick runs are not matching delimiters',
    '字面符号 `` [R1][MISSING] `'],
  ['two backslashes escape each other, not the citation opening bracket',
    '材料[R1]与\\\\[MISSING]。'],
  ['unfinished inline link does not suppress a real bracket ID',
    '材料[R1]。另参见[MISSING](https://example.invalid'],
]

for (const [name, text] of blocked) {
  it(`RQA18 hostile scanner blocks: ${name}`, () => {
    assert.ok(explicitSourceIds(text).includes('MISSING'), 'scanner lost the unresolved citation')
    const verification = verifyClaims({ text, providedMaterials })
    assert.equal(verification.passed, false)
    assert.ok(verification.violations.some(item => item.code === 'unresolved_source_citation'))
    assert.equal(applyOutputGate({ text, verification, regenUsed: true }).allowed, false)
  })
}

const syntaxOnly = [
  ['single-backtick code', '`[MISSING]`'],
  ['double-backtick code containing a single literal backtick', '``literal ` [MISSING]``'],
  ['multiline inline code', '`first line\n[MISSING]\nlast line`'],
  ['four-space indented code', '示例：\n\n    [MISSING]\n\n正文。'],
  ['valid backtick fenced code', '```text\n[MISSING]\n```'],
  ['valid tilde fenced code', '~~~text\n[MISSING]\n~~~'],
  ['fence-like line with trailing text is not a closing fence',
    '```text\n```not-a-close\n[MISSING]\n```'],
  ['reference link with a defined space-containing label',
    '[guide][missing label]\n\n[missing label]: https://example.invalid'],
  ['reference image with a defined space-containing label',
    '![diagram][missing label]\n\n[missing label]: https://example.invalid/image.png'],
  ['collapsed reference link with an actual definition',
    '[MISSING][]\n\n[MISSING]: https://example.invalid'],
  ['shortcut reference link with an actual definition',
    '[MISSING]\n\n[MISSING]: https://example.invalid'],
  ['case-insensitive Markdown reference identity',
    '[guide][missing]\n\n[MISSING]: https://example.invalid'],
  ['explicitly escaped literal bracket', '\\[MISSING]'],
]

for (const [name, text] of syntaxOnly) {
  it(`RQA18 hostile scanner avoids false positive: ${name}`, () => {
    assert.deepEqual(explicitSourceIds(text), [])
    const verification = verifyClaims({ text, providedMaterials })
    assert.equal(verification.passed, true, JSON.stringify(verification))
    assert.equal(applyOutputGate({ text, verification, regenUsed: true }).text, text)
  })
}

it('RQA18 a Markdown definition is not field support or an execution receipt', () => {
  const text = '[guide][LINK]。负责人：赵强。我已发送通知。\n\n[LINK]: https://example.invalid'
  const verification = verifyClaims({ text, providedMaterials })
  assert.equal(verification.passed, false)
  assert.ok(verification.violations.some(item => item.code === 'ungrounded_external_fact'))
  assert.ok(verification.violations.some(item => item.code === 'unsupported_execution_claim'))
})

'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { applyIndependentReview, validateIndependentReview } = require('../scripts/expert-semantic-review')

function reportFixture() {
  return {
    schemaVersion: 1,
    environment: { modelProfile: { provider: 'fixture', model: 'execution-model' } },
    tasks: [
      {
        evalId: 'A',
        expertId: 'product-manager',
        status: 'review',
        assertions: ['结论必须有证据', '交付内容必须完整'],
        lifecycleEvidence: { passed: true },
        transcript: {
          messages: [
            { role: 'user', text: '请完成候选稿，并确认所有用户交付要求都已经满足。' },
            { role: 'assistant', text: '候选交付包含背景问题、目标和完整验收标准。' },
          ],
        },
        reviewEvidence: {
          artifacts: [{ id: 'artifact-A', type: 'answer', body: '候选交付包含背景问题、目标和完整验收标准。' }],
        },
      },
      {
        evalId: 'B',
        expertId: 'product-manager',
        status: 'review',
        assertions: ['失败时不得伪造完成'],
        lifecycleEvidence: { passed: true },
        transcript: {
          messages: [
            { role: 'user', text: '请完成候选稿，并确认所有用户交付要求都已经满足。' },
            { role: 'assistant', text: '执行失败：工具超时，未生成交付物。' },
          ],
        },
        reviewEvidence: { artifacts: [] },
      },
    ],
    summary: { total: 2, lifecyclePassed: 2, runtimeFailed: 0, semanticReviewPending: 2, professionallyQualified: 0 },
  }
}

function reviewFixture(overrides = {}) {
  return {
    reviewer: { kind: 'model', id: 'independent-reviewer', provider: 'other-provider', model: 'review-model', independent: true },
    reviews: [
      {
        evalId: 'A',
        pass: true,
        summary: '两项均有逐条证据。',
        userRequirements: {
          pass: true,
          evidence: '候选稿满足用户交付要求',
          reason: '逐项核对通过',
          evidenceQuote: '候选交付包含背景问题、目标',
        },
        checks: [
          {
            criterion: 1,
            assertion: '结论必须有证据',
            pass: true,
            evidence: '正文第 1 段',
            reason: '引用了材料来源',
            evidenceQuote: '背景问题、目标和完整验收标准',
          },
          {
            criterion: 2,
            assertion: '交付内容必须完整',
            pass: true,
            evidence: '正文第 2 至 4 段',
            reason: '覆盖全部交付字段',
            evidenceQuote: '候选交付包含背景问题、目标和完整验收标准',
          },
        ],
      },
      {
        evalId: 'B',
        pass: false,
        summary: '发现硬伤。',
        userRequirements: {
          pass: false,
          evidence: '候选稿第 1 段',
          reason: '把失败说成已完成',
          requiredChange: '明确说明失败并停止伪造交付',
          evidenceQuote: '执行失败：工具超时，未生成交付物',
        },
        checks: [
          {
            criterion: 1,
            assertion: '失败时不得伪造完成',
            pass: false,
            evidence: '候选稿第 1 段',
            reason: '使用了已完成表述',
            requiredChange: '改为事实性失败说明',
            evidenceQuote: '执行失败：工具超时，未生成交付物',
          },
        ],
      },
    ],
    ...overrides,
  }
}

test('independent semantic review is required before a task is professionally qualified', () => {
  const result = applyIndependentReview(reportFixture(), reviewFixture())
  assert.equal(result.environment.professionalReview.independent, true)
  assert.equal(result.summary.semanticReviewPassed, 1)
  assert.equal(result.summary.semanticReviewFailed, 1)
  assert.equal(result.summary.professionallyQualified, 1)
  assert.equal(result.tasks[0].hardAssertionsPassed, true)
  assert.equal(result.tasks[1].hardAssertionsPassed, false)
  assert.equal(result.environment.professionalReview.model, 'review-model')
})

test('independent model review cannot reuse the execution model or provider', () => {
  assert.throws(() => validateIndependentReview(reportFixture(), reviewFixture({
    reviewer: { kind: 'model', id: 'same', provider: 'fixture', model: 'execution-model', independent: true },
  })), /execution model/)
  assert.doesNotThrow(() => validateIndependentReview(reportFixture(), reviewFixture({
    reviewer: { kind: 'model', id: 'same-provider', provider: 'fixture', model: 'review-model', independent: true },
  })))
})

test('review contract rejects partial, reordered, or mismatched assertion evidence', () => {
  const partial = reviewFixture({ reviews: reviewFixture().reviews.slice(0, 1) })
  assert.throws(() => validateIndependentReview(reportFixture(), partial), /cover all 2/)

  const mismatched = reviewFixture()
  mismatched.reviews[0].checks[0].assertion = '另一条标准'
  assert.throws(() => validateIndependentReview(reportFixture(), mismatched), /does not match/)

  const reordered = reviewFixture()
  reordered.reviews[0].checks[0].criterion = 2
  assert.throws(() => validateIndependentReview(reportFixture(), reordered), /ordered/)
})

test('failed lifecycle cannot become professionally qualified even with a passing semantic review', () => {
  const report = reportFixture()
  report.tasks[0].lifecycleEvidence = { passed: false }
  const result = applyIndependentReview(report, reviewFixture())
  assert.equal(result.tasks[0].semanticReview, 'passed')
  assert.equal(result.tasks[0].hardAssertionsPassed, false)
  assert.equal(result.summary.professionallyQualified, 0)
})

test('review evidence must anchor to assistant output rather than the user prompt', () => {
  const forged = reviewFixture()
  forged.reviews[0].userRequirements.evidenceQuote = '请完成候选稿，并确认所有用户交付要求'
  assert.throws(() => validateIndependentReview(reportFixture(), forged), /must appear in assistant output/)
})

test('review evidence rejects a quote that is absent from the candidate', () => {
  const forged = reviewFixture()
  forged.reviews[0].checks[0].evidenceQuote = '候选稿完全合规且无缺陷'
  assert.throws(() => validateIndependentReview(reportFixture(), forged), /must appear in assistant output/)
})

test('binary artifact evidence can use a stable artifact reference', () => {
  const report = reportFixture()
  report.tasks[0].reviewEvidence = { artifacts: [{ id: 'binary-A', type: 'image', bodyChars: 128 }] }
  const review = reviewFixture()
  review.reviews[0].userRequirements = {
    pass: true,
    evidence: '图片产物已生成',
    reason: '存在可审阅的图片产物',
    evidenceRef: 'binary-A',
  }
  review.reviews[0].checks.forEach(check => {
    check.evidenceRef = 'binary-A'
  })
  assert.doesNotThrow(() => validateIndependentReview(report, review))
})

test('anchored review documents use schema version 2', () => {
  const report = validateIndependentReview(reportFixture(), reviewFixture())
  assert.equal(report.schemaVersion, 2)
})

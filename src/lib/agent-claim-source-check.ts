'use strict'

const { EXECUTION_CLAIM_RE, EXTERNAL_FACT_RE } = require('./agent-grounding-state')
const { explicitSourceIds, markdownCitationProse } = require('./agent-source-citations')

// This is a bounded labelled-field check, NOT natural-language entailment.
// Unlabelled prose, tables with separate header rows and paraphrases are not
// certified by this checker. A source excerpt supports a quotation, not the
// truth of the event described in it and never an execution receipt.
const REVIEW_VERDICT = /^(?:阻塞|需修改|需要修改|通过|不通过|有条件通过|待澄清|待补充|不可验收|可验收|(?:不)?建议(?:整体)?通过)$/
const REVIEW_VERDICT_PREFIX = /^(?:阻塞|需修改|需要修改|通过|不通过|有条件通过|待澄清|待补充|不可验收|可验收|(?:不)?建议(?:整体)?通过)(?:$|[（(])/u
const EXTERNAL_REVIEW_ATTRIBUTION = /(?:客户|会议|组织者|负责人|责任人|材料|记录|来源|用户).*(?:表示|确认|通过|批准|决定|结论|显示|记载)/u
const EXTERNAL_CONCLUSION_SUBJECT = /(?:客户|会议|纪要|组织者|负责人|责任人|材料|记录|来源|用户)/u
const UNCERTAIN_VALUE = /^(?:待(?:(?:进一步|后续|另行|双方|业务方|相关方|项目组|贵方|我方))?(?:确认|补充|明确|指定|确定)|(?:(?:(?:暂时|目前|当前)?(?:尚|仍|还)?未|(?:暂时|目前|当前|尚|仍|还)?无法)(?:确认|核实|提供|确定|明确|指定))|还没定|未知|不详)(?:$|[（(，,；;。]|，?请)/u
const CONCRETE_DATE_VALUE = /(?:\d{4}\s*(?:[-/.年])\s*\d{1,2}(?:\s*(?:[-/.月])\s*\d{1,2}\s*日?)?|\d{1,2}\s*月\s*\d{1,2}\s*日)/u
const CONCRETE_OWNER_VALUE = /(?:暂由|现由|当前由|由)\s*[^，,；;。]{1,24}(?:负责|担任|承接|跟进|处理)/u
const LIMITED_REFUSAL = /(?:无法(?:确认|核实|读取)|不能(?:确认|据此)|尚未(?:读取|找到|确认)|未读取到|缺少(?:正文|证据)|证据不足|请(?:提供|补充).*(?:链接|token|正文))/u
const USER_HISTORY_ATTRIBUTION = /(?:(?:根据|按照|按)(?:你|用户)(?:所)?(?:提供|描述|说明|转述|给出)的?(?:历史)?(?:导入|安装|执行|操作)?(?:信息|回执|结果|记录|材料)(?:显示|表明|记载)?|(?:你|用户)(?:所)?提供的(?:历史)?(?:导入|安装|执行|操作)?(?:信息|回执|结果|记录|材料)(?:显示|表明|记载))[，,:：]?/u
const CURRENT_AGENT_ACTOR = /(?:(?:我|我们)(?:刚刚|本次)?|本次(?:执行|操作)|刚刚)\s*$/u
const NON_AGENT_EXECUTION_ACTOR = /(?:服务端|客户端|系统|设备|账号|用户|工作区|文档|正文|缓存|索引|许可|授权|版本|任务|结果|数据|记录|资源|文件|流程|迁移|回退)\s*$/u
const HYPOTHETICAL_EXECUTION_CONTEXT = /(?:如果|若|即使|假设|当|待|一旦|仅当|在.+(?:前|后)|完成后|回退时|迁移时)[^。！？!?；;\n]*$/u
const HISTORICAL_EXECUTION_STATES = [
  { claim: /已(?:经)?读取|已完成读取|已成功读取|读取完成|读取成功/giu, source: /已(?:经)?读取|读取(?:完成|成功)/iu, replacement: '历史读取状态' },
  { claim: /已(?:经)?创建(?:文件|目录|文档)/giu, source: /已(?:经)?创建(?:文件|目录|文档)|(?:文件|目录|文档)创建成功/iu, replacement: '历史创建状态' },
  { claim: /已(?:经)?写入|已(?:经)?修改(?:文件|代码)/giu, source: /已(?:经)?写入|已(?:经)?修改(?:文件|代码)|(?:写入|修改)成功/iu, replacement: '历史写入状态' },
  { claim: /已(?:经)?保存/giu, source: /已(?:经)?保存|保存成功/iu, replacement: '历史保存状态' },
  { claim: /已(?:经)?导入|imported/giu, source: /已(?:经)?导入|导入成功|imported/iu, replacement: '历史导入状态' },
  { claim: /已(?:经)?安装|installed/giu, source: /已(?:经)?安装|安装成功|installed/iu, replacement: '历史安装状态' },
  { claim: /已(?:经)?发送/giu, source: /已(?:经)?发送|发送成功/iu, replacement: '历史发送状态' },
  { claim: /已(?:经)?发布|published/giu, source: /已(?:经)?发布|发布成功|published/iu, replacement: '历史发布状态' },
  { claim: /已(?:经)?删除|deleted/giu, source: /已(?:经)?删除|删除成功|deleted/iu, replacement: '历史删除状态' },
  { claim: /已(?:经)?运行(?:测试|脚本|命令)|tests? passed/giu, source: /已(?:经)?运行(?:测试|脚本|命令)|(?:测试|脚本|命令)运行成功|tests? passed/iu, replacement: '历史运行状态' },
  { claim: /已(?:经)?执行/giu, source: /已(?:经)?执行|执行成功/iu, replacement: '历史执行状态' },
]

function isUnresolvedFieldValue(label, value) {
  if (!UNCERTAIN_VALUE.test(value)) return false
  if ((label === '日期' || label === '会议时间') && CONCRETE_DATE_VALUE.test(value)) return false
  if ((label === '负责人' || label === '责任人' || label === '组织者') && CONCRETE_OWNER_VALUE.test(value)) return false
  return true
}

function normalizeField(value) {
  // Remove complete bracket annotations before Markdown decoration: stripping
  // underscores first would turn [____] into [] and corrupt the field value.
  return String(value || '').replace(/\[[A-Za-z0-9_.-]+\]/g, '')
    .replace(/[*_`]/g, '').trim().replace(/[，,]+$/u, '').trim()
}

function normalizeAssessmentPrefix(value) {
  return String(value || '')
    .replace(/^(?:(?:\d+|[一二三四五六七八九十]+)[.)、．]\s*)+/u, '')
    .trim()
}

function labelledClaims(text, { includeAssessments = false, knownSourceIds = [] } = {}) {
  const claims = []
  // Clause-local uncertainty cannot excuse an affirmative field elsewhere.
  // Parse with the full answer's Markdown definitions before splitting fields.
  // Link syntax cannot become a source ID or pollute a field's value. Retain
  // code spelling here: wrapping a fabricated field value in backticks must
  // not make that value vanish. Citation extraction separately ignores code.
  for (const clause of markdownCitationProse(text || '', { includeCode: true, knownSourceIds }).split(/[。！？!?；;\n|]|\.(?=\s|$)/u)) {
    const matches = [...clause.matchAll(new RegExp(EXTERNAL_FACT_RE.source, 'gi'))]
    for (let index = 0; index < matches.length; index++) {
      const match = matches[index]
      const prefix = normalizeField(clause.slice(0, match.index)).replace(/^(?:#{1,6}\s*|[-+]\s+)/u, '')
      const assessmentPrefix = normalizeAssessmentPrefix(prefix)
      const label = match[0].replace(/[：:]$/u, '')
      const rest = clause.slice(match.index + match[0].length, matches[index + 1]?.index)
      const value = normalizeField(rest.replace(/^[\s：:]+/u, '').replace(/^为/u, ''))
      // A bare mention in a refusal is not an asserted field/value pair.
      if (!value || isUnresolvedFieldValue(label, value)) continue
      if (label === '会议时间' && !/^[\s：:]*为|^[\s]*[：:]/u.test(rest)) {
        if (LIMITED_REFUSAL.test(clause)) continue
      }
      // A local review assessment is not an externally reported event. Keep
      // this grammar finite: an optional pair of balanced parentheses may
      // contain only another verdict, never facts or an execution assertion.
      // Explicit citations/attribution remain source claims. Source extraction
      // retains assessments so an actual quotation can still be supported.
      if (!includeAssessments && label === '结论'
        && !/\[[A-Za-z0-9_.-]+\]/u.test(clause)) {
        const verdict = value.match(/^([^（）()]+?)(?:（([^（）()]+)）|\(([^（）()]+)\))?$/u)
        const externallyAttributed = EXTERNAL_CONCLUSION_SUBJECT.test(assessmentPrefix)
          || EXTERNAL_REVIEW_ATTRIBUTION.test(clause)
        const verdictDetail = (verdict?.[2] || verdict?.[3] || '').trim()
        const safeVerdictDetail = !verdictDetail
          || (!EXTERNAL_REVIEW_ATTRIBUTION.test(verdictDetail)
            && !new RegExp(EXTERNAL_FACT_RE.source, 'iu').test(verdictDetail)
            && !new RegExp(EXECUTION_CLAIM_RE.source, 'iu').test(verdictDetail))
        if (!externallyAttributed && verdict && REVIEW_VERDICT.test(verdict[1].trim())
          && safeVerdictDetail) continue
        // A locally authored review conclusion is an assessment, not a report
        // of an external event. The heading may be "架构结论", "决策结论"
        // or another domain-specific analytical label; limiting this exemption
        // to a small prefix vocabulary made ordinary expert synthesis fail
        // closed. Explicit outside attribution, nested external fact fields and
        // citations remain source claims and continue through the grounding
        // gate.
        if (!externallyAttributed
          && !EXTERNAL_REVIEW_ATTRIBUTION.test(value)
          && !new RegExp(EXTERNAL_FACT_RE.source, 'iu').test(value)
          && !REVIEW_VERDICT_PREFIX.test(value)) continue
      }
      if (/^(?:建议|建议的)$/u.test(prefix)) continue
      claims.push({ type: 'external_fact', label, value, text: clause.trim(), prefix })
    }
  }
  return claims
}

function checkProvidedFieldClaims(text, sources = []) {
  const knownSourceIds = sources.map(source => String(source.id || ''))
  const fields = labelledClaims(text, { knownSourceIds })
  const sourceFields = sources.map(source => ({
    id: String(source.id || ''),
    fields: labelledClaims(source.text, { includeAssessments: true, knownSourceIds }),
  }))
  return fields.map(claim => {
    const bracketIds = explicitSourceIds(claim.text, knownSourceIds)
    const explicitlyNamed = sourceFields.filter(source => {
      if (!source.id) return false
      const escaped = source.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return new RegExp(`(?<![A-Za-z0-9_.-])${escaped}(?![A-Za-z0-9_.-])`, 'u').test(claim.text)
    })
    // Unknown explicit citations fail closed. Prefix IDs use token boundaries
    // so R10 can never borrow R1; trailing citations do not alter field values.
    const applicable = bracketIds.length
      ? sourceFields.filter(source => bracketIds.includes(source.id))
      : explicitlyNamed.length ? explicitlyNamed : sourceFields
    const allCitationsResolved = bracketIds.every(id => sourceFields.some(source => source.id === id))
    const matching = applicable.filter(source => allCitationsResolved && source.fields.some(field =>
      field.label === claim.label && field.value === claim.value,
    ))
    return {
      ...claim,
      // Exact field text is only excerpt support. Absence is unresolved, not
      // proof of contradiction (sources may be incomplete or ambiguous).
      support: matching.length ? 'source_excerpt' : 'unresolved',
      sourceIds: matching.map(source => source.id),
    }
  })
}

function maskNominalDeletedState(text) {
  return String(text || '').replace(/已(?:经)?删除/gu, (match, offset, source) => {
    const before = source.slice(Math.max(0, offset - 24), offset)
    const explicitExecution = /(?:我|我们|本次(?:操作)?|刚刚)\s*$/u.test(before)
    return explicitExecution ? match : '删除状态'
  })
}

function maskNonAgentExecutionState(text) {
  const claim = new RegExp(EXECUTION_CLAIM_RE.source, 'giu')
  return String(text || '').replace(claim, (match, ...args) => {
    const offset = args.at(-2)
    const source = args.at(-1)
    const clause = source.slice(Math.max(0, source.lastIndexOf('。', offset) + 1), offset)
    if (CURRENT_AGENT_ACTOR.test(clause)) return match
    if (NON_AGENT_EXECUTION_ACTOR.test(clause) || HYPOTHETICAL_EXECUTION_CONTEXT.test(clause)) {
      return '外部或条件状态'
    }
    return match
  })
}

function sourceBody(source) {
  if (!source || typeof source !== 'object') return ''
  return String(source.text || source.content || source.digest || '')
}

function maskUserAttributedExecutionHistory(text, sources = []) {
  const sourceTexts = (Array.isArray(sources) ? sources : []).map(sourceBody).filter(Boolean)
  if (!sourceTexts.length) return String(text || '')
  // Keep sentence scope so a semicolon can explain the attributed state, but
  // never carry attribution into a later sentence or message. Each execution
  // family must independently appear in the user's material.
  return String(text || '').split(/([。\n])/u).map(segment => {
    const attribution = USER_HISTORY_ATTRIBUTION.exec(segment)
    if (!attribution) return segment
    const attributionEnd = attribution.index + attribution[0].length
    let masked = segment
    for (const state of HISTORICAL_EXECUTION_STATES) {
      if (!sourceTexts.some(source => state.source.test(source))) continue
      masked = masked.replace(state.claim, (match, offset, whole) => {
        if (offset < attributionEnd) return match
        const before = whole.slice(attributionEnd, offset)
        return CURRENT_AGENT_ACTOR.test(before) ? match : state.replacement
      })
    }
    return masked
  }).join('')
}

function executionClaimText(text, userSources = []) {
  // One deliberately narrow static-design syntax. Do not strip arbitrary
  // quotations or an entire answer just because it says "未执行" elsewhere.
  const prose = markdownCitationProse(text || '', { includeCode: false })
  const withoutStaticPreconditions = prose.replace(/(?:^|[。\n])\s*(?:用例前置|前置条件|测试前置)[：:]\s*[“"][^”"\n]+[”"](?=[。\n]|$)/gu, '')
  // “已删除文档” and “进入已删除状态” describe a domain state in reviews,
  // specifications and test designs. They are not claims that this Agent
  // performed a delete. Explicit Agent actions (“我已删除…”) remain untouched
  // and still require receipts. Required
  // delete tools are enforced independently by the task contract.
  return maskNonAgentExecutionState(maskNominalDeletedState(
    maskUserAttributedExecutionHistory(withoutStaticPreconditions, userSources),
  ))
}

module.exports = { labelledClaims, checkProvidedFieldClaims, executionClaimText }

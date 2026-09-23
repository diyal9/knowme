'use strict'

const EXPLICIT_SEQUENCE_RE = /先(?:向我)?确认([\s\S]{2,180}?)(?:[；;。\n]|，?确认后|，?然后再|，?再(?:开始|继续|执行|列出|读取|总结))/
const CONFIRMATION_ANSWER_RE = /(?:确认|可以|同意|是|否|只|仅|全部|授权|来源|最近|近\s*\d+|\d+\s*(?:天|周|月)|今天|昨天|本周|上周|本月|时间范围)/i
const CANCEL_RE = /^(?:取消|不用了|先不|暂停|算了|停止)(?:[吧了。！!\s].*)?$/
const QUESTION_RE = /(?:为什么|为何|怎么(?:办|做|会)|什么(?:是|意思)|能否|是否可以|请问|[?？])/

function explicitClarificationRequest(prompt = '') {
  const text = String(prompt || '').trim()
  const match = text.match(EXPLICIT_SEQUENCE_RE)
  if (!match) return null
  const subject = String(match[1] || '').replace(/[，,]\s*$/, '').trim()
  if (!subject) return null
  return {
    kind: 'explicit-precondition',
    originalPrompt: text,
    question: `在继续执行前，请先确认${subject}。`,
  }
}

function resolveClarificationTurn(session = {}, prompt = '') {
  const text = String(prompt || '').trim()
  const pending = session?.pendingClarification
  if (pending?.kind === 'explicit-precondition') {
    if (CANCEL_RE.test(text)) return { action: 'cancel', prompt: text }
    // A short question is still a request for explanation, not an answer to
    // the gate. Only explicit scope/confirmation language may resume it.
    if (!QUESTION_RE.test(text) && CONFIRMATION_ANSWER_RE.test(text)) {
      return {
        action: 'resume',
        prompt: `${String(pending.originalPrompt || '').trim()}\n\n【用户对前置确认的答复】\n${text}`.trim(),
      }
    }
    return { action: 'clarify', pending, question: String(pending.question || '请先完成上一项确认。') }
  }
  const request = explicitClarificationRequest(text)
  return request ? { action: 'clarify', pending: request, question: request.question } : { action: 'continue', prompt: text }
}

module.exports = { explicitClarificationRequest, resolveClarificationTurn }

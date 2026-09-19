'use strict'

const { createHash } = require('crypto')

// Never retain the JSON parser's message: it can quote secrets from the input.
function toolJsonDiagnostics(text, error) {
  const message = String(error?.message || '')
  const location = message.match(/(?:at )?position (\d+)(?: \(line \d+ column \d+\))?$/)
  const reason = /Unexpected end|Unterminated string/i.test(message) ? 'incomplete_json'
    : /control character/i.test(message) ? 'unescaped_control_character'
      : /escape/i.test(message) ? 'invalid_escape' : 'invalid_json_syntax'
  return {
    reason, chars: text.length,
    position: location ? Number(location[1]) : null,
    fingerprint: createHash('sha256').update(text).digest('hex').slice(0, 16),
  }
}

function isToolJsonSyntaxFailure(result = {}) {
  return result.code === 'invalid_args'
    && /工具参数不是合法 JSON/.test(String(result.message || result.text || ''))
}

module.exports = { toolJsonDiagnostics, isToolJsonSyntaxFailure }

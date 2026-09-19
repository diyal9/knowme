'use strict'

/** Pure, bounded numeric expressions. No external state or executable input. */
const CALCULATION_LIMITS = Object.freeze({
  maxCalculations: 16,
  maxExpressionLength: 512,
  maxTotalExpressionLength: 2048,
  maxTokens: 256,
  maxDepth: 32,
  maxLabelLength: 64,
})

const PRECISION = 'IEEE-754 binary64 (about 15-17 significant decimal digits); decimal rounding applies, '
  + 'integers are exact only within +/-9007199254740991. No arbitrary precision or error bound for '
  + 'ill-conditioned expressions. Subnormals are rounded; underflow may become zero. Signed zero is '
  + 'returned as 0. Non-finite literals and intermediate results are rejected. 0^0 is 1.'

const CALCULATE_TOOL = {
  type: 'function',
  function: {
    name: 'calculate',
    description: 'Recompute numeric results from explicit expressions. Supports decimal/scientific numbers, '
      + '+ - * /, right-associative ** or ^, parentheses, sqrt/abs (one argument), min/max (one or more). '
      + 'Exponent binds tighter than unary signs: -2^2=-4, 2^-3=0.125. No variables or implicit multiplication. '
      + 'At most 16 calculations, 512 characters/expression, 2048 expression characters/batch, 256 tokens/expression, '
      + '32 recursive levels, 64 characters/label. Batch count/total-length overflow rejects the entire batch; '
      + 'otherwise each item keeps its expression and returns a value or error; any item error makes overall ok=false. '
      + 'Pure math, no artifacts or approval. ' + PRECISION,
    parameters: {
      type: 'object',
      properties: {
        calculations: {
          type: 'array',
          minItems: 1,
          maxItems: CALCULATION_LIMITS.maxCalculations,
          items: {
            type: 'object',
            properties: {
              label: { type: 'string', maxLength: CALCULATION_LIMITS.maxLabelLength },
              expression: { type: 'string', minLength: 1, maxLength: CALCULATION_LIMITS.maxExpressionLength },
            },
            required: ['expression'],
            additionalProperties: false,
          },
        },
      },
      required: ['calculations'],
      additionalProperties: false,
    },
  },
  _knowme: {
    source: 'builtin',
    capability: 'math',
    risk: 'read',
    sideEffects: false,
    requiresApproval: false,
    scope: 'ephemeral',
    timeoutMs: 1000,
    idempotencySupported: false,
    rollbackSupported: false,
  },
}

function calculationError(code, message) {
  throw Object.assign(new Error(message), { code })
}

function finiteNumber(value) {
  if (!Number.isFinite(value)) calculationError('non_finite', 'Non-finite number or intermediate result.')
  return value
}

function tokenizeExpression(expression) {
  const tokens = []
  const number = /(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/y
  const identifier = /[a-zA-Z_][a-zA-Z_0-9]*/y
  let position = 0
  while (position < expression.length) {
    if (/\s/.test(expression[position])) { position += 1; continue }
    if (tokens.length >= CALCULATION_LIMITS.maxTokens) calculationError('token_limit', 'Too many tokens in expression.')
    number.lastIndex = position
    const numeric = number.exec(expression)
    if (numeric) {
      tokens.push({ kind: 'number', value: finiteNumber(Number(numeric[0])) })
      position = number.lastIndex
      continue
    }
    identifier.lastIndex = position
    const named = identifier.exec(expression)
    if (named) {
      if (!['sqrt', 'abs', 'min', 'max'].includes(named[0])) {
        calculationError('invalid_expression', `Unsupported name at character ${position + 1}.`)
      }
      tokens.push({ kind: named[0] })
      position = identifier.lastIndex
      continue
    }
    const operator = expression.startsWith('**', position) ? '**' : expression[position]
    if (!['+', '-', '*', '/', '**', '^', '(', ')', ','].includes(operator)) {
      calculationError('invalid_expression', `Unsupported character at position ${position + 1}.`)
    }
    tokens.push({ kind: operator })
    position += operator.length
  }
  tokens.push({ kind: 'end' })
  return tokens
}

function parseNumericExpression(expression) {
  const tokens = tokenizeExpression(expression)
  let cursor = 0
  const peek = () => tokens[cursor].kind
  const expect = (kind) => {
    if (peek() !== kind) calculationError('invalid_expression', `Expected ${kind} at token ${cursor + 1}.`)
    cursor += 1
  }

  // Pratt binding powers: sum 10, product 20, unary 30, exponent 40.
  // Only exponent recurses at its own power, making exponentiation right-associative.
  function parse(minBinding, depth) {
    if (depth > CALCULATION_LIMITS.maxDepth) calculationError('depth_limit', 'Expression nesting is too deep.')
    const token = tokens[cursor++]
    let left
    if (token.kind === 'number') left = token.value
    else if (token.kind === '+' || token.kind === '-') {
      const operand = parse(30, depth + 1)
      left = token.kind === '-' ? -operand : operand
    } else if (token.kind === '(') {
      left = parse(0, depth + 1)
      expect(')')
    } else if (['sqrt', 'abs', 'min', 'max'].includes(token.kind)) {
      expect('(')
      const values = [parse(0, depth + 1)]
      while (peek() === ',') {
        cursor += 1
        values.push(parse(0, depth + 1))
      }
      expect(')')
      if ((token.kind === 'sqrt' || token.kind === 'abs') && values.length !== 1) {
        calculationError('invalid_expression', `${token.kind} requires exactly one argument.`)
      }
      if (token.kind === 'sqrt') left = Math.sqrt(values[0])
      else if (token.kind === 'abs') left = Math.abs(values[0])
      else if (token.kind === 'min') left = Math.min(...values)
      else left = Math.max(...values)
    } else calculationError('invalid_expression', `Expected a number, sign, parenthesis or math call at token ${cursor}.`)
    finiteNumber(left)

    while (true) {
      const operator = peek()
      const exponent = operator === '**' || operator === '^'
      const binding = exponent ? 40 : (operator === '*' || operator === '/') ? 20
        : (operator === '+' || operator === '-') ? 10 : -1
      if (binding < minBinding) break
      cursor += 1
      const right = parse(exponent ? binding : binding + 1, depth + 1)
      if ((operator === '/' && right === 0) || (exponent && left === 0 && right < 0)) {
        calculationError('division_by_zero', 'Division by zero (including zero raised to a negative power).')
      }
      if (exponent) left = left ** right
      else if (operator === '*') left *= right
      else if (operator === '/') left /= right
      else if (operator === '+') left += right
      else left -= right
      finiteNumber(left)
    }
    return left
  }

  const value = parse(0, 0)
  expect('end')
  return Object.is(value, -0) ? 0 : value
}

function calculationResult(ok, results, code = 'ok', error = '') {
  const payload = { ok, results, precision: PRECISION, ...(error ? { error } : {}) }
  return { ok, code, text: JSON.stringify(payload), meta: payload }
}

function handleCalculate(args) {
  const calculations = args?.calculations
  if (!Array.isArray(calculations) || calculations.length === 0) {
    return calculationResult(false, [], 'invalid_args', 'calculations must be a non-empty array.')
  }
  // Check batch budgets before iterating or echoing any user-controlled text.
  if (calculations.length > CALCULATION_LIMITS.maxCalculations) {
    return calculationResult(false, [], 'batch_limit', 'At most 16 calculations per batch; split the request.')
  }
  let totalLength = 0
  for (const item of calculations) {
    if (typeof item?.expression === 'string') totalLength += item.expression.length
    if (totalLength > CALCULATION_LIMITS.maxTotalExpressionLength) {
      return calculationResult(false, [], 'batch_limit', 'At most 2048 expression characters per batch; split the request.')
    }
  }
  const results = calculations.map(item => {
    const expression = typeof item?.expression === 'string' ? item.expression : null
    const validLabel = typeof item?.label === 'string' && item.label.length <= CALCULATION_LIMITS.maxLabelLength
    const original = { ...(validLabel ? { label: item.label } : {}), expression }
    try {
      if (!item || typeof item !== 'object' || Array.isArray(item) || expression === null || !expression.trim()
        || (item.label !== undefined && !validLabel)) {
        calculationError('invalid_args', 'Each item needs a non-empty expression string and an optional label of at most 64 characters.')
      }
      if (expression.length > CALCULATION_LIMITS.maxExpressionLength) {
        calculationError('expression_too_long', 'Expression exceeds 512 characters.')
      }
      return { ...original, ok: true, value: parseNumericExpression(expression) }
    } catch (error) {
      return { ...original, ok: false, code: error.code || 'invalid_expression', error: error.message }
    }
  })
  const ok = results.every(result => result.ok)
  return calculationResult(ok, results, ok ? 'ok' : 'calculation_failed')
}

function buildCalculationTools() {
  return { definitions: [CALCULATE_TOOL], handlers: { calculate: handleCalculate } }
}

module.exports = { CALCULATION_LIMITS, CALCULATE_TOOL, buildCalculationTools }

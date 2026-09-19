'use strict'

const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

// Reuse the same bundled Markdown parser as the renderer. Its UMD build can
// load synchronously on Electron's older Node versions (the main export is
// ESM). Only this fixed, installed dependency is evaluated, never user text.
const markedModule = { exports: {} }
vm.runInNewContext(fs.readFileSync(path.join(path.dirname(require.resolve('marked/package.json')),
  'lib/marked.umd.js'), 'utf8'), { module: markedModule, exports: markedModule.exports },
{ filename: 'marked.umd.js' })

function htmlCitationText(text, { includeCode, hidden }) {
  // Inline tags add no characters; block tags preserve clause boundaries.
  // Keep literal state across marked tokens (inline <code> is split into
  // opening HTML, text, and closing HTML). Never execute HTML or attributes.
  const output = []
  let offset = 0
  const markup = /<!--[\s\S]*?-->|<\/?([A-Za-z][\w:-]*)\b(?:[^<>"']|"[^"]*"|'[^']*')*>/gu
  for (const match of String(text).matchAll(markup)) {
    if (!hidden.length) output.push(String(text).slice(offset, match.index))
    offset = match.index + match[0].length
    if (!match[1]) continue
    const name = match[1].toLowerCase()
    const literal = ['script', 'style'].includes(name) || !includeCode && ['pre', 'code'].includes(name)
    if (literal) {
      if (match[0].startsWith('</')) {
        const index = hidden.lastIndexOf(name)
        if (index >= 0) hidden.splice(index)
      } else hidden.push(name)
    }
    if (!hidden.length && /^(?:address|article|aside|blockquote|br|dd|details|div|dl|dt|figcaption|figure|footer|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|summary|table|tbody|td|th|thead|tr|ul)$/u.test(name)) output.push('\n')
  }
  if (!hidden.length) output.push(String(text).slice(offset))
  return output.join('')
}

function markdownCitationProse(text, { includeCode = false, knownSourceIds = [] } = {}) {
  const output = []
  const known = new Set(knownSourceIds)
  const htmlContext = { includeCode, hidden: [] }
  const pending = [...markedModule.exports.lexer(String(text))].reverse()
  while (pending.length) {
    const token = pending.pop()
    if (token?.type === 'html') { output.push(htmlCitationText(token.raw, htmlContext)); continue }
    // A closing literal tag may live inside a later paragraph/container.
    // Suppress hidden leaves, but still traverse containers to find it.
    if (htmlContext.hidden.length && !Array.isArray(token?.tokens)
      && !Array.isArray(token?.items) && token?.type !== 'table') continue
    if (typeof token === 'string') { output.push(token); continue }
    if (!token) continue
    if (token.decoration) { output.push(token); continue }
    if (['code', 'codespan', 'escape'].includes(token.type)) {
      output.push(includeCode ? token.raw : ' ')
      continue
    }
    if (['link', 'image'].includes(token.type)) { output.push(' '); continue }
    // Track decoration separately from visible text. Adjacent punctuation IDs
    // can look like emphasis to Markdown, but ordinary emphasis must not hide
    // a labelled field or a citation such as [**MISSING**]. Children still pass
    // through the code/link/HTML exclusions above.
    if (['em', 'strong'].includes(token.type)) {
      const delimiter = token.raw.slice(0, token.type === 'strong' ? 2 : 1)
      output.push({ decoration: delimiter })
      pending.push({ decoration: delimiter })
    }
    if (['paragraph', 'heading', 'blockquote', 'list_item', 'list'].includes(token.type)) {
      output.push('\n')
      pending.push('\n')
    }
    if (Array.isArray(token.tokens)) pending.push(...[...token.tokens].reverse())
    else if (token.type === 'text') output.push(token.raw || token.text || '')
    else if (['br', 'space', 'hr'].includes(token.type)) output.push('\n')
    if (Array.isArray(token.items)) pending.push(...[...token.items].reverse())
    if (token.type === 'table') {
      const cells = [...token.header, ...token.rows.flat()]
      for (const cell of cells.reverse()) pending.push('\n', ...[...cell.tokens].reverse(), '\n')
    }
  }
  const raw = output.map(part => typeof part === 'string' ? part : part.decoration).join('')
  const identityOffsets = new Set()
  // A registered raw ID takes precedence over Markdown decoration: __R1__
  // must never borrow R1's evidence. Also preserve punctuation placeholders.
  // Do this after syntax exclusions, never against raw Markdown.
  for (const match of raw.matchAll(/\[([A-Za-z0-9_.-]+)\]/gu)) {
    if (/[A-Za-z0-9]/u.test(match[1]) && !known.has(match[1])) continue
    for (let index = match.index + 1; index < match.index + match[0].length - 1; index++) identityOffsets.add(index)
  }
  let offset = 0
  return output.map(part => {
    const value = typeof part === 'string' ? part : part.decoration
    const start = offset
    offset += value.length
    return typeof part === 'string' ? value
      : [...value].filter((_char, index) => identityOffsets.has(start + index)).join('')
  }).join('')
}

// Resolving an ID establishes identity only, never content support or truth.
// Markdown links/images, checkboxes and code literals aren't source citations.
// Link definitions inside code cannot change the interpretation of real prose.
function explicitSourceIds(text = '', knownSourceIds = []) {
  const known = new Set(knownSourceIds)
  return [...new Set([...markdownCitationProse(text, { knownSourceIds: known }).matchAll(/\[([A-Za-z0-9_.-]+)\]/gu)]
    .map(match => match[1])
    // Unregistered punctuation-only blanks are form/template placeholders.
    // A real registered punctuation ID still binds to its own source; unknown
    // alphanumeric IDs remain citations and must fail identity verification.
    .filter(id => /[A-Za-z0-9]/u.test(id) || known.has(id)))]
}

module.exports = { explicitSourceIds, markdownCitationProse }

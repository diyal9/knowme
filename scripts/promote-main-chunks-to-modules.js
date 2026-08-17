'use strict'

/**
 * One-shot: convert src/main/chunks (vm concat) into require() modules
 * that share an explicit `scope` object. registerCoreIpc is deferred to ipc-bind.ts.
 */
const fs = require('fs')
const path = require('path')
const ts = require('typescript')

const ROOT = path.join(__dirname, '..')
const CHUNK_DIR = path.join(ROOT, 'src', 'main', 'chunks')
const MOD_DIR = path.join(ROOT, 'src', 'main', 'modules')
const MAX = 380

function concatChunks() {
  const files = fs.readdirSync(CHUNK_DIR).filter(f => f.startsWith('chunk-')).sort()
  return files.map(f => fs.readFileSync(path.join(CHUNK_DIR, f), 'utf8')).join('\n')
}

function collectTopNames(sf) {
  const names = new Set()
  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name) names.add(stmt.name.text)
    if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) names.add(d.name.text)
        if (ts.isObjectBindingPattern(d.name) || ts.isArrayBindingPattern(d.name)) {
          collectBindingNames(d.name, names)
        }
      }
    }
  }
  return names
}

function collectBindingNames(node, names) {
  for (const el of node.elements) {
    if (ts.isOmittedExpression(el)) continue
    if (ts.isBindingElement(el)) {
      if (ts.isIdentifier(el.name)) names.add(el.name.text)
      else collectBindingNames(el.name, names)
    }
  }
}

function transform(source) {
  const sf = ts.createSourceFile('main-body.ts', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS)
  const topNames = collectTopNames(sf)
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })

  function localsFrom(node) {
    const locals = new Set()
    if (ts.isFunctionLike(node) && node.parameters) {
      for (const p of node.parameters) {
        if (ts.isIdentifier(p.name)) locals.add(p.name.text)
        else if (p.name) collectBindingNames(p.name, locals)
      }
    }
    return locals
  }

  const localStack = [new Set()]

  const transformer = (context) => (root) => {
    const visit = (node) => {
      const enterFn = ts.isFunctionLike(node) && node.body
      if (ts.isPropertyAccessExpression(node)) {
        const expr = visit(node.expression)
        return ts.factory.updatePropertyAccessExpression(node, expr, node.name)
      }

      if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
        localStack.push(new Set([...localStack[localStack.length - 1], ...localsFrom(node)]))
        const params = ts.visitNodes(node.parameters, visit)
        const body = visit(node.body)
        localStack.pop()
        if (ts.isArrowFunction(node)) {
          return ts.factory.updateArrowFunction(node, node.modifiers, node.typeParameters, params, node.type, node.equalsGreaterThanToken, body)
        }
        return ts.factory.updateFunctionExpression(node, node.modifiers, node.asteriskToken, node.name, node.typeParameters, params, node.type, body)
      }

      if (enterFn) localStack.push(new Set([...localStack[localStack.length - 1], ...localsFrom(node)]))

      if (ts.isVariableDeclaration(node) && !isTopLevelVar(node, root)) {
        const bag = localStack[localStack.length - 1]
        if (ts.isIdentifier(node.name)) bag.add(node.name.text)
        else if (node.name) collectBindingNames(node.name, bag)
      }

      let next = node

      if (ts.isShorthandPropertyAssignment(node) && topNames.has(node.name.text)
        && !localStack[localStack.length - 1].has(node.name.text)) {
        next = ts.factory.createPropertyAssignment(
          node.name,
          ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('scope'), node.name),
        )
      } else if (ts.isFunctionDeclaration(node) && node.parent === root && node.name) {
        const fn = ts.factory.createFunctionExpression(
          node.modifiers,
          node.asteriskToken,
          node.name,
          node.typeParameters,
          node.parameters,
          node.type,
          node.body || ts.factory.createBlock([]),
        )
        const assign = ts.factory.createAssignment(
          ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('scope'), node.name),
          fn,
        )
        next = ts.factory.createExpressionStatement(assign)
      } else if (ts.isVariableStatement(node) && node.parent === root) {
        const exprs = []
        for (const d of node.declarationList.declarations) {
          const init = d.initializer || ts.factory.createIdentifier('undefined')
          if (ts.isIdentifier(d.name)) {
            exprs.push(ts.factory.createAssignment(
              ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('scope'), d.name),
              init,
            ))
          } else if (ts.isObjectBindingPattern(d.name)) {
            const tmpName = `__bind_${d.name.elements.map(el => ts.isBindingElement(el) && ts.isIdentifier(el.name) ? el.name.text : 'x').join('_').slice(0, 40)}`
            const tmp = ts.factory.createPropertyAccessExpression(
              ts.factory.createIdentifier('scope'),
              ts.factory.createIdentifier(tmpName),
            )
            exprs.push(ts.factory.createAssignment(tmp, init))
            for (const el of d.name.elements) {
              if (!ts.isBindingElement(el) || !ts.isIdentifier(el.name)) continue
              const from = el.propertyName && ts.isIdentifier(el.propertyName)
                ? el.propertyName
                : el.name
              exprs.push(ts.factory.createAssignment(
                ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('scope'), el.name),
                ts.factory.createPropertyAccessExpression(tmp, from),
              ))
            }
          }
        }
        if (exprs.length === 1) next = ts.factory.createExpressionStatement(exprs[0])
        else next = ts.factory.createExpressionStatement(ts.factory.createCommaListExpression(exprs))
      } else if (ts.isIdentifier(node)) {
        const name = node.text
        if (topNames.has(name) && name !== 'scope' && !localStack[localStack.length - 1].has(name)) {
          const parent = node.parent
          if (parent && ts.isPropertyAccessExpression(parent) && parent.name === node) {
            /* keep */
          } else if (parent && ts.isPropertyAssignment(parent) && parent.name === node) {
            /* keep */
          } else if (parent && ts.isFunctionExpression(parent) && parent.name === node) {
            /* keep */
          } else {
            if (enterFn) localStack.pop()
            return ts.factory.createPropertyAccessExpression(ts.factory.createIdentifier('scope'), ts.factory.createIdentifier(name))
          }
        }
      }

      next = ts.visitEachChild(next, visit, context)
      if (enterFn) localStack.pop()
      return next
    }
    return ts.visitEachChild(root, visit, context)
  }

  const result = ts.transform(sf, [transformer])
  const out = printer.printFile(result.transformed[0])
  result.dispose()
  return { out, topNames }
}

function isTopLevelVar(decl, root) {
  let n = decl.parent
  while (n && n !== root) {
    if (ts.isSourceFile(n)) return true
    if (ts.isFunctionLike(n)) return false
    n = n.parent
  }
  return n === root
}

function scanDepth(line) {
  let depth = 0
  let inSingle = false
  let inDouble = false
  let inTemplate = false
  let inLineComment = false
  let inBlockComment = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    const next = line[i + 1]
    if (inLineComment) continue
    if (inBlockComment) {
      if (ch === '*' && next === '/') { inBlockComment = false; i++; }
      continue
    }
    if (inSingle) { if (ch === '\\') { i++; continue } if (ch === "'") inSingle = false; continue }
    if (inDouble) { if (ch === '\\') { i++; continue } if (ch === '"') inDouble = false; continue }
    if (inTemplate) { if (ch === '\\') { i++; continue } if (ch === '`') inTemplate = false; continue }
    if (ch === '/' && next === '/') { inLineComment = true; continue }
    if (ch === '/' && next === '*') { inBlockComment = true; i++; continue }
    if (ch === "'") { inSingle = true; continue }
    if (ch === '"') { inDouble = true; continue }
    if (ch === '`') { inTemplate = true; continue }
    if (ch === '{') depth++
    if (ch === '}') depth--
  }
  return depth
}

function splitLines(text) {
  const lines = text.split(/\r?\n/)
  const chunks = []
  let buf = []
  let depth = 0
  for (const line of lines) {
    buf.push(line)
    depth += scanDepth(line)
    if (depth < 0) depth = 0
    if (depth === 0 && buf.length >= MAX) {
      chunks.push(buf.join('\n'))
      buf = []
    }
  }
  if (buf.length) chunks.push(buf.join('\n'))
  return chunks
}

function extractIpcCall(text) {
  const start = text.indexOf('scope.registerCoreIpc(')
  if (start < 0) {
    const alt = text.indexOf('registerCoreIpc(')
    if (alt < 0) throw new Error('registerCoreIpc call not found')
  }
  const needle = text.includes('scope.registerCoreIpc(') ? 'scope.registerCoreIpc(' : 'registerCoreIpc('
  const startIdx = text.indexOf(needle)
  let i = startIdx + needle.length
  let depth = 1
  while (i < text.length && depth) {
    const ch = text[i]
    if (ch === '(') depth++
    if (ch === ')') depth--
    i++
  }
  if (text[i] === ';') i++
  const call = text.slice(startIdx, i)
  const rest = text.slice(0, startIdx) + '\n' + text.slice(i)
  return { call, rest }
}

function main() {
  const source = concatChunks()
  const { out } = transform(source)
  const { call, rest } = extractIpcCall(out)
  fs.mkdirSync(MOD_DIR, { recursive: true })
  const header = "'use strict'\nconst scope = require('../scope')\n"
  const parts = splitLines(rest)
  const names = []
  parts.forEach((part, idx) => {
    const id = String(idx + 1).padStart(2, '0')
    const name = `part-${id}.ts`
    names.push(name)
    fs.writeFileSync(path.join(MOD_DIR, name), header + part.trim() + '\n')
  })
  let bindCall = call.trim()
  if (bindCall.startsWith('scope.registerCoreIpc')) {
    bindCall = 'registerCoreIpc' + bindCall.slice('scope.registerCoreIpc'.length)
  }
  fs.writeFileSync(path.join(ROOT, 'src', 'main', 'ipc-bind.ts'), `'use strict'
const scope = require('./scope')
const { registerCoreIpc } = require('../ipc')

function bindCoreIpc() {
  ${bindCall}
}

module.exports = { bindCoreIpc }
`)
  fs.writeFileSync(path.join(ROOT, 'src', 'main', 'module-list.json'), JSON.stringify(names, null, 2))
  console.log('wrote', names.length, 'modules;', 'ipc-bind extracted')
}

main()

'use strict'

/**
 * 拆 generate 后：L / env.deps 导出被当自由标识符用、却未解构，会变成 ReferenceError。
 */
const { describe, it } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

const LIB = path.join(__dirname, '..', 'src', 'lib')
const LIBS_FILE = path.join(LIB, 'agent-generate-libs.ts')

const FILES = [
  'agent-generate-prepare.ts',
  'agent-generate-tool-surface.ts',
  'agent-generate-execute.ts',
  'agent-generate-child-ports.ts',
]

const DEPS_WATCH = [
  'loadSettings', 'saveSettings_', 'loadAgentSessions', 'saveAgentSessions', 'ensureAgentSession',
  'buildFabricCtx', 'ensureFabricSeeded', 'ensureCapabilityHub', 'ensureAgentTeamRuntime',
  'readNote', 'buildEmbedFn', 'normalizeChatEndpoint', 'requestAgentCompletion',
  'buildMissingResourceHint', 'getFeishuGroundingContext', 'hasPriorFeishuFacts',
  'resolveActiveProvider', 'KNOWLEDGE_DIR', 'MEMORY_DIR', 'agentRuntimePortFactories',
  'agentRuntimeOutputBridges', 'activeAgentRuns', 'loadSourcesStore', 'getActiveSourceRoot',
  'kosSourcesCtx', 'workbenchDaemon', 'buildActiveSourceFileTools', 'connectorToolRuntime',
]

function listLExports(src) {
  const block = src.match(/module\.exports\s*=\s*\{([\s\S]*?)\n\}/)
  assert.ok(block, 'agent-generate-libs exports')
  return [...block[1].matchAll(/\b([A-Za-z_$][\w$]*)\b/g)].map(m => m[1]).filter((n, i, a) => a.indexOf(n) === i)
}

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function destructuredFrom(src, rhsRe) {
  const names = new Set()
  const re = new RegExp(String.raw`(?:const|let|var)\s*\{([^}]+)\}\s*=\s*${rhsRe}`, 'g')
  let m
  while ((m = re.exec(src))) {
    for (const part of m[1].split(',')) {
      const bit = part.trim()
      if (!bit) continue
      const name = bit.split(/\s+as\s+|:/).pop().trim()
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name)
    }
  }
  return names
}

function usedAsIdent(src, name) {
  const re = new RegExp(String.raw`(?<![.\w$])${name}(?![\w$])`, 'g')
  return re.test(src)
}

describe('agent-generate free identifiers', () => {
  it('does not use L or env.deps exports unbound', () => {
    const lExports = listLExports(fs.readFileSync(LIBS_FILE, 'utf8'))
    const missing = []
    for (const file of FILES) {
      const src = stripComments(fs.readFileSync(path.join(LIB, file), 'utf8'))
      const fromL = destructuredFrom(src, String.raw`L\b`)
      const fromDeps = destructuredFrom(src, String.raw`env\.deps\b`)
      for (const name of lExports) {
        if (fromL.has(name) || src.includes(`L.${name}`)) continue
        if (usedAsIdent(src, name)) missing.push(`${file}: L.${name}`)
      }
      for (const name of DEPS_WATCH) {
        if (fromDeps.has(name) || fromL.has(name) || src.includes(`env.deps.${name}`)) continue
        if (usedAsIdent(src, name)) missing.push(`${file}: deps.${name}`)
      }
    }
    assert.deepEqual(missing, [])
  })

  // 会议总结含「最近+检索」会激活 research 路由并重写 apiMessages；const 解构会 TypeError
  it('tool-surface keeps apiMessages reassignable for research inject', () => {
    const src = stripComments(
      fs.readFileSync(path.join(LIB, 'agent-generate-tool-surface.ts'), 'utf8'),
    )
    assert.match(src, /\blet\s+apiMessages\b/)
    assert.doesNotMatch(src, /const\s*\{[^}]*\bapiMessages\b[^}]*\}\s*=\s*prepared/)
  })
})

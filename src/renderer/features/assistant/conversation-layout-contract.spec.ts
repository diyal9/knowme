import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const renderer = path.resolve(import.meta.dirname, '../..')

function read(relativePath: string) {
  return readFileSync(path.join(renderer, relativePath), 'utf8')
}

describe('shared conversation layout contract', () => {
  it('defines one reading and composer token set', () => {
    const tokens = read('app/tokens.css')
    expect(tokens).toMatch(/--conversation-track-max:\s*920px/)
    expect(tokens).toMatch(/--conversation-reading-max:\s*880px/)
    expect(tokens).toMatch(/--conversation-body-size:\s*15px/)
    expect(tokens).toMatch(/--conversation-composer-size:\s*14px/)
    expect(tokens).toMatch(/--conversation-body-leading:\s*1\.68/)
    expect(tokens).toMatch(/--conversation-turn-gap:\s*16px/)
  })

  it('mounts the shared surface in personal and task dialogue shells', () => {
    expect(read('features/assistant/AssistantPane.tsx')).toMatch(/agent-col conversation-surface/)
    expect(read('features/task-dialogue/TaskDialogueShell.tsx')).toMatch(/agent-col conversation-surface/)
  })

  it('keeps assistant content editorial and the user turn directional', () => {
    const css = read('styles/agent-chrome.css')
    expect(css).toMatch(/--agent-reading-track:\s*min\(var\(--conversation-reading-max/)
    expect(css).toMatch(/\.agent-virtuoso-row[\s\S]*width:var\(--agent-message-track\)/)
    expect(css).toMatch(/\.agent-bubble\.user[\s\S]*margin-left:auto/)
    expect(css).toMatch(/\.agent-response-body[\s\S]*--content-body-size/)
  })
})

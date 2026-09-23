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
    expect(tokens).toMatch(/--conversation-track-max:\s*760px/)
    expect(tokens).toMatch(/--conversation-reading-max:\s*var\(--conversation-track-max\)/)
    expect(tokens).toMatch(/--conversation-task-track-max:\s*var\(--conversation-track-max\)/)
    expect(tokens).toMatch(/--conversation-task-reading-max:\s*var\(--conversation-track-max\)/)
    expect(tokens).toMatch(/--conversation-body-size:\s*14px/)
    expect(tokens).toMatch(/--conversation-composer-size:\s*14px/)
    expect(tokens).toMatch(/--conversation-body-leading:\s*1\.72/)
    expect(tokens).toMatch(/--conversation-turn-gap:\s*20px/)
  })

  it('mounts the shared surface in personal and task dialogue shells', () => {
    expect(read('features/assistant/AssistantPane.tsx')).toMatch(/agent-col conversation-surface/)
    expect(read('features/task-dialogue/TaskDialogueShell.tsx')).toMatch(/agent-col conversation-surface/)
  })

  it('keeps assistant content editorial and the user turn directional', () => {
    const css = read('styles/agent-chrome.css')
    expect(css).toMatch(/--agent-layout-track:\s*min\(var\(--conversation-track-max,\s*760px\)/)
    expect(css).toMatch(/--agent-message-track:\s*var\(--agent-layout-track\)/)
    expect(css).toMatch(/--agent-reading-track:\s*var\(--agent-layout-track\)/)
    expect(css).toMatch(/\.app\.mode-agent:not\(\.agent-has-document\) \.agent-col-foot\s*\{[^}]*width:var\(--agent-layout-track\)/s)
    expect(css).toMatch(/\.app\.mode-agent:not\(\.agent-has-document\) \.agent-col-foot\s*\{[^}]*padding-left:0;[^}]*padding-right:0;/s)
    expect(css).toMatch(/\.agent-virtuoso-row[\s\S]*width:var\(--agent-message-track\)/)
    expect(css).toMatch(/\.agent-bubble\.user[\s\S]*margin-left:auto/)
    expect(css).toMatch(/\.agent-response-body[\s\S]*--content-body-size/)
    expect(css).toMatch(/\.conversation-surface \.agent-chat-log \.agent-response-body \.agent-md h1\s*\{[\s\S]*font-size:1\.3em/)
    expect(css).toMatch(/\.conversation-surface \.agent-chat-log \.agent-response-body \.agent-md h2\s*\{[\s\S]*font-size:1\.12em/)
    expect(css).toMatch(/\.conversation-surface \.agent-chat-log \.agent-response-body \.agent-md h3,[\s\S]*\.conversation-surface \.agent-chat-log \.agent-response-body \.agent-md h4\s*\{[\s\S]*font-size:1em/)
    expect(css).toMatch(/\.conversation-surface \.agent-chat-log \.agent-response-body \.agent-md h1,[\s\S]*margin-top:\.9em;[^}]*margin-bottom:\.36em;/)
  })

  it('applies the same type rhythm to expert, workflow and pipeline task rooms', () => {
    const taskRoom = read('features/workbench/workbench-layout.css')
    const expert = read('features/expert/expert-workbench.css')
    expect(taskRoom).toMatch(/--agent-message-track:\s*min\(var\(--conversation-track-max/)
    expect(taskRoom).toMatch(/--agent-reading-track:\s*var\(--agent-message-track\)/)
    expect(taskRoom).toMatch(/\.agent-bubble\.user\s*\{[^}]*align-self:\s*flex-end/s)
    expect(expert).toMatch(/--wb-expert-dialogue-width:\s*min\(var\(--conversation-track-max/)
    expect(expert).toMatch(/--agent-reading-track:\s*var\(--agent-message-track\)/)
  })
})

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { expertTurnElapsedMs } from './ExpertConversationTimeline'

const css = readFileSync(path.join(import.meta.dirname, 'expert-workbench.css'), 'utf8')
const artifactCss = readFileSync(path.join(import.meta.dirname, '../artifact/artifact-preview.css'), 'utf8')
const statusCss = readFileSync(path.join(import.meta.dirname, '../workbench/workbench-layout.css'), 'utf8')
const room = readFileSync(path.join(import.meta.dirname, 'ExpertTaskRoom.tsx'), 'utf8')
const dialogue = readFileSync(path.join(import.meta.dirname, 'ExpertCollabDialogue.tsx'), 'utf8')

describe('expert collaboration layout contract', () => {
  it('fits the entire image inside a viewport-bounded dialog grid', () => {
    expect(css).toMatch(/\.wb-expert-image-dialog\s*\{[^}]*grid-template-rows:auto minmax\(0, 1fr\) auto;/s)
    expect(css).toMatch(/\.wb-expert-image-dialog-body\s*\{[^}]*grid-template-rows:minmax\(0, 1fr\);/s)
    expect(css).toMatch(/\.wb-expert-image-dialog-body > img\s*\{[^}]*width:100%; height:100%;[^}]*object-fit:contain;/s)
  })
  it('keeps the dialogue list and composer on one shared reading track', () => {
    expect(room).toContain('<div className="wb-expert-main-rail">')
    expect(css).toMatch(/\.wb-expert-workspace\.has-edge-scroll > \.wb-expert-review-pane > \.wb-expert-main-rail\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s)
    expect(css).toMatch(/\.wb-expert-main-rail > \.wb-expert-pane-content\s*\{[^}]*width:\s*100% !important;[^}]*flex:\s*1 1 auto;/s)
    expect(css).toMatch(/\.wb-expert-main-rail > \.wb-expert-composer-dock\s*\{[^}]*position:\s*static !important;[^}]*width:\s*100% !important;/s)
    expect(css).toMatch(/\.wb-expert-draft-room \.agent-chat-log,[\s\S]*?\.wb-expert-draft-room \.wb-expert-dialogue-list\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*none;/)
    expect(css).toMatch(/@media \(max-width:\s*760px\)[\s\S]*?--wb-expert-narrow-rail:\s*calc\(100vw - 12px\);[\s\S]*?\.wb-expert-pane-content > section,[\s\S]*?\.wb-expert-composer-dock\s*\{[^}]*width:\s*var\(--wb-expert-narrow-rail\) !important;/)
    expect(css).toMatch(/\.has-edge-scroll > \.wb-expert-review-pane,[\s\S]*?\.has-edge-scroll \.wb-expert-pane-content\s*\{[^}]*padding-left:\s*0 !important;[^}]*padding-right:\s*0 !important;/)
  })

  it('uses one timeline component for draft and execution turns', () => {
    expect(dialogue).toContain('<ExpertConversationTimeline className="wb-expert-dialogue-list"')
    expect(room).toContain('<ExpertConversationTimeline className="wb-expert-process-list wb-expert-collab-list"')
    expect(css).toMatch(/\.wb-expert-conversation-timeline\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*none;/s)
  })

  it('marks a completed user turn with elapsed time on the shared dialogue rail', () => {
    expect(dialogue).toContain('expertTurnElapsedMs')
    expect(room).toContain('turnDividerForFeed')
    expect(css).toMatch(/\.wb-expert-turn-divider\s*\{[^}]*border-bottom:\s*1px solid var\(--border-subtle\);/s)
    const user = { id: 'user', role: 'user' as const, text: '请继续', createdAt: '2026-09-18T10:00:00.000Z' }
    expect(expertTurnElapsedMs(user, { ...user, id: 'reply', role: 'assistant', elapsedMs: 8_590 })).toBe(8_590)
    expect(expertTurnElapsedMs(user, { ...user, id: 'history', role: 'assistant', createdAt: '2026-09-18T10:02:03.000Z' })).toBe(123_000)
  })

  it('keeps expert dialogue avatars aligned with the composer track', () => {
    expect(css).toMatch(/\.app\.mode-workbench \.wb-expert-draft-room \.agent-chat-log,[\s\S]*?\.app\.mode-workbench \.wb-expert-followup-thread \.agent-chat-log\s*\{[^}]*padding-left:\s*0;[^}]*padding-right:\s*0;/)
    expect(css).toMatch(/\.wb-expert-composer-dock\s*\{[^}]*width:\s*var\(--wb-expert-dialogue-width\);[^}]*padding-left:\s*0;/s)
  })

  it('renders expert messages with the same bubble component as partner dialogue', () => {
    expect(dialogue).toContain("import { AgentMessageBubble } from '../assistant/AgentMessageBubble'")
    expect(dialogue).toContain('<AgentMessageBubble')
    expect(dialogue).not.toContain("import { ContentView } from '../content-view/ContentView'")
    expect(css).toMatch(/\.wb-expert-conversation-timeline > \.agent-virtuoso-row\.wb-expert-message-row\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*width:\s*100%;/s)
    expect(css).toMatch(/\.wb-expert-message-row > \.agent-bubble\.user\s*\{[^}]*align-self:\s*flex-end;/s)
  })

  it('enters the shared dialogue directly and keeps configured SOP paths in its opening turn', () => {
    expect(dialogue).toContain('launch={false}')
    expect(dialogue).toContain('<ExpertDialogueMessages')
    expect(dialogue).not.toContain('wb-expert-launch')
    expect(dialogue).toContain('className="wb-expert-route-choices"')
    expect(dialogue).toContain('!messages.some((message) => message.role === \'user\')')
    expect(room).toContain('initialOptions={!firstUserMessage ? expertDetail?.routes || [] : []}')
    expect(room).toContain('onInitialOption={sendSopRoutePrompt}')
  })
  it('uses neutral shared-dialogue surfaces for expert task cards', () => {
    expect(css).toContain('Conversation task cards use the same restrained surface language')
    expect(css).toMatch(/\.wb-expert-completion-summary,[\s\S]*?\.wb-expert-hil-panel\s*\{[^}]*background:\s*var\(--surface-page\);[^}]*border:\s*1px solid var\(--border-subtle\);/)
    expect(css).toMatch(/\.wb-expert-completion-summary > header\s*\{[^}]*background:\s*var\(--surface-page\);[^}]*border-bottom:\s*1px solid var\(--brand-paper\);/)
    expect(css).toMatch(/\.wb-expert-diagnostics-card > summary\s*\{[^}]*background:\s*var\(--surface-page\);/)
  })

  it('keeps image loading indicators attached to their label', () => {
    expect(css).toMatch(/\.km-artifact-preview\.is-image \.km-artifact-preview-media\.is-loading\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*center;[^}]*justify-content:\s*center;[^}]*gap:\s*8px;/s)
  })

  it('keeps the expert room content track free of a redundant divider', () => {
    expect(css).toMatch(/\.agent-col:has\(\.wb-expert-workspace\)\s*\{[^}]*border-right:\s*0\s*!important;/s)
    expect(css).not.toContain('.pane-col:has(.wb-expert-workspace)')
    expect(css).toMatch(/\.wb-expert-pane-content\s*\{[^}]*padding-right:\s*16px;[^}]*scrollbar-gutter:\s*stable;[^}]*border-right:\s*0;/s)
    expect(css).toMatch(/\.wb-expert-workspace\.has-edge-scroll\s*\{[^}]*overflow-y:\s*auto\s*!important;/s)
    expect(css).toMatch(/\.wb-expert-workspace\.has-edge-scroll > \.wb-expert-review-pane\s*\{[^}]*overflow:\s*visible\s*!important;/s)
    expect(css).toMatch(/\.wb-expert-workspace\.has-edge-scroll > \.wb-expert-capabilities\s*\{[^}]*position:\s*fixed\s*!important;[^}]*top:\s*110px;[^}]*right:\s*16px;/s)
    const finalContract = css.slice(css.lastIndexOf('Final desktop scroll contract'))
    expect(finalContract).toMatch(/\.wb-expert-workspace\.has-edge-scroll > \.wb-expert-capabilities\s*\{[^}]*position:\s*fixed\s*!important;[^}]*overflow:\s*visible\s*!important;/s)
    expect(css).toMatch(/\.wb-expert-pane-content\s*\{[^}]*scrollbar-width:\s*thin;[^}]*scrollbar-color:/s)
    expect(css).toMatch(/\.wb-expert-pane-content::-webkit-scrollbar\s*\{[^}]*width:\s*13px;[^}]*height:\s*13px;/s)
    expect(css).toMatch(/\.wb-expert-pane-content::-webkit-scrollbar-thumb\s*\{[^}]*border-left-width:\s*7px;/s)
  })

  it('uses whitespace instead of a vertical divider between dialogue and capability rail', () => {
    expect(css).toMatch(/\.wb-expert-capabilities\s*\{\s*border-left:\s*0;\s*background:\s*var\(--surface-page\);\s*\}/)
    expect(css).toMatch(/\.wb-expert-capabilities\s*\{[^}]*border-left:\s*0;/s)
  })

  it('does not offer direct start while the expert is still clarifying', () => {
    expect(room).toContain('const planningClarifying =')
    expect(room).toContain('const planReady = isDraft && canConfirmPlan')
  })

  it('pins the expert entry composer to the bottom of a short workspace', () => {
    expect(css).toMatch(/Expert entry keeps its composer at the workspace bottom/)
    expect(css).toMatch(/\.wb-expert-main-rail > \.wb-expert-pane-content\s*\{[^}]*flex:\s*1 1 auto\s*!important;/s)
    expect(css).toMatch(/\.wb-expert-main-rail > \.wb-expert-composer-dock\s*\{[^}]*margin-top:\s*auto\s*!important;/s)
  })
  it('keeps collaboration state in the right property rail instead of duplicating it in the top bar', () => {
    expect(room).toMatch(/<DialogueStatusBar[\s\S]*mode=\{workbenchTaskModeLabel\('expert-chat'\)\}[\s\S]*onBack=\{closeExpertRoom\}/)
    expect(room).not.toMatch(/<DialogueStatusBar[\s\S]*state=/)
    expect(room).toMatch(/status=\{showStatusFocus \? \{ title: statusFocus\.title, waiting: waitingForProgress, canCancel: canCancelExecution, onCancel:/)
  })

  it('keeps managed Agent selection in the conversation composer instead of the top bar', () => {
    expect(room).not.toContain('AgentManagementTargetBar')
    expect(room).not.toMatch(/<DialogueStatusBar[\s\S]*context=/)
    expect(room).toMatch(/<AgentComposer[\s\S]*agentTargets=\{availableManagedAgentTargets\}/)
    expect(room).toMatch(/selectedAgentTarget=\{managedAgentTarget\}/)
    expect(room).toMatch(/onAgentTargetChange=\{isAgentManagementRoom \? selectManagedAgentTarget : undefined\}/)
    expect(room).toContain('输入 # 选择已有 Agent')
    expect(css).not.toContain('.wb-agent-space-switcher')
  })

  it('uses a compact, non-wrapping number row in the commission summary', () => {
    expect(css).toMatch(/\.wb-expert-contract dl > div\s*\{[^}]*grid-template-columns:\s*38px minmax\(0, 1fr\);/s)
    expect(css).toMatch(/\.wb-expert-task-number\s*\{[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/s)
  })

  it('vertically aligns the commission heading and delete action', () => {
    expect(css).toMatch(/\.wb-expert-contract > \.wb-expert-contract-heading\s*\{[^}]*min-height:\s*24px;[^}]*align-items:\s*center;/s)
    expect(css).toMatch(/\.wb-expert-contract > \.wb-expert-contract-heading > \.wb-detail-section-kicker\s*\{[^}]*margin:\s*0\s*!important;[^}]*line-height:\s*24px;/s)
    expect(css).toMatch(/\.wb-expert-contract > \.wb-expert-contract-heading > \.wb-expert-delete-button\s*\{[^}]*width:\s*24px;[^}]*height:\s*24px;/s)
  })

  it('reveals a clarified goal while respecting reduced-motion preferences', () => {
    expect(css).toMatch(/\.wb-expert-task-goal\.is-confirmed > (?:span|\.km-marquee-text-content)/)
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('keeps the executing status dot visibly animated and accessible to reduced-motion users', () => {
    expect(statusCss).toMatch(/\.agent-dialogue-status-state\.tone-running::before\s*\{[^}]*animation:\s*agent-dialogue-status-pulse\s+1\.6s\s+ease-in-out\s+infinite;/s)
    expect(statusCss).toMatch(/@keyframes\s+agent-dialogue-status-pulse\s*\{[\s\S]*?50%\s*\{[^}]*transform:\s*scale\(1\.18\);/)
    expect(statusCss).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.agent-dialogue-status-state\.tone-running::before\s*\{\s*animation:\s*none;/)
  })

  it('keeps deliverables on the message-content track without forcing a 100% card plus left offset', () => {
    expect(css).toContain('.wb-expert-collab-list > .wb-expert-dialogue-turn > article { width:100%; box-sizing:border-box; }')
    expect(css).not.toContain('.wb-expert-collab-list > li > article { width:100%; box-sizing:border-box; }')
    expect(css).toContain('.wb-expert-collab-list > .wb-expert-feed-deliverable > .km-artifact-preview { margin-left:43px; }')
    expect(artifactCss).toMatch(/\.km-artifact-preview\s*\{[^}]*width:min\(420px, 100%\);/s)
    expect(artifactCss).toMatch(/\.km-artifact-preview\.has-excerpt\s*\{[^}]*width:min\(620px, 100%\);/s)
    expect(room).toContain("excerpt={artifact?.body || task?.resultSummary || ''}")
  })

  it('keeps document preview focused on reading', () => {
    expect(css).toMatch(/\.wb-expert-artifact-dialog-body\s*\{[^}]*scrollbar-gutter:stable;[^}]*background:var\(--surface-subtle\);/s)
    expect(css).toMatch(/\.wb-expert-artifact-dialog-body \.wb-artifact-sheet,[\s\S]*?width:min\(780px, 100%\);[^}]*margin:0 auto;[^}]*background:var\(--surface-page\);/s)
    expect(room).not.toContain('onContinueWithArtifact=')
  })

  it('restores the formal execution session whenever the task record changes', () => {
    expect(room).toContain("const executionSessionId = String(taskResult.execRef?.id || '').trim()")
    expect(room).toContain("messages.filter((message) => message.role !== 'user')")
    expect(room).toMatch(/restoreSignature[\s\S]*loadedTask\.updatedAt[\s\S]*loadedTask\.events\?\.length/)
  })
})

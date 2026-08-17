'use strict'
const fs = require('fs')
const path = require('path')

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    if (['node_modules', 'dist', '.git'].includes(name)) continue
    if (fs.statSync(p).isDirectory()) walk(p, acc)
    else acc.push(p)
  }
  return acc
}

const wb = 'src/renderer/features/workbench'
const moves = {
  shelf: ['ShelfSurface.tsx', 'ShelfCard.tsx', 'shelf.spec.tsx'],
  taskhome: [
    'TaskHomeSurface.tsx', 'TaskQuickCard.tsx', 'TaskRecentCard.tsx',
    'TaskComposerModal.tsx', 'TaskManageModal.tsx', 'taskhome.spec.tsx',
  ],
  run: [
    'RunSurface.tsx', 'RunAgentsGraph.tsx', 'RunInputAgentsPreview.tsx',
    'DaemonReviewPanel.tsx', 'PipelineTaskRoom.tsx', 'run.spec.tsx',
  ],
  expert: [
    'ExpertRoomSurface.tsx', 'ExpertCollabDialogue.tsx', 'ExpertSideStack.tsx', 'ExpertAvatarMark.tsx',
  ],
  studio: [
    'StudioSurface.tsx', 'StudioCanvasBoard.tsx', 'StudioCanvasNode.tsx', 'StudioPalette.tsx',
    'StudioInspector.tsx', 'StudioInspectorFields.tsx', 'StudioToolbar.tsx', 'StudioIoFields.tsx',
    'StudioExpertPicker.tsx', 'StudioStepList.tsx', 'StudioWorkflowFields.tsx', 'StudioAgentFields.tsx',
    'useStudioGraphCheck.ts', 'studio.spec.tsx',
  ],
  manage: [
    'ManageSurface.tsx', 'ManageAutomationModal.tsx', 'ManageAutomationForm.tsx',
    'ManageWorkflowCard.tsx', 'DaemonComposePanel.tsx', 'WorkspaceTreeModal.tsx', 'manage.spec.tsx',
  ],
}

for (const [feat, files] of Object.entries(moves)) {
  const dest = path.join('src/renderer/features', feat)
  fs.mkdirSync(dest, { recursive: true })
  for (const f of files) {
    const from = path.join(wb, f)
    const to = path.join(dest, f)
    if (fs.existsSync(from) && !fs.existsSync(to)) fs.renameSync(from, to)
  }
}

const importMap = [
  ['features/workbench/ShelfSurface', 'features/shelf/ShelfSurface'],
  ['features/workbench/ShelfCard', 'features/shelf/ShelfCard'],
  ['features/workbench/TaskHomeSurface', 'features/taskhome/TaskHomeSurface'],
  ['features/workbench/TaskQuickCard', 'features/taskhome/TaskQuickCard'],
  ['features/workbench/TaskRecentCard', 'features/taskhome/TaskRecentCard'],
  ['features/workbench/TaskComposerModal', 'features/taskhome/TaskComposerModal'],
  ['features/workbench/TaskManageModal', 'features/taskhome/TaskManageModal'],
  ['features/workbench/RunSurface', 'features/run/RunSurface'],
  ['features/workbench/RunAgentsGraph', 'features/run/RunAgentsGraph'],
  ['features/workbench/RunInputAgentsPreview', 'features/run/RunInputAgentsPreview'],
  ['features/workbench/DaemonReviewPanel', 'features/run/DaemonReviewPanel'],
  ['features/workbench/TaskRoomDialogue', 'features/run/TaskRoomDialogue'],
  ['features/workbench/ExpertRoomSurface', 'features/expert/ExpertRoomSurface'],
  ['features/workbench/ExpertCollabDialogue', 'features/expert/ExpertCollabDialogue'],
  ['features/workbench/ExpertSideStack', 'features/expert/ExpertSideStack'],
  ['features/workbench/ExpertAvatarMark', 'features/expert/ExpertAvatarMark'],
  ['features/workbench/StudioSurface', 'features/studio/StudioSurface'],
  ['features/workbench/StudioCanvasBoard', 'features/studio/StudioCanvasBoard'],
  ['features/workbench/StudioCanvasNode', 'features/studio/StudioCanvasNode'],
  ['features/workbench/StudioPalette', 'features/studio/StudioPalette'],
  ['features/workbench/StudioInspector', 'features/studio/StudioInspector'],
  ['features/workbench/StudioInspectorFields', 'features/studio/StudioInspectorFields'],
  ['features/workbench/StudioToolbar', 'features/studio/StudioToolbar'],
  ['features/workbench/StudioIoFields', 'features/studio/StudioIoFields'],
  ['features/workbench/StudioExpertPicker', 'features/studio/StudioExpertPicker'],
  ['features/workbench/StudioStepList', 'features/studio/StudioStepList'],
  ['features/workbench/StudioWorkflowFields', 'features/studio/StudioWorkflowFields'],
  ['features/workbench/StudioAgentFields', 'features/studio/StudioAgentFields'],
  ['features/workbench/useStudioGraphCheck', 'features/studio/useStudioGraphCheck'],
  ['features/workbench/ManageSurface', 'features/manage/ManageSurface'],
  ['features/workbench/ManageAutomationModal', 'features/manage/ManageAutomationModal'],
  ['features/workbench/ManageAutomationForm', 'features/manage/ManageAutomationForm'],
  ['features/workbench/ManageWorkflowCard', 'features/manage/ManageWorkflowCard'],
  ['features/workbench/DaemonComposePanel', 'features/manage/DaemonComposePanel'],
  ['features/workbench/WorkspaceTreeModal', 'features/manage/WorkspaceTreeModal'],
]

function rewriteFile(file) {
  let text = fs.readFileSync(file, 'utf8')
  const orig = text
  for (const [a, b] of importMap) {
    text = text.split(a).join(b)
  }
  if (text !== orig) fs.writeFileSync(file, text)
}

for (const file of walk('src')) {
  if (/\.(ts|tsx)$/.test(file)) rewriteFile(file)
}

const cssMoves = [
  ['src/workbench-shelf.css', 'src/renderer/features/shelf/shelf.css'],
  ['src/workbench-console.css', 'src/renderer/features/run/console.css'],
  ['src/workbench-layout.css', 'src/renderer/features/workbench/workbench-layout.css'],
]
for (const [from, to] of cssMoves) {
  if (fs.existsSync(from) && !fs.existsSync(to)) {
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.renameSync(from, to)
  }
}

const storeMoves = [
  ['src/renderer/app/store-assistant.ts', 'src/renderer/features/assistant/store-assistant.ts'],
  ['src/renderer/app/store-assistant-generate.ts', 'src/renderer/features/assistant/store-assistant-generate.ts'],
  ['src/renderer/app/store-assistant-modes.ts', 'src/renderer/features/assistant/store-assistant-modes.ts'],
  ['src/renderer/app/store-session.ts', 'src/renderer/features/assistant/store-session.ts'],
  ['src/renderer/app/store-knowledge.ts', 'src/renderer/features/knowledge/store-knowledge.ts'],
  ['src/renderer/app/store-workbench.ts', 'src/renderer/features/workbench/store-workbench.ts'],
  ['src/renderer/app/store-workbench-helpers.ts', 'src/renderer/features/workbench/store-workbench-helpers.ts'],
  ['src/renderer/app/store-workbench-dialogue.ts', 'src/renderer/features/workbench/store-workbench-dialogue.ts'],
  ['src/renderer/app/store-studio.ts', 'src/renderer/features/studio/store-studio.ts'],
]
for (const [from, to] of storeMoves) {
  if (fs.existsSync(from) && !fs.existsSync(to)) fs.renameSync(from, to)
}

console.log('moves done')

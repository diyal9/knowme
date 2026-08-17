import { AppShell } from '../app/AppShell'
import '../app/sticky-icons'
import '../app/tokens.css' // 仅 :root token；壳层与各面样式在下面，勿再往 tokens 写组件布局
import '../styles/workspace-chrome.css'
import '../features/workbench/workbench-layout.css'
import '../features/run/console.css'
import '../features/shelf/shelf.css'
import '../../secondary-dialog.css'
import '../styles/capability-hub.css'
import '../styles/workspace-overlays.css'
import '../app/legacy-bridge.css'

export function WorkspaceApp() {
  return <AppShell />
}

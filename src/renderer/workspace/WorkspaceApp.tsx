import { useEffect } from 'react'
import { AppShell } from '../app/AppShell'
import '../app/knowme-icons'
import '../app/tokens.css' // 仅 :root token；壳层样式在下，勿再往 tokens 写组件布局
import '../styles/workspace-chrome.css' // 壳：rail / side / main
import '../app/ui-system.css'
import '../styles/agent-chrome.css' // 默认助理路由：对话列样式
import '../styles/workspace-overlays.css'
import '../app/legacy-bridge.css'

/**
 * 工作台根：静态注入壳 + 助理样式。
 * 工作台顶栏见 workbench-chrome（AppShell 静态导入）；各表面 CSS 由 feature 模块自带。
 */
export function WorkspaceApp() {
  useEffect(() => {
    // 与主进程 KNOWME_UI_THROTTLE 对齐：远程/降级时关掉昂贵 blur
    if (window.knowme?.perf?.uiThrottle) {
      document.documentElement.dataset.uiThrottle = '1'
    } else {
      delete document.documentElement.dataset.uiThrottle
    }
  }, [])
  return <AppShell />
}

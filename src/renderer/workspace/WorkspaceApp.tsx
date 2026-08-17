import { useEffect } from 'react'
import { AppShell } from '../app/AppShell'
import '../app/knowme-icons'
import '../app/tokens.css' // 仅 :root token；壳层样式在下，勿再往 tokens 写组件布局
import '../styles/workspace-chrome.css'
import '../styles/workspace-overlays.css'
import '../app/legacy-bridge.css'

/**
 * 工作台根：只静态注入壳样式。
 * workbench/hub/run/shelf 等大表 CSS 由 AppShell 按路由 ensureSurfaceCss 懒加载。
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

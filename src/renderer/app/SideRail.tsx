import { RAIL_ITEMS, type AppRoute } from '../../domain/rail'
import { Icon } from './Icon'
import { useAppStore } from './store'

const ICONS: Record<AppRoute, string> = {
  assistant: 'robot',
  workbench: 'workbench',
  capabilities: 'capabilityStack',
  automation: 'automation',
  knowledge: 'bookOpen',
  settings: 'settingsLine',
}

export function SideRail() {
  const route = useAppStore((s) => s.route)
  const setRoute = useAppStore((s) => s.setRoute)
  const openAutomationCenter = useAppStore((s) => s.openAutomationCenter)
  const openWorkbenchRail = useAppStore((s) => s.openWorkbenchRail)
  const openSettingsSurface = useAppStore((s) => s.openSettingsSurface)
  const filesOpen = useAppStore((s) => s.filesOpen)
  const toggleFiles = useAppStore((s) => s.toggleFiles)

  function railBtn(id: AppRoute) {
    const item = RAIL_ITEMS.find((r) => r.id === id)!
    const active = route === id
    return (
      <button
        key={id}
        type="button"
        className={`rail-btn${active ? ' active' : ''}`}
        id={id === 'assistant' ? 'btnRailAi' : id === 'workbench' ? 'btnRailWorkbench' : id === 'capabilities' ? 'btnRailCapabilities' : id === 'automation' ? 'btnRailAutomation' : id === 'settings' ? 'btnSettings' : 'btnKnowledgeOs'}
        title={item.title}
        aria-label={item.title}
        aria-pressed={active}
        onClick={() => {
          if (id === 'automation') {
            openAutomationCenter()
            return
          }
          if (id === 'workbench') {
            openWorkbenchRail()
            return
          }
          if (id === 'settings') {
            if (route === 'settings') {
              setRoute('assistant')
              return
            }
            openSettingsSurface()
            window.api?.openSettings?.()
            return
          }
          setRoute(id)
        }}
      >
        <Icon name={ICONS[id]} />
        <span className="rail-label">{item.label}</span>
      </button>
    )
  }

  return (
    <nav className="side-rail" aria-label="主导航">
      <div className="rail-top">
        <button
          type="button"
          className="rail-btn"
          id="btnToggleSide"
          title="展开文件列表"
          aria-label="收起或展开左侧文件栏"
          aria-pressed={filesOpen}
          onClick={toggleFiles}
        >
          <Icon name="sidePanel" />
          <span className="rail-label">文件</span>
        </button>
        {railBtn('assistant')}
        {railBtn('workbench')}
        {railBtn('capabilities')}
      </div>
      <div className="rail-capabilities" role="toolbar" aria-label="自动化中心">
        {railBtn('automation')}
      </div>
      <div className="rail-foot" role="toolbar" aria-label="知识库与设置">
        {railBtn('knowledge')}
        {railBtn('settings')}
      </div>
    </nav>
  )
}

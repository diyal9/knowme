import { useEffect, useMemo, useRef, useState } from 'react'
import type { ProjectRef } from '../../shared/api'
import { Icon } from './Icon'
import { useAppStore } from './store'

function projectStatusLabel(project: ProjectRef | null) {
  if (!project) return '尚未选择'
  if (project.status === 'missing') return '目录不可用'
  if (project.status === 'readonly') return '只读'
  if (project.status === 'archived') return '已归档'
  const type = String(project.workspace?.type || '')
  if (type === 'gitlab') return 'GitLab'
  if (type === 'github') return 'GitHub'
  return '本地项目'
}

export function ProjectContextSwitcher() {
  const projects = useAppStore((state) => state.projects)
  const activeProjectId = useAppStore((state) => state.activeProjectId)
  const selectProject = useAppStore((state) => state.selectProject)
  const [menuOpen, setMenuOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) || null,
    [activeProjectId, projects],
  )
  const visibleProjects = useMemo(
    () => projects.filter((project) => project.status !== 'archived'),
    [projects],
  )
  useEffect(() => {
    if (!menuOpen) return undefined
    function close(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [menuOpen])

  async function chooseProject(projectId: string) {
    setMenuOpen(false)
    if (projectId === activeProjectId) return
    await selectProject(projectId)
  }

  return (
    <div className="wb-project-context" ref={rootRef}>
      <button
        type="button"
        className={`wb-project-trigger${menuOpen ? ' is-open' : ''}${activeProject?.status === 'missing' ? ' has-warning' : ''}`}
        aria-label={`当前项目：${activeProject?.name || '尚未选择'}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <Icon name="folder" />
        <span className="wb-project-trigger-copy">
          <strong>{activeProject?.name || '选择项目'}</strong>
        </span>
        {activeProject && activeProject.status !== 'active' ? (
          <span className="wb-project-trigger-meta">{projectStatusLabel(activeProject)}</span>
        ) : null}
        <Icon name="chevronTree" />
      </button>

      {menuOpen ? (
        <div className="wb-project-menu" role="menu" aria-label="切换项目">
          <div className="wb-project-menu-heading">
            <span>切换项目</span>
          </div>
          <div className="wb-project-menu-list">
            {visibleProjects.length ? visibleProjects.map((project) => (
              <button
                key={project.id}
                type="button"
                role="menuitemradio"
                aria-checked={project.id === activeProjectId}
                className={project.id === activeProjectId ? 'is-active' : ''}
                onClick={() => void chooseProject(project.id)}
              >
                <span className="wb-project-menu-dot" aria-hidden="true" />
                <strong>{project.name}</strong>
                <span className="wb-project-menu-current">
                  {project.id === activeProjectId ? '当前' : projectStatusLabel(project)}
                </span>
              </button>
            )) : <p className="wb-project-menu-empty">暂无可切换项目。请从左侧项目菜单打开项目。</p>}
          </div>
        </div>
      ) : null}
    </div>
  )
}

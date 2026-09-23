import { useEffect, useMemo, useState } from 'react'
import type { ProjectRef } from '../../shared/api'
import { useAppStore } from './store'

function projectStatusLabel(project: ProjectRef) {
  if (project.status === 'missing') return '目录不可用'
  if (project.status === 'readonly') return '只读'
  if (project.status === 'archived') return '已归档'
  const type = String(project.workspace?.type || '')
  if (type === 'gitlab') return 'GitLab'
  if (type === 'github') return 'GitHub'
  return '本地项目'
}

interface ProjectManagerDialogProps {
  open: boolean
  onClose: () => void
  initialProjectId?: string | null
}

export function ProjectManagerDialog({ open, onClose, initialProjectId }: ProjectManagerDialogProps) {
  const projects = useAppStore((state) => state.projects)
  const activeProjectId = useAppStore((state) => state.activeProjectId)
  const loadProjects = useAppStore((state) => state.loadProjects)
  const archiveProject = useAppStore((state) => state.archiveProject)
  const relinkProject = useAppStore((state) => state.relinkProject)
  const showToast = useAppStore((state) => state.showToast)
  const [editProjectId, setEditProjectId] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [deliverablesDir, setDeliverablesDir] = useState('outputs')
  const [busy, setBusy] = useState(false)

  const editProject = useMemo(
    () => projects.find((project) => project.id === editProjectId) || null,
    [editProjectId, projects],
  )

  useEffect(() => {
    if (!open) return
    setEditProjectId(initialProjectId || activeProjectId || projects[0]?.id || '')
  }, [activeProjectId, initialProjectId, open, projects])

  useEffect(() => {
    if (!editProject) return
    setName(editProject.name || '')
    setDescription(editProject.description || '')
    setDeliverablesDir(editProject.outputPolicy?.deliverablesDir || 'outputs')
  }, [editProject])

  useEffect(() => {
    if (!open) return undefined
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose, open])

  async function saveProject() {
    if (!editProject || !name.trim()) return
    setBusy(true)
    try {
      const result = await window.api?.projectsUpdate?.(editProject.id, {
        name: name.trim(),
        description: description.trim(),
        outputPolicy: {
          ...editProject.outputPolicy,
          deliverablesDir: deliverablesDir.trim() || 'outputs',
        },
      })
      if (result?.ok === false) {
        showToast(result.error || '无法保存项目设置')
        return
      }
      await loadProjects()
      showToast('项目设置已保存')
    } catch {
      showToast('无法保存项目设置')
    } finally {
      setBusy(false)
    }
  }

  async function toggleArchive() {
    if (!editProject) return
    const restoring = editProject.status === 'archived'
    setBusy(true)
    try {
      await archiveProject(editProject.id, !restoring)
      await loadProjects()
      if (restoring) setEditProjectId(editProject.id)
      else setEditProjectId(projects.find((project) => project.id !== editProject.id && project.status !== 'archived')?.id || '')
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  return (
    <div className="wb-project-manager-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="wb-project-manager" role="dialog" aria-modal="true" aria-labelledby="wbProjectManagerTitle">
        <header>
          <h2 id="wbProjectManagerTitle">项目设置</h2>
          <button type="button" aria-label="关闭项目设置" onClick={onClose}>×</button>
        </header>
        <div className="wb-project-manager-body">
          <nav aria-label="项目列表">
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                className={project.id === editProjectId ? 'is-active' : ''}
                onClick={() => setEditProjectId(project.id)}
              >
                <span>{project.name}</span>
                <small>{projectStatusLabel(project)}</small>
              </button>
            ))}
          </nav>
          {editProject ? (
            <form onSubmit={(event) => { event.preventDefault(); void saveProject() }}>
              <label>
                <span>项目名称</span>
                <input value={name} maxLength={160} onChange={(event) => setName(event.target.value)} />
              </label>
              <label>
                <span>项目说明</span>
                <textarea value={description} maxLength={1000} rows={3} placeholder="这个项目正在完成什么？" onChange={(event) => setDescription(event.target.value)} />
              </label>
              <label>
                <span>KnowMe 归档目录</span>
                <input value={deliverablesDir} placeholder="outputs" onChange={(event) => setDeliverablesDir(event.target.value)} />
                <small>Agent 与工作流的正式成果默认写入项目工作目录下的这个相对路径。</small>
              </label>
              <div className="wb-project-manager-workspace">
                <span>工作目录</span>
                <strong title={editProject.workspace?.rootPath || ''}>{editProject.workspace?.rootPath || '目录不可用'}</strong>
              </div>
              <div className="wb-project-manager-actions">
                <button type="button" onClick={() => void window.api?.projectsOpenRoot?.(editProject.id)} disabled={!editProject.workspace?.rootPath}>打开目录</button>
                {editProject.status === 'missing' ? <button type="button" onClick={() => void relinkProject(editProject.id)}>重新定位</button> : null}
                <button type="button" className="danger" disabled={busy} onClick={() => void toggleArchive()}>{editProject.status === 'archived' ? '恢复项目' : '归档项目'}</button>
                <button type="submit" className="primary" disabled={busy || !name.trim()}>{busy ? '保存中…' : '保存设置'}</button>
              </div>
              <p className="wb-project-manager-note">归档只会从可用项目中隐藏，不会删除本地文件或历史数据。</p>
            </form>
          ) : (
            <div className="wb-project-manager-empty">选择一个项目进行管理。</div>
          )}
        </div>
      </section>
    </div>
  )
}

import { useState } from 'react'
import { SettingsAboutPanel } from './SettingsAboutPanel'
import { SettingsAiPanel } from './SettingsAiPanel'
import { SettingsAssistantPanel } from './SettingsAssistantPanel'
import { SettingsConnectorsPanel } from './SettingsConnectorsPanel'
import { SettingsMemoryPanel } from './SettingsMemoryPanel'
import { SettingsSourcesPanel } from './SettingsSourcesPanel'
import { SettingsSystemPanel } from './SettingsSystemPanel'
import './settings.css'
import { type SettingsTabId, useSettingsForm } from './useSettingsForm'

const TABS: { id: SettingsTabId; label: string }[] = [
  { id: 'sources', label: '内容源' },
  { id: 'ai', label: 'AI 接口' },
  { id: 'assistant', label: '助手模式' },
  { id: 'system', label: '系统配置' },
  { id: 'connectors', label: '连接器' },
  { id: 'memory', label: '我的记忆' },
  { id: 'about', label: '关于' },
]

export type SettingsSurfaceProps = {
  embedded?: boolean
  initialTab?: string
  onOpenCapabilityHub?: () => void
}

export function SettingsSurface({
  embedded = false,
  initialTab,
  onOpenCapabilityHub,
}: SettingsSurfaceProps) {
  const {
    tab,
    setTab,
    form,
    patch,
    sources,
    gitAvailable,
    refreshSources,
    dirty,
    saving,
    save,
    toast,
    toastKind,
    flash,
  } = useSettingsForm(initialTab)

  const [gitlabProject, setGitlabProject] = useState('')
  const [gitlabBranch, setGitlabBranch] = useState('main')
  const [githubRepoUrl, setGithubRepoUrl] = useState('')
  const [githubBranch, setGithubBranch] = useState('main')
  const [webPageUrl, setWebPageUrl] = useState('')

  const addGitlab = async () => {
    const result = await window.api?.sourcesAddGitlab?.({
      host: form.gitlabHost,
      project: gitlabProject,
      token: form.gitlabToken,
      branch: gitlabBranch,
    })
    if (result?.ok) {
      flash('GitLab 源已添加')
      void refreshSources()
    } else {
      flash(result?.error || '添加失败', 'err')
    }
  }

  const addGithub = async () => {
    const result = await window.api?.sourcesAddGithub?.({
      repoUrl: githubRepoUrl,
      token: form.githubToken,
      branch: githubBranch,
    })
    if (result?.ok) {
      flash('GitHub 源已添加')
      void refreshSources()
    } else {
      flash(result?.error || '添加失败', 'err')
    }
  }

  return (
    <div className={`settings-root${embedded ? ' settings-embedded' : ''}`} data-testid="settings-surface">
      <header className="settings-titlebar">
        <div className="settings-titlebar-brand">KnowMe / Preferences</div>
        <h1>设置</h1>
        <p>管理内容源、AI 能力与个人工作偏好</p>
        <div className="settings-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              className={`settings-tab${tab === t.id ? ' active' : ''}`}
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <div className="settings-scroll" role="tabpanel">
        {tab === 'sources' ? (
          <SettingsSourcesPanel
            sources={sources}
            gitlabHost={form.gitlabHost || ''}
            gitlabProject={gitlabProject}
            gitlabToken={form.gitlabToken || ''}
            gitlabBranch={gitlabBranch}
            githubRepoUrl={githubRepoUrl}
            githubToken={form.githubToken || ''}
            githubBranch={githubBranch}
            webPageUrl={webPageUrl}
            onGitlabHost={(v) => patch({ gitlabHost: v })}
            onGitlabProject={setGitlabProject}
            onGitlabToken={(v) => patch({ gitlabToken: v })}
            onGitlabBranch={setGitlabBranch}
            onGithubRepoUrl={setGithubRepoUrl}
            onGithubToken={(v) => patch({ githubToken: v })}
            onGithubBranch={setGithubBranch}
            onWebPageUrl={setWebPageUrl}
            onRefresh={() => void refreshSources()}
            onAddLocal={async () => {
              const result = await window.api?.sourcesAddLocal?.()
              if (result?.ok) {
                flash('本地文件夹已添加')
                void refreshSources()
              } else {
                flash(result?.error || '添加失败', 'err')
              }
            }}
            onAddGitlab={() => void addGitlab()}
            onAddGithub={() => void addGithub()}
            onAddWeb={async () => {
              const result = await window.api?.sourcesAddWeb?.({ url: webPageUrl })
              if (result?.ok) {
                flash('网页资料已添加')
                void refreshSources()
              } else {
                flash(result?.error || '添加失败', 'err')
              }
            }}
            onRemove={async (id) => {
              await window.api?.sourcesRemove?.(id)
              void refreshSources()
            }}
            onSync={async (id) => {
              const result = await window.api?.sourcesSync?.(id)
              if (result?.ok) flash('同步完成')
              else flash(result?.error || '同步失败', 'err')
            }}
            gitAvailable={gitAvailable}
          />
        ) : null}
        {tab === 'ai' ? <SettingsAiPanel form={form} onPatch={patch} /> : null}
        {tab === 'assistant' ? (
          <SettingsAssistantPanel form={form} onPatch={patch} onOpenCapabilityHub={onOpenCapabilityHub} />
        ) : null}
        {tab === 'system' ? <SettingsSystemPanel form={form} onPatch={patch} flash={flash} /> : null}
        {tab === 'connectors' ? <SettingsConnectorsPanel form={form} onPatch={patch} flash={flash} /> : null}
        {tab === 'memory' ? <SettingsMemoryPanel form={form} onPatch={patch} flash={flash} dirty={dirty} /> : null}
        {tab === 'about' ? <SettingsAboutPanel flash={flash} /> : null}
      </div>

      <footer className="settings-footer">
        <span className={`settings-toast${toastKind ? ` ${toastKind}` : ''}`}>{toast || (dirty ? '有未保存的修改' : '')}</span>
        <button type="button" className="settings-btn primary" disabled={saving || !dirty} onClick={() => void save()}>
          {saving ? '保存中…' : '保存设置'}
        </button>
      </footer>
    </div>
  )
}

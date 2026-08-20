import { useState } from 'react'
import { SettingsAboutPanel } from './SettingsAboutPanel'
import { SettingsAiPanel } from './SettingsAiPanel'
import { SettingsConnectorsPanel } from './SettingsConnectorsPanel'
import { SettingsMemoryPanel } from './SettingsMemoryPanel'
import { SettingsSourcesPanel } from './SettingsSourcesPanel'
import { SettingsSystemPanel } from './SettingsSystemPanel'
import { SettingsUserProfilePanel } from './SettingsUserProfilePanel'
import './settings.css'
import { type SettingsTabId, useSettingsForm } from './useSettingsForm'

const TAB_GROUPS: { label: string; tabs: { id: SettingsTabId; label: string; description: string }[] }[] = [
  {
    label: '个人',
    tabs: [
      { id: 'profile', label: '个人档案', description: '身份、领域与协作偏好' },
      { id: 'memory', label: '我的记忆', description: '查看和管理长期记忆' },
    ],
  },
  {
    label: '工作内容',
    tabs: [{ id: 'sources', label: '内容源', description: '本地文件夹、仓库与网页资料' }],
  },
  {
    label: '能力',
    tabs: [
      { id: 'ai', label: 'AI 接口', description: '模型、接口与连接测试' },
      { id: 'connectors', label: '服务授权', description: '飞书、MCP 与 Agent 服务' },
    ],
  },
  {
    label: '应用',
    tabs: [{ id: 'system', label: '系统配置', description: '启动、数据与应用行为' }],
  },
  {
    label: '其他',
    tabs: [{ id: 'about', label: '关于', description: '版本、更新与联系信息' }],
  },
]

export type SettingsSurfaceProps = {
  embedded?: boolean
  initialTab?: string
}

export function SettingsSurface({
  embedded = false,
  initialTab,
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
  const [sourceBusy, setSourceBusy] = useState<string | null>(null)
  const showSaveFooter = ['profile', 'ai', 'system', 'connectors'].includes(tab)

  const runSourceAction = async (key: string, action: () => Promise<void>) => {
    if (sourceBusy) return
    setSourceBusy(key)
    try {
      await action()
    } finally {
      setSourceBusy(null)
    }
  }

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
        <div className="settings-titlebar-brand">KNOWME</div>
        <h1>设置</h1>
        <p>管理个人信息、内容来源与系统能力</p>
      </header>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="设置分类">
          {TAB_GROUPS.map((group) => (
            <div className="settings-nav-group" key={group.label}>
              <div className="settings-nav-label">{group.label}</div>
              <div className="settings-tabs" role="tablist" aria-label={group.label}>
                {group.tabs.map((t) => (
                  <button
                    key={t.id}
                    id={`settings-tab-${t.id}`}
                    type="button"
                    role="tab"
                    className={`settings-tab${tab === t.id ? ' active' : ''}`}
                    aria-selected={tab === t.id}
                    aria-controls="settings-tabpanel"
                    onClick={() => setTab(t.id)}
                  >
                    <span className="settings-tab-label">{t.label}</span>
                    <span className="settings-tab-description" aria-hidden="true">{t.description}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <main className="settings-scroll" id="settings-tabpanel" role="tabpanel" aria-labelledby={`settings-tab-${tab}`}>
        {tab === 'profile' ? <SettingsUserProfilePanel form={form} onPatch={patch} /> : null}
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
            onRefresh={() => runSourceAction('refresh', async () => { await refreshSources(); flash('来源列表已刷新') })}
            onAddLocal={() => runSourceAction('local', async () => {
              const result = await window.api?.sourcesAddLocal?.()
              if (result?.ok) { flash('本地文件夹已添加'); await refreshSources() }
              else flash(result?.error || '添加失败', 'err')
            })}
            onAddGitlab={() => runSourceAction('gitlab', addGitlab)}
            onAddGithub={() => runSourceAction('github', addGithub)}
            onAddWeb={() => runSourceAction('web', async () => {
              const result = await window.api?.sourcesAddWeb?.({ url: webPageUrl })
              if (result?.ok) { flash('网页资料已添加'); await refreshSources() }
              else flash(result?.error || '添加失败', 'err')
            })}
            onRemove={(id) => runSourceAction(`remove:${id}`, async () => {
              await window.api?.sourcesRemove?.(id)
              await refreshSources()
              flash('内容源已移除')
            })}
            onSync={(id) => runSourceAction(`sync:${id}`, async () => {
              const result = await window.api?.sourcesSync?.(id)
              if (result?.ok) flash('同步完成')
              else flash(result?.error || '同步失败', 'err')
              await refreshSources()
            })}
            gitAvailable={gitAvailable}
            busyAction={sourceBusy}
          />
        ) : null}
        {tab === 'ai' ? <SettingsAiPanel form={form} onPatch={patch} /> : null}
        {tab === 'system' ? <SettingsSystemPanel form={form} onPatch={patch} flash={flash} /> : null}
        {tab === 'connectors' ? <SettingsConnectorsPanel form={form} onPatch={patch} flash={flash} /> : null}
        {tab === 'memory' ? <SettingsMemoryPanel flash={flash} /> : null}
        {tab === 'about' ? <SettingsAboutPanel flash={flash} /> : null}
        </main>
      </div>

      {showSaveFooter ? <footer className="settings-footer">
        <span className={`settings-toast${toastKind ? ` ${toastKind}` : ''}`}>{toast || (dirty ? '有未保存的修改' : '')}</span>
        <button type="button" className="settings-btn primary" disabled={saving || !dirty} onClick={() => void save()}>
          {saving ? '保存中…' : '保存设置'}
        </button>
      </footer> : null}
    </div>
  )
}

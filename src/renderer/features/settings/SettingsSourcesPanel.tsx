import type { ContentSourceRef } from '../../../shared/api'

type Props = {
  sources: ContentSourceRef[]
  gitlabHost: string
  gitlabProject: string
  gitlabToken: string
  gitlabBranch: string
  githubRepoUrl: string
  githubToken: string
  githubBranch: string
  webPageUrl: string
  onGitlabHost: (v: string) => void
  onGitlabProject: (v: string) => void
  onGitlabToken: (v: string) => void
  onGitlabBranch: (v: string) => void
  onGithubRepoUrl: (v: string) => void
  onGithubToken: (v: string) => void
  onGithubBranch: (v: string) => void
  onWebPageUrl: (v: string) => void
  onRefresh: () => void
  onAddLocal: () => void
  onAddGitlab: () => void
  onAddGithub: () => void
  onAddWeb: () => void
  onRemove: (id: string) => void
  onSync: (id: string) => void
  gitAvailable?: boolean
  busyAction?: string | null
}

export function SettingsSourcesPanel(props: Props) {
  const {
    sources,
    gitlabHost,
    gitlabProject,
    gitlabToken,
    gitlabBranch,
    githubRepoUrl,
    githubToken,
    githubBranch,
    webPageUrl,
    onGitlabHost,
    onGitlabProject,
    onGitlabToken,
    onGitlabBranch,
    onGithubRepoUrl,
    onGithubToken,
    onGithubBranch,
    onWebPageUrl,
    onRefresh,
    onAddLocal,
    onAddGitlab,
    onAddGithub,
    onAddWeb,
    onRemove,
    onSync,
    gitAvailable,
    busyAction,
  } = props

  return (
    <>
      <div className="settings-section">
        <div className="settings-section-head">
          <div className="settings-section-title">内容源</div>
          <span className="settings-badge">Local / GitLab / GitHub / Web</span>
        </div>
        <p className="settings-intro">
          知我的知识来自你绑定的本地文件夹、GitLab/GitHub 仓库或网页资料。应用数据目录只保存会话与设置，不再把正文锁在便签 JSON 里。
        </p>
        <div className="settings-actions">
          <button type="button" className="settings-btn primary" disabled={Boolean(busyAction)} onClick={onAddLocal}>
            {busyAction === 'local' ? '选择中…' : '添加本地文件夹'}
          </button>
          <button type="button" className="settings-btn" disabled={Boolean(busyAction)} onClick={onRefresh}>
            {busyAction === 'refresh' ? '刷新中…' : '刷新列表'}
          </button>
        </div>
        <div className="settings-sources-list" data-testid="settings-sources-list">
          {sources.length === 0 ? (
          <p className="settings-hint">尚未添加内容源。可添加本地文件夹、GitLab/GitHub 仓库或网页资料。</p>
          ) : (
            sources.map((s) => (
              <div key={s.id} className="settings-source-row">
                <div>
                  <strong>{s.displayName || s.id}</strong>
                  <small>{s.type}{s.rootPath ? ` · ${s.rootPath}` : ''}</small>
                </div>
                <div className="settings-actions settings-actions-inline">
                  <button type="button" className="settings-btn" disabled={Boolean(busyAction)} onClick={() => onSync(s.id)}>
                    {busyAction === `sync:${s.id}` ? '同步中…' : '同步'}
                  </button>
                  <button type="button" className="settings-btn" disabled={Boolean(busyAction)} onClick={() => onRemove(s.id)}>
                    {busyAction === `remove:${s.id}` ? '移除中…' : '移除'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-head">
          <div className="settings-section-title">GitLab</div>
          <span className="settings-badge">远程仓库</span>
        </div>
        <details className="settings-source-details">
          <summary>配置 GitLab 仓库</summary>
        <div className="settings-grid">
          <div className="settings-field">
            <label htmlFor="gitlabHost">实例地址</label>
            <input id="gitlabHost" value={gitlabHost} onChange={(e) => onGitlabHost(e.target.value)} placeholder="https://gitlab.com 或公司 GitLab" />
          </div>
          <div className="settings-field">
            <label htmlFor="gitlabProject">项目路径</label>
            <input id="gitlabProject" value={gitlabProject} onChange={(e) => onGitlabProject(e.target.value)} placeholder="group/subgroup/project" />
          </div>
          <div className="settings-field full">
            <label htmlFor="gitlabToken">Personal Access Token</label>
            <input id="gitlabToken" type="password" value={gitlabToken} onChange={(e) => onGitlabToken(e.target.value)} placeholder="需要 read_repository 权限" autoComplete="off" />
            <div className="settings-hint">Token 经系统加密保存在本地，不会写入 sources.json。</div>
          </div>
          <div className="settings-field full">
            <label htmlFor="gitlabBranch">分支</label>
            <input id="gitlabBranch" value={gitlabBranch} onChange={(e) => onGitlabBranch(e.target.value)} />
          </div>
        </div>
        <div className="settings-actions">
          <button type="button" className="settings-btn primary" disabled={Boolean(busyAction)} onClick={onAddGitlab}>
            {busyAction === 'gitlab' ? '克隆中…' : '克隆并添加'}
          </button>
          <span className="settings-hint" data-testid="git-avail-hint">
            {gitAvailable === true ? '已检测到本机 git' : gitAvailable === false ? '未检测到 git（GitLab / GitHub 克隆需要）' : ''}
          </span>
        </div>
        </details>
      </div>

      <div className="settings-section">
        <div className="settings-section-head">
          <div className="settings-section-title">GitHub</div>
          <span className="settings-badge">远程仓库</span>
        </div>
        <details className="settings-source-details">
          <summary>配置 GitHub 仓库</summary>
        <div className="settings-grid">
          <div className="settings-field full">
            <label htmlFor="githubRepoUrl">仓库地址</label>
            <input id="githubRepoUrl" value={githubRepoUrl} onChange={(e) => onGithubRepoUrl(e.target.value)} placeholder="https://github.com/org/repo" />
          </div>
          <div className="settings-field full">
            <label htmlFor="githubToken">Personal Access Token（可选）</label>
            <input id="githubToken" type="password" value={githubToken} onChange={(e) => onGithubToken(e.target.value)} placeholder="私有仓库需要 repo 读权限" autoComplete="off" />
            <div className="settings-hint">公开仓库可不填 Token；Token 经系统加密保存在本地。</div>
          </div>
          <div className="settings-field full">
            <label htmlFor="githubBranch">分支</label>
            <input id="githubBranch" value={githubBranch} onChange={(e) => onGithubBranch(e.target.value)} />
          </div>
        </div>
        <div className="settings-actions">
          <button type="button" className="settings-btn primary" disabled={Boolean(busyAction)} onClick={onAddGithub}>
            {busyAction === 'github' ? '克隆中…' : '克隆并添加'}
          </button>
        </div>
        </details>
      </div>

      <div className="settings-section">
        <div className="settings-section-head">
          <div className="settings-section-title">网页资料</div>
          <span className="settings-badge">公开网页</span>
        </div>
        <p className="settings-intro">抓取公开网页正文并缓存为只读资料，供工作台浏览与写作助手引用。不支持需要登录的页面。</p>
        <details className="settings-source-details">
          <summary>配置网页资料</summary>
        <div className="settings-field">
          <label htmlFor="webPageUrl">网页 URL</label>
          <input id="webPageUrl" value={webPageUrl} onChange={(e) => onWebPageUrl(e.target.value)} placeholder="https://example.com/article" />
        </div>
        <div className="settings-actions">
          <button type="button" className="settings-btn primary" disabled={Boolean(busyAction)} onClick={onAddWeb}>
            {busyAction === 'web' ? '抓取中…' : '抓取并添加'}
          </button>
        </div>
        </details>
      </div>
    </>
  )
}

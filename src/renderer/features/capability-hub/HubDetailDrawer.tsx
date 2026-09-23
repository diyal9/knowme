import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import '../../../secondary-dialog.css'
import {
  hubOriginLabel,
  connectorType,
  hubSourceLabel,
  isCapabilityInstalled,
  isExpertQualificationLimited,
  isExpertRuntimeLimited,
  isCuratedExpert,
  isLocalExpert,
  type HubCapabilityItem,
} from '../../../domain/capability-hub'
import { capabilityPermissionRows, capabilityRiskLabel, capabilityStatusLabel } from '../../../domain/capability-display'
import { catalogRefIds } from '../../../domain/hub-expert-editor'
import { useCapabilityReferences } from './useCapabilityReferences'
import { Icon } from '../../app/Icon'
import { useAppStore } from '../../app/store'
import { HubCapabilityIcon } from './HubCapabilityIcon'
import { HubStatusBadges } from './HubStatusBadges'
import { HubConnectorManager } from './HubConnectorManager'

type Props = {
  item: HubCapabilityItem
  isMine?: boolean
  onClose: () => void
  onChanged: () => void | Promise<void>
  onEditExpert: (item: HubCapabilityItem, mode: 'tune' | 'copy') => void
  onOpenWorkbench: (item: HubCapabilityItem) => void
  onManageSkill: (item: HubCapabilityItem) => void
}

function listValues(values: unknown[]): string[] {
  return values.map((value) => {
    if (typeof value === 'string') return value
    if (value && typeof value === 'object') {
      const rec = value as { name?: string; id?: string }
      return String(rec.name || rec.id || '')
    }
    return ''
  }).filter(Boolean)
}

type ConnectorInterface = { name: string; description: string; params: string[] }

type InstallPreview = {
  name?: string
  risk?: { level?: string; reasons?: string[] }
  permissions?: Record<string, unknown>
  dependencies?: {
    requiredIssues?: Array<{ message?: string }>
    optionalWarnings?: Array<{ message?: string }>
  }
  rollbackHint?: string
}

type CapabilityActionResult = {
  ok?: boolean
  code?: string
  error?: string
  needsRiskConfirmation?: boolean
  risk?: InstallPreview['risk']
  preview?: InstallPreview
}

const FEISHU_INTERFACES: ConnectorInterface[] = [
  { name: 'feishu.search_docs', description: '搜索飞书文档与知识库', params: ['query: string'] },
  { name: 'feishu.read_doc', description: '读取指定飞书文档', params: ['doc_token?: string', 'url?: string'] },
  { name: 'feishu.query_bitable', description: '查询飞书多维表格', params: ['app_token?: string', 'table_id?: string', 'data?: object', 'filter?: string', 'limit?: number'] },
  { name: 'feishu.list_wiki_spaces', description: '列出可访问的知识库空间', params: ['page_all?: boolean'] },
  { name: 'feishu.list_wiki_nodes', description: '列出知识库节点', params: ['space_id: string', 'parent_node_token?: string', 'page_all?: boolean'] },
  { name: 'feishu.get_wiki_node', description: '读取知识库节点', params: ['node_token?: string', 'url?: string'] },
  { name: 'feishu.meeting_candidates', description: '列出近期参加的会议', params: ['days?: number'] },
  { name: 'feishu.meeting_read', description: '读取指定会议内容', params: ['minute_token?: string', 'doc_token?: string', 'url?: string'] },
  { name: 'feishu.related_chats', description: '整理与我相关的聊天', params: ['days?: number'] },
  { name: 'feishu.today_priority', description: '汇总日程、待办与 @我 消息', params: ['include_mentions?: boolean'] },
]

function connectorInterfaces(item: HubCapabilityItem): ConnectorInterface[] {
  if (item.id === 'feishu') return FEISHU_INTERFACES
  return [{ name: `connector_${item.id.replace(/[^a-zA-Z0-9_]/g, '_')}_call`, description: '调用连接器配置的命令行工具', params: ['args?: string[]'] }]
}

export function HubDetailDrawer({ item, isMine = false, onClose, onChanged, onEditExpert, onOpenWorkbench, onManageSkill }: Props) {
  const showToast = useAppStore((s) => s.showToast)
  const openSettingsSurface = useAppStore((s) => s.openSettingsSurface)
  const modes = useAppStore((s) => s.modes)
  const hubItems = useCapabilityReferences() as HubCapabilityItem[]
  const installed = isCapabilityInstalled(item) || ['installed', 'enabled', 'disabled'].includes(String(item.status || ''))
  const bound = modes.some((mode) => (mode.bindings || []).some((bind) => bind.expertId === item.id))
  const [busy, setBusy] = useState('')
  const [packageContent, setPackageContent] = useState('')
  const [packageLoading, setPackageLoading] = useState(false)
  const [summonPreview, setSummonPreview] = useState<InstallPreview | null>(null)

  useEffect(() => {
    if (item.kind !== 'skill' || !window.api?.skillPackageFile) return
    let cancelled = false
    setPackageLoading(true)
    void window.api.skillPackageFile({ skillId: item.id, path: 'SKILL.md' }).then((result) => {
      if (!cancelled) {
        setPackageContent(result?.ok ? String(result.content || '') : String(result?.error || '文件不可读'))
        setPackageLoading(false)
      }
    }).catch(() => {
      if (!cancelled) {
        setPackageContent('文件不可读')
        setPackageLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [item.id, item.kind])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (summonPreview) setSummonPreview(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, summonPreview])

  async function run(act: string) {
    setBusy(act)
    try {
      let result: CapabilityActionResult | undefined
      if (act === 'install') result = await window.api?.capabilityInstall?.({ id: item.id, kind: item.kind }) as typeof result
      if (act.startsWith('install:')) {
        const [, dependencyKind, dependencyId] = act.split(':')
        result = await window.api?.capabilityInstall?.({ id: dependencyId, kind: dependencyKind }) as typeof result
      }
      if (act === 'uninstall') result = await window.api?.capabilityUninstall?.({ id: item.id }) as typeof result
      if (act === 'enable') result = await window.api?.capabilityEnable?.({ id: item.id }) as typeof result
      if (act === 'disable') result = await window.api?.capabilityDisable?.({ id: item.id }) as typeof result
      if (act === 'update') result = await window.api?.capabilityUpdate?.({ id: item.id }) as typeof result
      if (act === 'addMyExpert' || act === 'confirmAddMyExpert') {
        const riskConfirmed = act === 'confirmAddMyExpert'
        if (!riskConfirmed) {
          const checked = await window.api?.capabilityInstallPrecheck?.({ id: item.id, kind: 'expert' }) as CapabilityActionResult | undefined
          if (checked?.ok === false) throw new Error(checked.error || '专家安装预检失败')
          const preview: InstallPreview = checked?.preview || {
            name: item.name || item.id,
            risk: item.risk,
            permissions: item.permissions,
            rollbackHint: '召唤后可在专家详情中停用或卸载。',
          }
          if (['high', 'critical'].includes(String(preview.risk?.level || item.risk?.level || 'low'))) {
            setSummonPreview(preview)
            return
          }
        }
        result = await window.api?.capabilityInstall?.({
          id: item.id,
          kind: 'expert',
          ...(riskConfirmed ? { riskConfirmed: true } : {}),
        }) as typeof result
        if (!result) throw new Error('专家安装接口不可用')
        if (result.needsRiskConfirmation) {
          setSummonPreview({
            name: item.name || item.id,
            risk: result.risk || item.risk,
            permissions: item.permissions,
            rollbackHint: '召唤后可在专家详情中停用或卸载。',
          })
          return
        }
        if (result.ok === false) throw new Error(result.error || '添加专家失败')
        const binding = await window.api?.workbenchModeBindExpert?.({ expertId: item.id })
        if (binding?.ok === false) throw new Error(binding.error || '专家已添加，但设为常用失败')
        setSummonPreview(null)
        showToast(`已召唤“${item.name || item.id}”，并打开工作台专家协作`)
      }
      if (['install', 'uninstall', 'enable', 'disable', 'update'].includes(act) && !result) {
        throw new Error('能力操作接口不可用')
      }
      if (result?.ok === false) throw new Error(result.error || '操作失败')
      if (act === 'addExpert') {
        const binding = await window.api?.workbenchModeBindExpert?.({ expertId: item.id }) as { ok?: boolean; alreadyBound?: boolean; modeName?: string; error?: string } | undefined
        if (binding?.ok === false) throw new Error(binding.error || '添加失败')
        showToast(binding?.alreadyBound ? `“${item.name}”已在工作台` : `已将“${item.name}”添加到${binding?.modeName || '当前工作台'}`)
      }
      if (act === 'removeExpert') {
        const binding = await window.api?.workbenchModeUnbindExpert?.({ expertId: item.id, everywhere: true }) as { ok?: boolean; modeName?: string; error?: string } | undefined
        if (binding?.ok === false) throw new Error(binding.error || '撤回失败')
        showToast(`已从${binding?.modeName || '当前工作台'}撤回“${item.name}”`)
      }
      if (act === 'install') showToast(`已安装“${item.name || item.id}”`)
      if (act.startsWith('install:')) showToast(`已安装“${item.name || item.id}”的依赖；连接器仍需完成授权`)
      if (act === 'uninstall') showToast(`已卸载“${item.name || item.id}”`)
      if (act === 'enable') showToast(`已启用“${item.name || item.id}”`)
      if (act === 'disable') showToast(`已停用“${item.name || item.id}”`)
      if (act === 'update') showToast(`已更新“${item.name || item.id}”，新会话将使用最新版本`)
      await onChanged()
      if (act === 'uninstall') onClose()
      if (act === 'addMyExpert' || act === 'confirmAddMyExpert') onOpenWorkbench({ ...item, installed: true, enabled: true, status: 'enabled' })
    } catch (error) {
      showToast(error instanceof Error ? error.message : '操作失败')
    } finally {
      setBusy('')
    }
  }

  const declaredSkillIds = catalogRefIds(item.skills)
  const declaredConnectorIds = catalogRefIds(item.connectors)
  const dependencyItems = [...declaredSkillIds.map((id) => ({ id, kind: 'skill' as const })), ...declaredConnectorIds.map((id) => ({ id, kind: 'connector' as const }))]
    .map((dependency) => ({ ...dependency, item: hubItems.find((candidate) => candidate.id === dependency.id && candidate.kind === dependency.kind) }))
  const dependencySuggestions = dependencyItems.filter((dependency, index, all) => all.findIndex((candidate) => candidate.id === dependency.id && candidate.kind === dependency.kind) === index)
  const feishuSkillSuggestions = item.id === 'feishu'
    ? hubItems.filter((candidate) => candidate.kind === 'skill' && (candidate.dependencies || []).some((dependency) => {
      const id = typeof dependency === 'string' ? dependency : dependency?.id
      return id === 'feishu'
    }))
    : []
  const origin = hubOriginLabel(item)
  const deps = listValues(item.dependencies || [])
  const inputs = listValues(item.inputs || [])
  const outputs = listValues(item.outputs || [])
  const permissionRows = capabilityPermissionRows(item.permissions)
  const summonPermissionRows = capabilityPermissionRows(summonPreview?.permissions || item.permissions)
  const summonRisk = summonPreview?.risk || item.risk || { level: 'low', reasons: [] }
  const summonDependencyNotes = [
    ...(summonPreview?.dependencies?.requiredIssues || []),
    ...(summonPreview?.dependencies?.optionalWarnings || []),
  ].map((issue) => issue.message || '').filter(Boolean)
  const canEdit = item.kind === 'expert' && (isLocalExpert(item) || installed)
  const curated = isCuratedExpert(item)
  const qualificationLimited = isExpertQualificationLimited(item)
  const qualificationIssues = item.qualification?.issues || []
  const limitedSkills = item.qualification?.limitedSkills || []
  const runtimeLimited = isExpertRuntimeLimited(item)
  const runtimeLimitedItems = (item.readiness?.items || []).filter((dependency) => (
    dependency.required !== false && dependency.status !== 'ready'
  ))
  const runtimeIssues = (item.readiness?.issues || []).map((issue) => issue.message || issue.code || '').filter(Boolean)
  const routeReadiness = item.readiness?.routes || []
  const limitedRoutes = routeReadiness.filter((route) => route.state === 'limited')

  const dialog = (
    <>
      <div
        className="hub-drawer-backdrop secondary-dialog-mask open"
        data-testid="hub-detail-drawer-backdrop"
        onClick={() => summonPreview ? setSummonPreview(null) : onClose()}
        aria-hidden="true"
      />
      <aside
        className="hub-drawer secondary-dialog open"
        id="hubDrawer"
        role="dialog"
        aria-modal="true"
        aria-hidden={summonPreview ? true : undefined}
        aria-labelledby="hubDrawerTitle"
        data-testid="hub-detail-drawer"
      >
        <div className="hub-drawer-head secondary-dialog__head">
          <h2 id="hubDrawerTitle">{item.name || item.id}</h2>
          <button type="button" className="hub-icon-btn" aria-label="关闭详情" title="关闭详情" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="hub-drawer-body secondary-dialog__body" id="hubDrawerBody">
          <div className="hub-drawer-hero">
            <HubCapabilityIcon item={item} className="hub-card-icon" />
            <strong>{item.kind === 'connector' ? `${connectorType(item).toUpperCase()} 连接器` : `${item.category || '未分类'} · ${hubSourceLabel(item.source)}`}</strong>
            <p>{item.description || '暂无描述'}</p>
            <HubStatusBadges item={item} compact />
          </div>
          <section className="hub-drawer-section">
            <h3>元信息</h3>
            <dl className="hub-kv">
              <dt>来源</dt><dd>{hubSourceLabel(item.source)}</dd>
              <dt>分类</dt><dd>{item.category || '未分类'}</dd>
              <dt>状态</dt><dd>{capabilityStatusLabel(item.status || (installed ? 'installed' : 'available'))}</dd>
              {origin ? <><dt>原始标识</dt><dd>{origin}</dd></> : null}
              {item.contentHash ? <><dt>Hash</dt><dd>{String(item.contentHash).slice(0, 12)}…</dd></> : null}
              {item.installedAt ? <><dt>安装于</dt><dd>{item.installedAt}</dd></> : null}
            </dl>
          </section>
          {qualificationLimited ? (
            <section className="hub-drawer-section hub-qualification-warning" aria-label="专家能力资格">
              <h3>能力受限</h3>
              <p>此包已在导入时确认存在未满足的执行合同。可以查看和维护，但不能开始正式任务。</p>
              {limitedSkills.length ? <dl className="hub-kv"><dt>受限 Skill</dt><dd>{limitedSkills.join('、')}</dd></dl> : null}
              {qualificationIssues.length ? <dl className="hub-kv"><dt>问题代码</dt><dd>{qualificationIssues.join('、')}</dd></dl> : null}
            </section>
          ) : null}
          {runtimeLimited ? (
            <section className="hub-drawer-section hub-qualification-warning" aria-label="专家当前可用性">
              <h3>当前不可执行</h3>
              <p>专家包已安装，但当前环境缺少必要的 Skill 或连接器。完成安装并授权后，才能开始正式任务。</p>
              {runtimeLimitedItems.length ? (
                <dl className="hub-kv">
                  <dt>缺少依赖</dt>
                  <dd>{runtimeLimitedItems.map((dependency) => `${dependency.kind === 'connector' ? '连接器' : 'Skill'}：${dependency.id}`).join('、')}</dd>
                </dl>
              ) : null}
              {runtimeIssues.length ? <dl className="hub-kv"><dt>问题说明</dt><dd>{runtimeIssues.join('；')}</dd></dl> : null}
            </section>
          ) : null}
          {item.kind === 'expert' && routeReadiness.length ? (
            <section className="hub-drawer-section hub-route-readiness" aria-label="专家执行路径">
              <h3>执行路径</h3>
              <p>专项路径按实际调用时检查依赖；这里展示每条路径当前是否具备执行条件。</p>
              <div className="hub-route-list">
                {routeReadiness.map((route) => {
                  const routeIssues = (route.issues || []).map((issue) => issue.message || issue.code || '').filter(Boolean)
                  return (
                    <div className="hub-route-row" key={route.id}>
                      <div className="hub-route-copy">
                        <strong>{route.label || route.id}</strong>
                        <code>{route.id}</code>
                        {routeIssues.length ? <small>{routeIssues.join('；')}</small> : null}
                      </div>
                      <em className={route.state === 'limited' ? 'limited' : 'ready'}>
                        {route.state === 'limited' ? '缺少依赖' : '可用'}
                      </em>
                    </div>
                  )
                })}
              </div>
              {limitedRoutes.length ? <p className="hub-route-hint">缺失项只影响对应专项路径，不影响专家执行其它已具备条件的任务。</p> : null}
            </section>
          ) : null}
          {item.kind === 'connector' && connectorType(item) === 'cli' ? (
            <section className="hub-drawer-section hub-interface-section">
              <div className="hub-interface-head">
                <div><h3>可用接口</h3><p>以下接口会作为工具提供给 Agent，并按授权范围执行。</p></div>
                <span>{connectorInterfaces(item).length} 个</span>
              </div>
              <div className="hub-interface-list">
                {connectorInterfaces(item).map((api) => (
                  <div className="hub-interface-item" key={api.name}>
                    <div><code>{api.name}</code><p>{api.description}</p></div>
                    <div className="hub-interface-params"><span>参数</span>{api.params.map((param) => <code key={param}>{param}</code>)}</div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {item.kind === 'expert' ? (
            <section className="hub-drawer-section">
              <h3>装配</h3>
              <dl className="hub-detail-list">
                <div><dt>技能</dt><dd>{dependencySuggestions.filter(dep => dep.kind === 'skill').map((dep, index) => dep.item?.name || `技能 ${index + 1}`).join('、') || '未配置技能'}</dd></div>
                <div><dt>连接器</dt><dd>{dependencySuggestions.filter(dep => dep.kind === 'connector').map((dep, index) => dep.item?.name || `连接器 ${index + 1}`).join('、') || '未配置连接器'}</dd></div>
              </dl>
              {dependencySuggestions.length ? (
                <div className="hub-dependency-list" aria-label="专家依赖安装建议">
                  <strong>安装建议</strong>
                  {dependencySuggestions.map(({ id, kind, item: dependency }, index) => {
                    const ready = !!dependency && isCapabilityInstalled(dependency)
                    return (
                      <div className="hub-dependency-row" key={`${kind}:${id}`}>
                        <span><b>{dependency?.name || `${kind === 'connector' ? '连接器' : '技能'} ${index + 1}`}</b><small>{kind === 'connector' ? '连接器' : 'Skill'}</small></span>
                        {ready ? <em className="ready">已安装</em> : (
                          <button type="button" className="hub-btn compact" disabled={!!busy || !dependency} onClick={() => dependency && void run(`install:${kind}:${id}`)}>
                            {busy === `install:${kind}:${id}` ? '安装中…' : '建议安装'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                  {dependencySuggestions.some(({ kind, item: dependency }) => kind === 'connector' && dependency && isCapabilityInstalled(dependency)) ? <p className="hub-dependency-hint">连接器安装后仍需完成授权，授权成功后专家才会开始执行。</p> : null}
                </div>
              ) : null}
            </section>
          ) : null}
          {item.kind === 'skill' ? (
            <section className="hub-drawer-section hub-skill-usage-note">
              <h3>技能如何使用</h3>
              <p>技能不会作为独立伙伴出现在工作台。安装后，可以装备给智能伙伴或“我的专家”。</p>
            </section>
          ) : null}
          {item.kind === 'skill' ? (
            <section className="hub-drawer-section hub-skill-package" data-testid="hub-skill-package">
              <div className="hub-skill-package-head">
                <div>
                  <h3>技能包文件</h3>
                  <p>只读预览技能包中的标准说明文件。</p>
                </div>
                <code className="hub-skill-package-file">SKILL.md</code>
              </div>
              <pre className="hub-skill-package-code" aria-label="SKILL.md 文件内容">{packageLoading ? '读取中…' : packageContent || '暂无 SKILL.md 内容'}</pre>
            </section>
          ) : null}
          {item.kind === 'connector' && installed ? (
            <section className="hub-drawer-section">
              <h3>配置与授权</h3>
              {item.id === 'feishu' ? (
                <>
                  <p>飞书连接器底层统一使用本机 <code>lark-cli</code>。授权范围和登录状态在设置中统一管理；这里安装的飞书能力包，会在其上提供更精确的工具手册、调用顺序和结果规范。</p>
                  <button type="button" className="hub-btn primary" onClick={() => openSettingsSurface('connectors')}>前往设置授权</button>
                </>
              ) : <HubConnectorManager connectorId={item.id} onChanged={onChanged} />}
            </section>
          ) : null}
          {item.kind === 'connector' && item.id === 'feishu' && feishuSkillSuggestions.length ? (
            <section className="hub-drawer-section" data-testid="feishu-productized-capabilities">
              <h3>飞书产品化能力</h3>
              <p>连接器提供 lark-cli 的基础执行能力；安装下面的能力包后，Agent 才会按对应场景使用专用工具和工作方案。</p>
              <div className="hub-dependency-list">
                {feishuSkillSuggestions.map((skill) => {
                  const ready = isCapabilityInstalled(skill)
                  const action = `install:skill:${skill.id}`
                  return (
                    <div className="hub-dependency-row" key={skill.id}>
                      <span><b>{skill.name || skill.id}</b><small>{skill.description || '飞书场景化工具手册与执行方案'}</small></span>
                      {ready ? <em className="ready">已安装</em> : (
                        <button type="button" className="hub-btn compact" disabled={!!busy || !installed} onClick={() => void run(action)}>
                          {busy === action ? '安装中…' : '安装能力'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          ) : null}
          <section className="hub-drawer-section">
            <h3>依赖</h3>
            {deps.length ? <ul>{deps.map((dep) => <li key={dep}>{dep}</li>)}</ul> : <p>未声明</p>}
          </section>
          <section className="hub-drawer-section">
            <h3>权限</h3>
            <p>以下为能力包声明的权限，本次任务仍需通过授权检查。</p>
            {permissionRows.length ? <dl className="hub-detail-list">{permissionRows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}{row.details?.length ? <details><summary>查看范围</summary><ul>{row.details.map(name => <li key={name}>{name}</li>)}</ul></details> : null}</dd></div>)}</dl> : <p>未声明额外权限</p>}
          </section>
          {item.kind !== 'skill' ? (
            <section className="hub-drawer-section">
              <h3>输入 / 输出</h3>
              <div className="hub-io-grid">
                <div className="hub-io-item">
                  <span>输入</span>
                  <p>{inputs.length ? inputs.join('、') : '未声明'}</p>
                </div>
                <div className="hub-io-item">
                  <span>输出</span>
                  <p>{outputs.length ? outputs.join('、') : '未声明'}</p>
                </div>
              </div>
            </section>
          ) : null}
          <section className="hub-drawer-section">
            <h3>风险与来源</h3>
            <dl className="hub-kv">
              <dt>风险等级</dt><dd>{capabilityRiskLabel(item.risk?.level)}</dd>
              {item.risk?.reasons?.length ? <><dt>风险依据</dt><dd>{item.risk.reasons.join('；')}</dd></> : null}
              <dt>来源证据</dt><dd>{item.provenance?.ref || item.provenance?.source || hubSourceLabel(item.source)}</dd>
            </dl>
          </section>
          {item.kind === 'expert' && (item.sop || item.knowledgeRefs?.length) ? <section className="hub-drawer-section">
            <h3>执行规范</h3>
            {item.sop ? <p className="hub-sop-copy">{item.sop}</p> : null}
            {item.knowledgeRefs?.length ? <dl className="hub-kv"><dt>知识库范围</dt><dd>{listValues(item.knowledgeRefs).join('、')}</dd></dl> : null}
          </section> : null}
          {installed && (isMine || item.kind !== 'expert') ? (
            <section className="hub-drawer-section">
              <div className="hub-toggle-row">
                <div>
                  <strong>新会话默认启用</strong>
                  <p>关闭后仍保留在能力中心，但不会自动用于新会话。</p>
                </div>
                <label className="hub-filter-toggle">
                  <input
                    id="hubEnableToggle"
                    type="checkbox"
                    checked={item.enabled !== false}
                    onChange={(e) => void run(e.target.checked ? 'enable' : 'disable')}
                  />
                  <span className="hub-toggle-track" aria-hidden="true"><span /></span>
                  <span>{item.enabled !== false ? '已启用' : '已停用'}</span>
                </label>
              </div>
            </section>
          ) : null}
        </div>
        <div className="hub-drawer-foot secondary-dialog__foot" id="hubDrawerActions">
          {item.kind === 'expert' ? (
            <>
              {qualificationLimited ? (
                <button type="button" className="hub-btn" disabled>修复能力合同后再打开</button>
              ) : runtimeLimited ? (
                <button type="button" className="hub-btn" disabled>完成依赖安装/授权后再打开</button>
              ) : !installed ? (
                <button type="button" className="hub-btn primary" disabled={!!busy} onClick={() => void run('addMyExpert')}>
                  {busy === 'addMyExpert' ? '正在召唤…' : '召唤专家'}
                </button>
              ) : isMine ? <button type="button" className="hub-btn primary" onClick={() => onOpenWorkbench(item)}>打开我的专家</button>
                : <button type="button" className="hub-btn" disabled>已召唤</button>}
              {isMine && installed && bound ? (
                <button type="button" className="hub-btn" disabled={!!busy} onClick={() => void run('removeExpert')}>
                  {busy === 'removeExpert' ? '正在撤回…' : '从工作台撤回'}
                </button>
              ) : isMine && installed ? (
                <button type="button" className="hub-btn" disabled={!!busy} onClick={() => void run('addExpert')}>
                  {busy === 'addExpert' ? '正在添加…' : '设为常用专家'}
                </button>
              ) : null}
              {isMine && canEdit && !curated ? <button type="button" className="hub-btn" onClick={() => onEditExpert(item, 'tune')}>编辑</button> : null}
              {installed && curated ? (
                <button type="button" className="hub-btn" disabled={!!busy} onClick={() => void run('update')}>
                  {busy === 'update' ? '正在更新…' : '更新专家'}
                </button>
              ) : null}
              {installed && curated ? (
                <button type="button" className="hub-btn danger" disabled={!!busy} onClick={() => void run('uninstall')}>
                  {busy === 'uninstall' ? '正在卸载…' : '卸载专家'}
                </button>
              ) : null}
            </>
          ) : installed && item.kind === 'skill' ? (
            <>
              <button type="button" className="hub-btn primary" onClick={() => onManageSkill(item)}>优化与评估</button>
              {item.source === 'curated' ? (
                <button type="button" className="hub-btn" disabled={!!busy} onClick={() => void run('update')}>
                  {busy === 'update' ? '正在更新…' : '更新技能'}
                </button>
              ) : null}
              <button type="button" className="hub-btn danger" disabled={!!busy} onClick={() => void run('uninstall')}>
                {busy === 'uninstall' ? '正在卸载…' : '卸载技能'}
              </button>
            </>
          ) : installed ? (
            <button type="button" className="hub-btn" onClick={() => void run('uninstall')}>卸载</button>
          ) : (
            <button type="button" className="hub-btn primary" onClick={() => void run('install')}>安装</button>
          )}
        </div>
      </aside>
      {summonPreview ? (
        <>
          <div className="secondary-dialog-mask open" style={{ zIndex: 9300 }} aria-hidden="true" onClick={() => setSummonPreview(null)} />
          <section
            className="secondary-dialog open"
            style={{ width: 'min(480px, calc(100vw - 40px))', zIndex: 9301 }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="hubSummonConfirmTitle"
            data-testid="hub-summon-confirm"
          >
            <div className="secondary-dialog__head">
              <div>
                <span className="hub-section-kicker">安全确认</span>
                <h2 id="hubSummonConfirmTitle">确认召唤“{summonPreview.name || item.name || item.id}”</h2>
              </div>
              <button type="button" className="hub-icon-btn" aria-label="返回专家详情" onClick={() => setSummonPreview(null)}>
                <Icon name="close" />
              </button>
            </div>
            <div className="secondary-dialog__body hub-confirm-body">
              <p>此专家包含高风险能力。确认后，KnowMe 才会安装技能并把专家加入工作台；实际执行外部写入时仍会逐次请求授权。</p>
              <dl className="hub-confirm-facts">
                <dt>风险等级</dt><dd className="hub-confirm-fact-warn">{capabilityRiskLabel(summonRisk.level)}</dd>
                <dt>来源</dt><dd>{hubSourceLabel(item.source)}</dd>
                <dt>回滚方式</dt><dd>{summonPreview.rollbackHint || '可在专家详情中停用或卸载。'}</dd>
              </dl>
              {summonRisk.reasons?.length ? (
                <ul className="hub-confirm-notes" aria-label="风险依据">
                  {summonRisk.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
              ) : null}
              {summonPermissionRows.length ? (
                <section className="hub-drawer-section">
                  <h3>将授予的能力范围</h3>
                  <dl className="hub-detail-list">
                    {summonPermissionRows.map((row) => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}
                  </dl>
                </section>
              ) : null}
              {summonDependencyNotes.length ? (
                <section className="hub-drawer-section">
                  <h3>依赖提示</h3>
                  <ul>{summonDependencyNotes.map((note) => <li key={note}>{note}</li>)}</ul>
                </section>
              ) : null}
            </div>
            <div className="secondary-dialog__foot">
              <button type="button" className="hub-btn" autoFocus disabled={!!busy} onClick={() => setSummonPreview(null)}>暂不召唤</button>
              <button type="button" className="hub-btn primary" disabled={!!busy} onClick={() => void run('confirmAddMyExpert')}>
                {busy === 'confirmAddMyExpert' ? '正在召唤…' : '确认风险并召唤'}
              </button>
            </div>
          </section>
        </>
      ) : null}
    </>
  )

  return createPortal(dialog, document.body)
}

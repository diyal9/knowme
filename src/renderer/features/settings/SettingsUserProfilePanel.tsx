import { useEffect, useRef } from 'react'
import type { SettingsForm } from '../../../shared/api-extended'
import {
  INDUSTRY_ROLE_CATALOG,
  getOccupationDefaults,
  getRoleIndustry,
  normalizeOccupation,
  normalizeRoleIndustry,
} from '../../../shared/personal-role-catalog'

export function SettingsUserProfilePanel({
  form,
  onPatch,
}: {
  form: SettingsForm
  onPatch: (patch: Partial<SettingsForm>) => void
}) {
  const migrationStarted = useRef(false)
  const industry = normalizeRoleIndustry(form.industry)
  const industryDefinition = getRoleIndustry(industry)
  const occupationId = normalizeOccupation(industry, form.occupationId)
  const defaults = getOccupationDefaults(industry, occupationId)
  const mode = form.userProfileConfigMode === 'custom' ? 'custom' : 'default'
  const profileText = String(form.userProfile || (mode === 'default' ? defaults.aboutMe : ''))

  useEffect(() => {
    if (form.occupationId || migrationStarted.current) return
    migrationStarted.current = true
    void window.api?.personalAgentGet?.().then((result) => {
      const legacyPreferences = result?.profile?.taskPreferences || {}
      const nextIndustry = normalizeRoleIndustry(legacyPreferences.industry || form.industry)
      const nextOccupation = normalizeOccupation(nextIndustry, legacyPreferences.occupationId)
      const nextDefaults = getOccupationDefaults(nextIndustry, nextOccupation)
      onPatch({
        industry: nextIndustry,
        occupationId: nextOccupation,
        userProfile: form.userProfile || nextDefaults.aboutMe,
        userProfileConfigId: nextDefaults.id,
        userProfileConfigVersion: nextDefaults.version,
        userProfileConfigSource: nextDefaults.source,
        userProfileConfigMode: form.userProfile ? 'custom' : 'default',
      })
    }).catch(() => undefined)
  }, [form.industry, form.occupationId, form.userProfile, onPatch])

  const applyOccupation = (nextIndustryRaw: string, nextOccupationRaw: string) => {
    const nextIndustry = normalizeRoleIndustry(nextIndustryRaw)
    const nextOccupation = normalizeOccupation(nextIndustry, nextOccupationRaw)
    const nextDefaults = getOccupationDefaults(nextIndustry, nextOccupation)
    onPatch({
      industry: nextIndustry,
      occupationId: nextOccupation,
      userProfile: nextDefaults.aboutMe,
      userProfileConfigId: nextDefaults.id,
      userProfileConfigVersion: nextDefaults.version,
      userProfileConfigSource: nextDefaults.source,
      userProfileConfigMode: 'default',
    })
  }

  return (
    <div className="settings-user-profile">
      <section className="settings-section settings-profile-hero">
        <div className="settings-section-head">
          <div>
            <div className="settings-section-title">个人档案</div>
            <h2>工作背景</h2>
            <p>设置你的工作领域和岗位。</p>
          </div>
          <span className="settings-badge">仅存本机</span>
        </div>
        <div className="settings-profile-grid">
          <div className="settings-field">
            <label htmlFor="user-industry">工作领域</label>
            <select
              id="user-industry"
              aria-label="工作领域"
              value={industry}
              onChange={(event) => {
                const next = getRoleIndustry(event.target.value)
                applyOccupation(next.id, next.defaultOccupationId)
              }}
            >
              {INDUSTRY_ROLE_CATALOG.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>
          <div className="settings-field">
            <label htmlFor="user-occupation">岗位</label>
            <select
              id="user-occupation"
              aria-label="岗位"
              value={occupationId}
              onChange={(event) => applyOccupation(industry, event.target.value)}
            >
              {industryDefinition.occupations.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-head settings-profile-copy-head">
          <div>
            <div className="settings-section-title">基本情况</div>
            <h2>{defaults.industryLabel} · {defaults.occupationLabel}</h2>
          </div>
          <span className={`settings-profile-state${mode === 'custom' ? ' custom' : ''}`}>
            {mode === 'custom' ? '已补充实际情况' : '岗位默认内容'}
          </span>
        </div>
        <div className="settings-field settings-profile-bio">
          <label htmlFor="user-profile">关于我</label>
          <textarea
            id="user-profile"
            aria-label="关于我"
            value={profileText}
            onChange={(event) => onPatch({
              industry,
              occupationId,
              userProfile: event.target.value,
              userProfileConfigId: defaults.id,
              userProfileConfigVersion: defaults.version,
              userProfileConfigSource: defaults.source,
              userProfileConfigMode: 'custom',
            })}
            placeholder="补充你的职责范围、业务背景和长期目标"
          />
          <div className="settings-profile-bio-foot">
            <span>岗位提供初始内容，你可以按实际职责补充。</span>
            {mode === 'custom' ? (
              <button type="button" className="settings-text-btn" onClick={() => applyOccupation(industry, occupationId)}>
                恢复岗位默认
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  )
}

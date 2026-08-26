import type { PersonalGrowthSnapshot } from '../../../domain/personal-growth'
import { Icon } from '../../app/Icon'

const DIMENSION_ICONS = {
  context: 'classify',
  preference: 'optimize',
  knowledge: 'bookOpen',
  collaboration: 'chat',
} as const

export function PersonalGrowthTab({
  snapshot,
  onAction,
}: {
  snapshot: PersonalGrowthSnapshot
  onAction: (action: 'assistant' | 'workbench' | 'knowledge' | 'skill' | 'connector') => void
}) {
  return (
    <div className="personal-growth-tab" data-testid="personal-growth-tab">
      <section className="personal-section personal-growth-summary">
        <div className="personal-section-head">
          <div>
            <span>懂你成长</span>
            <h2>KnowMe 正在懂你什么</h2>
            <p>已确认的协作证据，会沉淀为四项理解。</p>
          </div>
          <div className="personal-growth-level">
            <span>伙伴等级</span>
            <strong>Lv.{snapshot.level}</strong>
            <small>{snapshot.stage}</small>
          </div>
        </div>

        <div className="personal-growth-total" aria-label={`伙伴成长进度 ${snapshot.progress}%`}>
          <span style={{ width: `${snapshot.progress}%` }} />
        </div>

        <div className="personal-growth-dimension-grid">
          {snapshot.dimensions.map((item) => (
            <article key={item.id}>
              <span className="personal-growth-dimension-icon"><Icon name={DIMENSION_ICONS[item.id]} /></span>
              <div className="personal-growth-dimension-title"><strong>{item.label}</strong><em>Lv.{item.level}</em></div>
              <p>{item.summary}</p>
              <div className="personal-growth-dimension-track"><span style={{ width: `${item.progress}%` }} /></div>
              <div className="personal-growth-evidence">{item.evidence.slice(0, 2).map((evidence) => <span key={evidence}>{evidence}</span>)}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="personal-section personal-growth-quests">
        <div className="personal-section-head compact">
          <div>
            <span>今日培养</span>
            <h2>下一步，可以这样培养</h2>
            <p>{snapshot.yesterdayCompleted ? `昨天完成 ${snapshot.yesterdayCompleted} 个任务，从下面选一项继续。` : '从一项可验证的行动开始。'}</p>
          </div>
        </div>
        <div className="personal-growth-quest-list">
          {snapshot.recommendations.map((item) => (
            <article key={item.id}>
              <div><strong>{item.title}</strong><p>{item.description}</p></div>
              <button type="button" onClick={() => onAction(item.action)}>{item.actionLabel}<Icon name="chevronRight" /></button>
            </article>
          ))}
        </div>
      </section>

      <section className="personal-section personal-growth-equipment">
        <div className="personal-section-head compact">
          <div>
            <span>能力装备</span>
            <h2>能力与成长分开计算</h2>
            <p>只看实际使用，不计入伙伴等级。</p>
          </div>
        </div>
        <div className="personal-growth-equipment-grid">
          <article>
            <span className="personal-growth-equipment-icon"><Icon name="component" /></span>
            <div><small>Skill</small><strong>{snapshot.equipment.skills.stage}</strong></div>
            <p>{snapshot.equipment.skills.summary}</p>
            <dl><div><dt>可用</dt><dd>{snapshot.equipment.skills.installed}</dd></div><div><dt>已绑定</dt><dd>{snapshot.equipment.skills.bound}</dd></div></dl>
            <button type="button" onClick={() => onAction('skill')}>管理 Skill <Icon name="chevronRight" /></button>
          </article>
          <article>
            <span className="personal-growth-equipment-icon"><Icon name="wrench" /></span>
            <div><small>连接器</small><strong>{snapshot.equipment.connectors.stage}</strong></div>
            <p>{snapshot.equipment.connectors.summary}</p>
            <dl>
              <div><dt>可用</dt><dd>{snapshot.equipment.connectors.installed}</dd></div>
              <div><dt>调用可靠度</dt><dd>{snapshot.equipment.connectors.reliability == null ? '待形成' : `${snapshot.equipment.connectors.reliability}%`}</dd></div>
            </dl>
            <button type="button" onClick={() => onAction('connector')}>管理连接器 <Icon name="chevronRight" /></button>
          </article>
        </div>
      </section>

      <section className="personal-growth-memory-boundary" aria-label="成长与记忆的关系">
        <Icon name="badgeCheck" />
        <div>
          <strong>成长只读取已确认记忆</strong>
          <p>新增、确认和撤销仍在“记忆与变更”中完成。</p>
        </div>
        <button type="button" onClick={() => onAction('assistant')}>前往记忆与变更</button>
      </section>
    </div>
  )
}

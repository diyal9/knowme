import { useState } from 'react'
import { useAppStore } from '../../app/store'

export function KnowledgeEmptyWelcome() {
  const addMaterial = useAppStore((s) => s.addKnowledgeMaterial)
  const setPage = useAppStore((s) => s.setKnowledgePage)
  const organize = useAppStore((s) => s.organizeKnowledge)
  const [body, setBody] = useState('')
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <div className="knowledge-workspace knowledge-empty-workspace">
        <main className="knowledge-page-main">
          <section className="knowledge-firsttouch">
            <div className="knowledge-firsttouch-done">
              <span className="knowledge-firsttouch-check" aria-hidden="true" />
              <h2>已保存到你的知识</h2>
              <p>要我把它整理成知识吗？整理成什么样，都由你确认。</p>
              <div className="knowledge-firsttouch-actions">
                <button type="button" className="knowledge-btn primary" onClick={() => void organize()}>整理</button>
                <button type="button" className="knowledge-btn" onClick={() => setDone(false)}>以后再说</button>
              </div>
            </div>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="knowledge-workspace knowledge-empty-workspace">
      <main className="knowledge-page-main">
        <section className="knowledge-firsttouch" id="knowledgeFirstTouch">
          <div className="knowledge-firsttouch-brand">
            <span className="knowledge-firsttouch-logo" aria-hidden="true" />
            <h1>你的知识网</h1>
          </div>
          <p className="knowledge-firsttouch-lede">把资料放进来，AI 帮你理成能查的知识，怎么整理，你说了算。</p>
          <ol className="knowledge-firsttouch-steps" aria-label="使用方式">
            <li><span className="knowledge-firsttouch-step-ico" aria-hidden="true" /><strong>放进来</strong></li>
            <li aria-hidden="true" className="knowledge-firsttouch-arrow">→</li>
            <li><span className="knowledge-firsttouch-step-ico" aria-hidden="true" /><strong>AI 整理</strong></li>
            <li aria-hidden="true" className="knowledge-firsttouch-arrow">→</li>
            <li><span className="knowledge-firsttouch-step-ico" aria-hidden="true" /><strong>随时查</strong></li>
          </ol>
          <div className="knowledge-firsttouch-input">
            <textarea
              rows={4}
              placeholder="粘贴一段文字，或写点笔记…"
              aria-label="第一份资料内容"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <div className="knowledge-firsttouch-actions">
            <button
              type="button"
              className="knowledge-btn primary"
              onClick={async () => {
                const ok = await addMaterial(body)
                if (ok) setDone(true)
              }}
            >
              + 添加第一份资料
            </button>
          </div>
          <button type="button" className="knowledge-firsttouch-connect" onClick={() => setPage('connect')}>
            已有飞书 / 文件夹？ 连接来源
          </button>
        </section>
      </main>
    </div>
  )
}

import { useEffect, useState } from 'react'
import type { MemoryRecord } from '../../../shared/api-extended'
import '../settings/settings.css'

function relTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  return `${days} 天前`
}

export function MemorySurface() {
  const [items, setItems] = useState<MemoryRecord[]>([])

  useEffect(() => {
    window.api?.initMemory?.((list) => setItems(Array.isArray(list) ? list : []))
  }, [])

  return (
    <div className="memory-root" data-testid="memory-surface">
      <header className="memory-header">
        <span className="memory-brand">KnowMe / 近期记忆</span>
        <button type="button" className="memory-close" onClick={() => window.close()} title="关闭">
          ✕
        </button>
      </header>
      <div className="memory-list-wrap">
        {!items.length ? (
          <p className="memory-empty">暂无使用记录<br />打开、复制或 AI 生成后会出现在这里</p>
        ) : (
          [...items].reverse().map((row, index) => (
            <article
              key={`${row.ts || index}-${row.summary || ''}`}
              className="memory-row"
              data-testid="memory-row"
              onClick={() => undefined}
            >
              <div className="memory-kind">{row.kind || 'habit'}</div>
              <div className="memory-summary">{row.summary || ''}</div>
              <div className="memory-time">{relTime(row.ts)}</div>
            </article>
          ))
        )}
      </div>
      <footer className="memory-footer">仅保存在本机，不写入云端</footer>
      <style>{`
        .memory-root { display:flex; flex-direction:column; height:100vh; background:#f3f1ec; font:13px 'Segoe UI',system-ui,sans-serif; }
        .memory-header { height:52px; display:flex; align-items:center; padding:0 14px; background:rgba(255,255,255,.94); border-bottom:1px solid rgba(0,0,0,.07); }
        .memory-brand { flex:1; font:600 11px inherit; color:#6b6560; letter-spacing:.04em; text-transform:uppercase; }
        .memory-close { width:22px; height:22px; border:none; border-radius:6px; background:transparent; color:#b0a89e; cursor:pointer; }
        .memory-list-wrap { flex:1; overflow:auto; padding:10px 12px 12px; }
        .memory-row { padding:11px 12px; border:1px solid rgba(0,0,0,.05); border-radius:12px; background:rgba(255,255,255,.88); margin-bottom:8px; }
        .memory-kind { font:600 9px inherit; color:#3d3a36; text-transform:uppercase; letter-spacing:.4px; margin-bottom:4px; }
        .memory-summary { font:12px/1.5 inherit; color:#1c1917; }
        .memory-time { font:10px inherit; color:#b0a89e; margin-top:5px; }
        .memory-empty { padding:40px 20px; text-align:center; font:italic 12px/1.7 inherit; color:#b0a89e; }
        .memory-footer { border-top:1px solid rgba(0,0,0,.07); padding:10px 14px; background:rgba(255,255,255,.94); font:10px/1.5 inherit; color:#b0a89e; }
      `}</style>
    </div>
  )
}

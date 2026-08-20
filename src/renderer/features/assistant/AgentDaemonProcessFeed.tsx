import { useMemo, useState } from 'react'
import type { DaemonProcessTranscript, DaemonProgressCard } from '../../../domain/agent-daemon-process'

type Props = {
  status: string
  transcript: DaemonProcessTranscript | null
  compact?: DaemonProgressCard | null
  isGenerating: boolean
  onBackWorkbench: () => void
}

export function AgentDaemonProcessFeed({
  status,
  transcript,
  compact,
  isGenerating,
  onBackWorkbench,
}: Props) {
  const [progressCollapsed, setProgressCollapsed] = useState(false)
  const [logsCollapsed, setLogsCollapsed] = useState(false)
  const progressText = transcript?.progress?.text || ''
  const logLines = useMemo(() => transcript?.logs?.lines?.filter(Boolean).slice(-40) || [], [transcript?.logs?.lines])

  if (compact) {
    const ratio = Math.max(0, Math.min(100, Number(compact.ratio) || 0))
    const barWidth = Math.max(ratio, ratio > 0 || compact.done ? ratio : 4)
    const showTip = compact.tip && compact.statusLabel !== '已完成' && compact.statusLabel !== '失败'
    return (
      <div className="agent-daemon-process agent-stream-bar" data-testid="agent-stream-bar">
        <article className="agent-daemon-progress-card agent-stream-in" aria-label={compact.title || '管线进度'}>
          <div className="agent-daemon-progress-head">
            <strong>{compact.currentLabel || '管线任务'}</strong>
            <span className="agent-daemon-progress-status">{compact.statusLabel || ''}</span>
          </div>
          <div className="agent-daemon-progress-meta">{compact.progressLine || status}</div>
          <div className="agent-daemon-progress-bar" role="progressbar" aria-label="管线完成进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={ratio}>
            <span style={{ width: `${barWidth}%` }} />
          </div>
          {showTip ? <p className="agent-daemon-progress-tip">{compact.tip}</p> : null}
          {isGenerating ? (
            <div className="agent-daemon-progress-actions">
              <button type="button" className="agent-stream-back agent-daemon-progress-link" onClick={onBackWorkbench}>
                返回工作台
              </button>
            </div>
          ) : null}
        </article>
      </div>
    )
  }

  if (!status && !transcript && !isGenerating) return null

  return (
    <div className="agent-daemon-process agent-stream-bar" data-testid="agent-stream-bar">
      <article className="agent-daemon-process-card agent-msg" aria-label="管线进度摘要">
        {transcript?.tip || status ? (
          <div className="agent-daemon-process-tip">{transcript?.tip || status}</div>
        ) : null}
        <section className={`agent-daemon-process-block agent-stream-in${progressCollapsed ? ' is-collapsed' : ''}`} data-daemon-process="progress">
          <header className="agent-daemon-process-head">
            <strong>{transcript?.progress?.title || '过程'}</strong>
            <button
              type="button"
              className="agent-daemon-process-toggle"
              data-daemon-process-toggle="progress"
              aria-expanded={!progressCollapsed}
              aria-controls="agentDaemonProcessProgress"
              onClick={() => setProgressCollapsed((value) => !value)}
            >
              {progressCollapsed ? '展开摘要' : '收起摘要'}
            </button>
          </header>
          <div className="agent-daemon-process-body" id="agentDaemonProcessProgress">
            {transcript?.progress?.empty !== false && !progressText ? (
              <div className="agent-daemon-process-empty">{transcript?.progress?.emptyLabel || '暂无过程摘要…'}</div>
            ) : (
              <pre className="agent-daemon-process-pre">{progressText}</pre>
            )}
          </div>
        </section>
        <section className={`agent-daemon-process-block${logsCollapsed ? ' is-collapsed' : ''}`} data-daemon-process="logs" id="agentDaemonProcessLogs">
          <header className="agent-daemon-process-head">
            <strong>{transcript?.logs?.title || '运行日志'}</strong>
            <button
              type="button"
              className="agent-daemon-process-toggle"
              data-daemon-process-toggle="logs"
              aria-expanded={!logsCollapsed}
              aria-controls="agentDaemonProcessLogBody"
              onClick={() => setLogsCollapsed((value) => !value)}
            >
              {logsCollapsed ? '展开' : '收起'}
            </button>
          </header>
          <div className="agent-daemon-process-body" id="agentDaemonProcessLogBody">
            {logLines.length === 0 ? (
              <div className="agent-daemon-process-empty">{transcript?.logs?.emptyLabel || '等待 daemon 过程输出…'}</div>
            ) : (
              <div className="agent-daemon-process-log-lines" data-testid="agent-process-feed">
                {logLines.map((line, index) => (
                  <div key={`${index}-${line}`} className="agent-daemon-process-log-line">{line}</div>
                ))}
              </div>
            )}
          </div>
        </section>
        {isGenerating ? (
          <button type="button" className="agent-stream-back" onClick={onBackWorkbench}>
            返回工作台
          </button>
        ) : null}
      </article>
    </div>
  )
}

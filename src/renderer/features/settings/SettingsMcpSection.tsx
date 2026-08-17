import { useEffect, useState } from 'react'
import type { ConnectorRecord } from '../../../shared/api-extended'
import { parseAllowlist } from './settings-connector-status'

type Props = {
  mcp?: ConnectorRecord
  flash: (msg: string, kind?: 'ok' | 'err') => void
  onRefresh: () => Promise<boolean>
}

export function SettingsMcpSection({ mcp, flash, onRefresh }: Props) {
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState('')
  const [allowlist, setAllowlist] = useState('')

  useEffect(() => {
    setCommand(mcp?.mcp?.command || '')
    setArgs((mcp?.mcp?.args || []).join(' '))
    setAllowlist((mcp?.allowlist || []).join(', '))
  }, [mcp])

  return (
    <div className="settings-section">
      <div className="settings-section-head">
        <div className="settings-section-title">公司 MCP</div>
      </div>
      <div className="settings-field">
        <label htmlFor="mcpCommand">启动命令</label>
        <input id="mcpCommand" value={command} onChange={(e) => setCommand(e.target.value)} placeholder="例如 npx 或绝对路径" />
      </div>
      <div className="settings-field">
        <label htmlFor="mcpArgs">参数（空格分隔）</label>
        <input id="mcpArgs" value={args} onChange={(e) => setArgs(e.target.value)} placeholder="-y @scope/mcp-server" />
      </div>
      <div className="settings-field">
        <label htmlFor="mcpAllowlist">Agent 工具白名单（逗号分隔）</label>
        <input id="mcpAllowlist" value={allowlist} onChange={(e) => setAllowlist(e.target.value)} placeholder="tool_a, tool_b" />
        <div className="settings-hint">留空表示不向 Agent 投影任何 MCP 工具。</div>
      </div>
      <div className="settings-actions">
        <button
          type="button"
          className="settings-btn primary"
          onClick={async () => {
            const result = await window.api?.connectorsUpsert?.({
              id: 'mcp-default',
              type: 'mcp',
              title: '公司 MCP',
              enabled: true,
              mcp: { command: command.trim(), args: args.trim().split(/\s+/).filter(Boolean), envKeys: [] },
              allowlist: parseAllowlist(allowlist),
            })
            if (result && result.ok === false) flash(result.error || '保存失败', 'err')
            else flash('MCP 配置已保存')
            void onRefresh()
          }}
        >
          保存 MCP 配置
        </button>
      </div>
    </div>
  )
}

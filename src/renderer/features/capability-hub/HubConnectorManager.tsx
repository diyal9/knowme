import { useEffect, useMemo, useState } from 'react'
import type { ConnectorRecord } from '../../../shared/api-extended'

type ToolItem = { rawName: string; projectedName?: string; description?: string; selected?: boolean }
type ReferenceItem = { id: string; kind?: string; name?: string; required?: boolean }

function parseEnv(text: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const index = line.indexOf('=')
    if (index <= 0) continue
    const key = line.slice(0, index).trim()
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) result[key] = line.slice(index + 1).trim()
  }
  return result
}

export function HubConnectorManager({ connectorId, onChanged }: { connectorId: string; onChanged: () => void | Promise<void> }) {
  const [connector, setConnector] = useState<ConnectorRecord | null>(null)
  const [transport, setTransport] = useState('stdio')
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState('')
  const [cwd, setCwd] = useState('')
  const [url, setUrl] = useState('')
  const [env, setEnv] = useState('')
  const [type, setType] = useState('mcp')
  const [method, setMethod] = useState('GET')
  const [headers, setHeaders] = useState('')
  const [body, setBody] = useState('')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('22')
  const [username, setUsername] = useState('')
  const [secrets, setSecrets] = useState<Record<string, string>>({})
  const [tools, setTools] = useState<ToolItem[]>([])
  const [references, setReferences] = useState<ReferenceItem[]>([])
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState('')

  async function load() {
    const list = await window.api?.connectorsList?.()
    const item = (list?.connectors || list?.items || []).find((entry) => entry.id === connectorId) || null
    setConnector(item)
    if (item) {
      setType(item.type || 'mcp')
      setTransport(item.mcp?.transport || (item.mcp?.url ? 'streamable-http' : 'stdio'))
      setCommand(item.mcp?.command || '')
      setArgs((item.mcp?.args || []).join('\n'))
      setCwd(item.mcp?.cwd || '')
      setUrl(item.mcp?.url || '')
      setEnv(Object.entries(item.mcp?.env || {}).map(([key, value]) => `${key}=${value}`).join('\n'))
      setMethod(item.http?.method || 'GET')
      setHeaders(Object.entries(item.http?.headers || {}).map(([key, value]) => `${key}=${value}`).join('\n'))
      setBody(item.http?.body || '')
      setHost(item.ssh?.host || '')
      setPort(String(item.ssh?.port || 22))
      setUsername(item.ssh?.username || '')
    }
    const refs = await window.api?.connectorsReferences?.(connectorId)
    setReferences(refs?.references || [])
  }

  useEffect(() => { void load() }, [connectorId])

  const selected = useMemo(() => new Set(tools.filter((tool) => tool.selected).map((tool) => tool.rawName)), [tools])

  async function save() {
    setBusy('save')
    try {
      const common = {
        id: connectorId,
        type,
        title: connector?.title || connector?.name || connectorId,
        enabled: connector?.enabled !== false,
        mcp: {
          transport,
          command: command.trim(),
          args: args.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
          cwd: cwd.trim(),
          url: url.trim(),
          env: parseEnv(env),
          envKeys: [],
        },
        cli: { command: command.trim(), args: args.split(/\r?\n/).map((value) => value.trim()).filter(Boolean), cwd: cwd.trim(), env: parseEnv(env) },
        http: { baseUrl: url.trim(), method, headers: parseEnv(headers), query: {}, body },
        ssh: { host: host.trim(), port: Number(port) || 22, username: username.trim(), cwd: cwd.trim(), command: command.trim() },
      }
      const result = await window.api?.connectorsUpsert?.(common)
      if (result?.ok === false) throw new Error(result.error || '连接器配置保存失败')
      const secretPatch = Object.fromEntries(Object.entries(secrets).filter(([, value]) => value !== ''))
      if (Object.keys(secretPatch).length) {
        const secretResult = await window.api?.connectorsSetSecrets?.(connectorId, secretPatch)
        if (secretResult?.ok === false) throw new Error(secretResult.message || secretResult.error || '密钥保存失败')
      }
      setSecrets({})
      setStatus('配置已保存；密钥已进入系统安全存储')
      await load()
      await onChanged()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '保存失败')
    } finally { setBusy('') }
  }

  async function testConnection() {
    setBusy('test')
    try {
      const result = await window.api?.connectorsStatus?.(connectorId)
      const state = result?.connector?.status || result
      setStatus(state?.message || (state?.ok ? '连接器在线' : '连接失败'))
    } finally { setBusy('') }
  }

  async function discoverTools() {
    setBusy('tools')
    try {
      const result = await window.api?.connectorsTools?.(connectorId)
      if (result?.ok === false) {
        setStatus(result.message || result.error || '工具发现失败')
        setTools([])
      } else {
        setTools(result?.availableTools || [])
        setStatus(`已发现 ${result?.availableTools?.length || 0} 个工具`)
      }
    } finally { setBusy('') }
  }

  async function saveAllowlist() {
    setBusy('allowlist')
    try {
      const result = await window.api?.connectorsSetAllowlist?.(connectorId, [...selected])
      if (result?.ok === false) throw new Error(result.error || '工具授权保存失败')
      setStatus('Agent 工具允许列表已保存')
      await load()
      await onChanged()
    } catch (error) { setStatus(error instanceof Error ? error.message : '保存失败') }
    finally { setBusy('') }
  }

  if (!connector) return <p>正在加载连接器实例…</p>

  return (
    <div className="hub-connector-manager" data-testid="hub-connector-manager">
      <div className="hub-field">
        <label htmlFor="connectorTransport">传输方式</label>
        <select id="connectorTransport" value={transport} onChange={(event) => setTransport(event.target.value)}>
          <option value="stdio">本机 stdio</option>
          <option value="streamable-http">Streamable HTTP</option>
          <option value="sse">Legacy SSE</option>
        </select>
      </div>
      {type === 'mcp' && transport === 'stdio' ? <>
        <div className="hub-field"><label htmlFor="connectorCommand">启动命令</label><input id="connectorCommand" value={command} onChange={(event) => setCommand(event.target.value)} placeholder="node / npx / 可执行文件绝对路径" /></div>
        <div className="hub-field"><label htmlFor="connectorArgs">参数（每行一个）</label><textarea id="connectorArgs" value={args} onChange={(event) => setArgs(event.target.value)} rows={3} /></div>
        <div className="hub-field"><label htmlFor="connectorCwd">工作目录</label><input id="connectorCwd" value={cwd} onChange={(event) => setCwd(event.target.value)} /></div>
        <div className="hub-field"><label htmlFor="connectorEnv">非敏感环境变量（KEY=value）</label><textarea id="connectorEnv" value={env} onChange={(event) => setEnv(event.target.value)} rows={3} /></div>
      </> : type === 'mcp' ? <div className="hub-field"><label htmlFor="connectorUrl">服务 URL</label><input id="connectorUrl" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="http://127.0.0.1:3103/sse" /></div>
        : type === 'cli' ? <><div className="hub-field"><label htmlFor="connectorCommand">命令</label><input id="connectorCommand" value={command} onChange={(event) => setCommand(event.target.value)} placeholder="例如 git、node 或自定义脚本" /></div><div className="hub-field"><label htmlFor="connectorArgs">参数（每行一个）</label><textarea id="connectorArgs" value={args} onChange={(event) => setArgs(event.target.value)} rows={3} /></div><div className="hub-field"><label htmlFor="connectorCwd">工作目录</label><input id="connectorCwd" value={cwd} onChange={(event) => setCwd(event.target.value)} /></div></>
        : type === 'http' ? <><div className="hub-field"><label htmlFor="connectorUrl">默认 URL</label><input id="connectorUrl" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://api.example.com/v1/items" /></div><div className="hub-field"><label htmlFor="connectorMethod">请求方法</label><select id="connectorMethod" value={method} onChange={(event) => setMethod(event.target.value)}>{['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((value) => <option key={value}>{value}</option>)}</select></div><div className="hub-field"><label htmlFor="connectorHeaders">请求头（KEY=value）</label><textarea id="connectorHeaders" value={headers} onChange={(event) => setHeaders(event.target.value)} rows={3} /></div><div className="hub-field"><label htmlFor="connectorBody">默认请求体（JSON）</label><textarea id="connectorBody" value={body} onChange={(event) => setBody(event.target.value)} rows={4} /></div></>
        : <><div className="hub-field"><label htmlFor="connectorHost">主机地址</label><input id="connectorHost" value={host} onChange={(event) => setHost(event.target.value)} placeholder="server.example.com" /></div><div className="hub-field"><label htmlFor="connectorPort">端口</label><input id="connectorPort" type="number" value={port} onChange={(event) => setPort(event.target.value)} /></div><div className="hub-field"><label htmlFor="connectorUsername">用户名</label><input id="connectorUsername" value={username} onChange={(event) => setUsername(event.target.value)} /></div><div className="hub-field"><label htmlFor="connectorCommand">默认命令</label><input id="connectorCommand" value={command} onChange={(event) => setCommand(event.target.value)} placeholder="可选" /></div></>}
      {(connector.secretSlots || []).map((slot) => (
        <div className="hub-field" key={slot.key}>
          <label htmlFor={`connectorSecret-${slot.key}`}>{slot.label || slot.key}{slot.required ? '（必填）' : ''}</label>
          <input id={`connectorSecret-${slot.key}`} type="password" value={secrets[slot.key] || ''} onChange={(event) => setSecrets((current) => ({ ...current, [slot.key]: event.target.value }))} placeholder={slot.configured ? '已安全保存；留空保持不变' : '尚未配置'} autoComplete="new-password" />
        </div>
      ))}
      <div className="hub-connector-actions">
        <button type="button" className="hub-btn primary" disabled={!!busy} onClick={() => void save()}>{busy === 'save' ? '保存中…' : '保存配置'}</button>
        <button type="button" className="hub-btn" disabled={!!busy} onClick={() => void testConnection()}>{busy === 'test' ? '测试中…' : '测试连接'}</button>
        <button type="button" className="hub-btn" disabled={!!busy} onClick={() => void discoverTools()}>{busy === 'tools' ? '发现中…' : '发现工具'}</button>
      </div>
      {status ? <p className="hub-connector-status" role="status">{status}</p> : null}
      {tools.length ? <div className="hub-connector-tools">
        <h4>Agent 工具授权</h4>
        {tools.map((tool) => <label key={tool.rawName}>
          <input type="checkbox" checked={tool.selected === true} onChange={(event) => setTools((current) => current.map((item) => item.rawName === tool.rawName ? { ...item, selected: event.target.checked } : item))} />
          <span><strong>{tool.rawName}</strong><small>{tool.description || tool.projectedName}</small></span>
        </label>)}
        <button type="button" className="hub-btn" disabled={!!busy} onClick={() => void saveAllowlist()}>保存工具授权</button>
      </div> : null}
      <div className="hub-connector-references">
        <h4>被哪些能力使用</h4>
        {references.length ? <ul>{references.map((ref) => <li key={`${ref.kind}:${ref.id}`}>{ref.name || ref.id} · {ref.kind}{ref.required ? ' · 必需' : ' · 可选'}</li>)}</ul> : <p>暂未发现 Agent / Skill 引用</p>}
      </div>
    </div>
  )
}

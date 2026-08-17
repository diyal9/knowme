export type FeishuIntentKind = '' | 'docs' | 'im' | 'calendar' | 'task' | 'agent' | 'unknown'

export type FeishuIntent = {
  mentions: boolean
  kind: FeishuIntentKind
}

export type FeishuConnectorSnapshot = {
  enabled?: boolean
  status?: {
    state?: string
    userReady?: boolean
    botReady?: boolean
  }
}

export function classifyFeishuIntent(text: string): FeishuIntent {
  const src = String(text || '')
  const mentions = /(飞书|feishu|lark)/i.test(src)
  if (!mentions) return { mentions: false, kind: '' }
  if (/(文档|知识库|wiki|doc|docs|多维表格|bitable|base)/i.test(src)) return { mentions: true, kind: 'docs' }
  if (/(消息|聊天|会话|群|im|发消息|回复)/i.test(src)) return { mentions: true, kind: 'im' }
  if (/(日历|会议|日程|calendar)/i.test(src)) return { mentions: true, kind: 'calendar' }
  if (/(任务|待办|task)/i.test(src)) return { mentions: true, kind: 'task' }
  if (/(专家|智能体|bot|助手|agent)/i.test(src)) return { mentions: true, kind: 'agent' }
  return { mentions: true, kind: 'unknown' }
}

export function deriveFeishuUsageHint(connector: FeishuConnectorSnapshot | null | undefined): string {
  const enabled = Boolean(connector?.enabled)
  const status = connector?.status || {}
  if (!enabled) return '未启用（设置 → 连接器）'
  if (status.state === 'auth_required') return '需授权 user 身份'
  if (status.userReady) return '可查询文档/知识库'
  if (status.botReady && !status.userReady) return '仅 bot 在线（文档检索需 user）'
  if (status.state === 'timeout') return '状态检查超时'
  return '连接中或不可用'
}

export function buildFeishuClarificationPrompt(
  userPrompt: string,
  connector: FeishuConnectorSnapshot | null | undefined,
): string | null {
  const intent = classifyFeishuIntent(userPrompt)
  if (!intent.mentions) return null
  const status = connector?.status || {}
  const needsUserAuth = !connector?.enabled || status.state === 'auth_required' || !status.userReady
  const needsFunctionClarify = intent.kind === 'unknown'
  if (!needsUserAuth && !needsFunctionClarify) return null
  const directives = ['你是 KnowMe。先进行澄清，不要直接执行工具。']
  if (needsFunctionClarify) {
    directives.push('当前仅支持飞书文档/知识库只读能力；请询问用户要搜索关键词、浏览知识库空间，还是读取指定文档。')
  }
  if (needsUserAuth) {
    directives.push(`明确当前飞书状态：${deriveFeishuUsageHint(connector)}。给出最短下一步：到“设置 → 连接器”启用飞书并完成 user 授权。`)
  }
  directives.push('语气简短，给用户可选项并等待用户回复。')
  directives.push(`用户原始输入：${String(userPrompt || '').trim()}`)
  return directives.join('\n')
}

export function connectorFromStatusPayload(raw: unknown): FeishuConnectorSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const rec = raw as Record<string, unknown>
  if (rec.connector && typeof rec.connector === 'object') {
    return rec.connector as FeishuConnectorSnapshot
  }
  if ('enabled' in rec || rec.status) return rec as FeishuConnectorSnapshot
  if (rec.connected === true) return { enabled: true, status: { userReady: true } }
  return { enabled: false }
}

export async function maybeAugmentFeishuPrompt(
  userPrompt: string,
  readConnector?: () => Promise<FeishuConnectorSnapshot | null | undefined>,
): Promise<string> {
  const intent = classifyFeishuIntent(userPrompt)
  if (!intent.mentions) return userPrompt
  let connector: FeishuConnectorSnapshot | null = null
  if (readConnector) {
    try {
      connector = await readConnector() || null
    } catch {
      connector = null
    }
  }
  return buildFeishuClarificationPrompt(userPrompt, connector) || userPrompt
}

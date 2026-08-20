import { buildFeishuCard, type FeishuCardModel } from './feishu-card-model'

export type InlineNode =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; text: string }
  | { kind: 'em'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; href: string; label: string }
  | { kind: 'feishu'; card: FeishuCardModel }

const MD_LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g
const BARE_URL_RE = /(^|[\s>])((?:https?:\/\/|www\.)[^\s<)]+)/g
const URL_ONLY_RE = /^(?:https?:\/\/|www\.)[^\s<)]+$/i

function pushText(out: InlineNode[], text: string) {
  if (text) out.push({ kind: 'text', text })
}

function parseEmphasis(src: string): InlineNode[] {
  const out: InlineNode[] = []
  let i = 0
  while (i < src.length) {
    if (src[i] === '`') {
      const end = src.indexOf('`', i + 1)
      if (end > i) {
        const codeText = src.slice(i + 1, end)
        // 模型常把 URL 包在反引号中；链接仍应可点击，普通代码继续保持代码样式。
        out.push(URL_ONLY_RE.test(codeText) ? linkNode(codeText, codeText) : { kind: 'code', text: codeText })
        i = end + 1
        continue
      }
    }
    if (src.startsWith('**', i)) {
      const end = src.indexOf('**', i + 2)
      if (end > i) {
        out.push({ kind: 'strong', text: src.slice(i + 2, end) })
        i = end + 2
        continue
      }
    }
    if (src[i] === '*' && src[i + 1] !== '*') {
      const end = src.indexOf('*', i + 1)
      if (end > i && src[end + 1] !== '*') {
        out.push({ kind: 'em', text: src.slice(i + 1, end) })
        i = end + 1
        continue
      }
    }
    const next = src.slice(i).search(/`|\*\*|\*/)
    const take = next < 0 ? src.length - i : Math.max(1, next)
    pushText(out, src.slice(i, i + take))
    i += take
  }
  return out
}

function linkNode(href: string, label: string): InlineNode {
  const card = buildFeishuCard(href, label)
  return card ? { kind: 'feishu', card } : { kind: 'link', href, label }
}

function parseBareUrls(src: string): InlineNode[] {
  const out: InlineNode[] = []
  let last = 0
  const re = new RegExp(BARE_URL_RE.source, 'g')
  let match: RegExpExecArray | null
  while ((match = re.exec(src))) {
    const lead = match[1] || ''
    const raw = match[2] || ''
    const start = match.index + lead.length
    out.push(...parseEmphasis(src.slice(last, start)))
    const href = raw.startsWith('http') ? raw : `https://${raw}`
    const card = buildFeishuCard(href, '飞书文档')
    out.push(card ? { kind: 'feishu', card } : { kind: 'link', href, label: raw })
    last = start + raw.length
  }
  out.push(...parseEmphasis(src.slice(last)))
  return out
}

export function parseInlines(src: string): InlineNode[] {
  const text = String(src || '')
  const out: InlineNode[] = []
  let last = 0
  const re = new RegExp(MD_LINK_RE.source, 'g')
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    out.push(...parseBareUrls(text.slice(last, match.index)))
    out.push(linkNode(match[2], match[1]))
    last = match.index + match[0].length
  }
  out.push(...parseBareUrls(text.slice(last)))
  return out.filter((node) => !(node.kind === 'text' && !node.text))
}

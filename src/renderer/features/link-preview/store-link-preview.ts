/**
 * 右侧 KnowMe 浏览器（飞书/外链预览）状态。
 * 不负责文档审阅 surface-review。
 */
import * as FeishuLink from '@knowme-lib/feishu-link'
import { normalizeLocalMarkdownPath, sourceFileUrl } from '../../../domain/content-resource-link'
import { api, type StoreGet, type StoreSet } from '../../app/store-types'

const parseOpenLink = (FeishuLink as { parseOpenLink: (href: string) => {
  href: string
  protocol: string
  label?: string
  isFeishu?: boolean
} | null }).parseOpenLink

export type LinkPreviewState = {
  kind?: 'web' | 'markdown'
  href: string
  title: string
  protocol: string
  isFeishu: boolean
  sourceId?: string
  path?: string
  content?: string
  loading?: boolean
  error?: string
  externalHref?: string
  presentation?: 'pane' | 'overlay'
  resolveTitle?: boolean
}

export type LinkPreviewOpenOptions = {
  presentation?: 'pane' | 'overlay'
  resolveTitle?: boolean
}

function normalizeResolvedTitle(value: string): string {
  const title = String(value || '')
    .replace(/\s*[-|·]\s*(?:飞书(?:云文档|知识库)?|Feishu(?: Docs)?|Lark(?: Docs)?)\s*$/i, '')
    .trim()
  if (!title || /^(?:飞书|飞书云文档|飞书文档|飞书知识库|知识库|未命名文档|无标题|Feishu|Lark|加载中|Loading)$/i.test(title)) return ''
  if (/^https?:\/\//i.test(title)) return ''
  return title.slice(0, 120)
}

export function createLinkPreviewSlice(set: StoreSet, get: StoreGet) {
  return {
    linkPreview: null as LinkPreviewState | null,
    linkFullscreen: false,
    linkTitleCache: {} as Record<string, string>,

    /** 校验 URL 后打开右侧预览；不安全链接返回 false。 */
    openLinkPreview: (href: string, title = '', options: LinkPreviewOpenOptions = {}) => {
      const parsed = parseOpenLink(href)
      if (!parsed) {
        get().showToast('链接不安全或不支持预览')
        return false
      }
      if (parsed.protocol === 'knowme:' && /\/\/feishu\/auth(?:[/?#]|$)/i.test(parsed.href)) {
        get().openSettingsSurface('connectors')
        get().showToast('请在「设置 → 连接器」完成飞书授权')
        return false
      }
      const presentation = options.presentation === 'overlay' ? 'overlay' : 'pane'
      const cachedTitle = get().linkTitleCache?.[parsed.href] || ''
      set({
        ...(presentation === 'pane' ? { route: 'assistant' as const } : {}),
        linkPreview: {
          href: parsed.href,
          title: String(cachedTitle || title || parsed.label || '链接').slice(0, 120),
          protocol: parsed.protocol,
          isFeishu: Boolean(parsed.isFeishu),
          presentation,
          resolveTitle: options.resolveTitle === true,
        },
        linkFullscreen: presentation === 'overlay',
      })
      return true
    },

    updateLinkPreviewTitle: (value: string) => {
      const title = normalizeResolvedTitle(value)
      const current = get().linkPreview
      if (!title || !current?.resolveTitle) return
      set({
        linkPreview: { ...current, title },
        linkTitleCache: { ...get().linkTitleCache, [current.href]: title },
      })
    },

    cacheLinkTitle: (href: string, value: string) => {
      const parsed = parseOpenLink(href)
      const title = normalizeResolvedTitle(value)
      if (!parsed || !title) return
      set({ linkTitleCache: { ...get().linkTitleCache, [parsed.href]: title } })
    },

    /** 在活动内容源中读取相对 Markdown 链接，并在右侧渲染文档。 */
    openMarkdownPreview: async (href: string, title = '') => {
      const path = normalizeLocalMarkdownPath(href)
      if (!path) {
        get().showToast('Markdown 路径不安全或不受支持')
        return false
      }
      let sourceId = get().activeSourceId || ''
      let sources = get().sources
      if (!sourceId) {
        try {
          const list = await api()?.sourcesList?.()
          sources = (list?.sources || []) as typeof sources
          sourceId = String(list?.activeSourceId || sources[0]?.id || '')
        } catch { /* handled below */ }
      }
      if (!sourceId) {
        get().showToast('请先添加并选择内容源')
        return false
      }
      const source = sources.find((item) => item.id === sourceId)
      const next: LinkPreviewState = {
        kind: 'markdown',
        href,
        title: String(title || path.split('/').pop() || 'Markdown 文档').slice(0, 120),
        protocol: 'file:',
        isFeishu: false,
        sourceId,
        path,
        content: '',
        loading: true,
        externalHref: sourceFileUrl(source?.rootPath || '', path) || undefined,
      }
      set({ route: 'assistant', linkPreview: next, linkFullscreen: false })
      try {
        const result = await api()?.sourcesReadFile?.({ sourceId, path })
        const current = get().linkPreview
        if (current?.kind !== 'markdown' || current.sourceId !== sourceId || current.path !== path) return false
        if (result?.ok === false) {
          set({ linkPreview: { ...current, loading: false, error: result.error || '无法读取文档' } })
          return false
        }
        set({ linkPreview: { ...current, loading: false, content: String(result?.content || '') } })
        return true
      } catch {
        const current = get().linkPreview
        if (current?.kind === 'markdown' && current.sourceId === sourceId && current.path === path) {
          set({ linkPreview: { ...current, loading: false, error: '无法读取文档' } })
        }
        return false
      }
    },

    closeLinkPreview: () => set({ linkPreview: null, linkFullscreen: false }),

    setLinkFullscreen: (next: boolean) => {
      const { linkPreview } = get()
      set({ linkFullscreen: Boolean(next && linkPreview) })
    },
  }
}

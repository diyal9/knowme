/**
 * 右侧 KnowMe 浏览器（飞书/外链预览）状态。
 * 不负责文档审阅 surface-review。
 */
import * as FeishuLink from '@knowme-lib/feishu-link'
import type { StoreGet, StoreSet } from '../../app/store-types'

const parseOpenLink = (FeishuLink as { parseOpenLink: (href: string) => {
  href: string
  protocol: string
  label?: string
  isFeishu?: boolean
} | null }).parseOpenLink

export type LinkPreviewState = {
  href: string
  title: string
  protocol: string
  isFeishu: boolean
}

export function createLinkPreviewSlice(set: StoreSet, get: StoreGet) {
  return {
    linkPreview: null as LinkPreviewState | null,
    linkFullscreen: false,

    /** 校验 URL 后打开右侧预览；不安全链接返回 false。 */
    openLinkPreview: (href: string, title = '') => {
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
      set({
        route: 'assistant',
        linkPreview: {
          href: parsed.href,
          title: String(title || parsed.label || '链接').slice(0, 120),
          protocol: parsed.protocol,
          isFeishu: Boolean(parsed.isFeishu),
        },
        linkFullscreen: false,
      })
      return true
    },

    closeLinkPreview: () => set({ linkPreview: null, linkFullscreen: false }),

    setLinkFullscreen: (next: boolean) => {
      const { linkPreview } = get()
      set({ linkFullscreen: Boolean(next && linkPreview) })
    },
  }
}

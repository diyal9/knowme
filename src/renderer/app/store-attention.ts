import { normalizeAttentionItem, type AttentionItem } from '../../domain/attention'
import { api, type StoreGet, type StoreSet } from './store-types'

export function createAttentionSlice(set: StoreSet, get: StoreGet) {
  return {
    attentionItems: [] as AttentionItem[],
    attentionPulse: false,

    upsertAttention: (raw: unknown) => {
      const item = normalizeAttentionItem(raw)
      if (!item) return
      set((state) => {
        const next = new Map(state.attentionItems.map((row) => [row.id, row]))
        next.set(item.id, item)
        const items = [...next.values()]
        return {
          attentionItems: items,
          attentionPulse: item.urgency === 'input' ? true : state.attentionPulse,
        }
      })
    },

    clearAttention: (id?: string) => {
      if (!id) {
        set({ attentionItems: [], attentionPulse: false })
        return
      }
      set((state) => {
        const items = state.attentionItems.filter((item) => item.id !== id)
        const hasInput = items.some((item) => item.urgency === 'input')
        return { attentionItems: items, attentionPulse: hasInput ? state.attentionPulse : false }
      })
    },

    setAttentionPulse: (attentionPulse: boolean) => set({ attentionPulse }),

    activateAttention: (id: string) => {
      const item = get().attentionItems.find((row) => row.id === id)
      if (!item) return
      set({ attentionPulse: false })
      const link = item.deepLink
      if (link?.type === 'daemon-task' && link.slug) {
        void get().openDaemonTaskSlug(link.slug)
        return
      }
      get().showToast(item.title)
    },
  }
}

export function bindAttentionEvents(get: StoreGet) {
  const onNeeds = (event: Event) => {
    get().upsertAttention((event as CustomEvent).detail)
  }
  const onCleared = (event: Event) => {
    const detail = (event as CustomEvent).detail
    get().clearAttention(typeof detail === 'string' ? detail : detail?.id)
  }
  window.addEventListener('knowme-needs-attention', onNeeds)
  window.addEventListener('knowme-attention-cleared', onCleared)
  const unsub = window.api?.onAttentionOpen?.((payload) => {
    if (payload?.id) {
      get().upsertAttention(payload)
      get().activateAttention(payload.id)
    }
  })
  return () => {
    window.removeEventListener('knowme-needs-attention', onNeeds)
    window.removeEventListener('knowme-attention-cleared', onCleared)
    if (typeof unsub === 'function') unsub()
  }
}

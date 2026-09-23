import type { ConfirmModalState, OverlayContextMenu, OverlayDrawer, StoreGet, StoreSet, WorkspaceModalState } from './store-types'

const CONTEXT_MENU_SAFE_WIDTH = 240
const CONTEXT_MENU_ITEM_HEIGHT = 32
const CONTEXT_MENU_VERTICAL_PADDING = 12
const CONTEXT_MENU_VIEWPORT_MARGIN = 8

function clampContextMenuPosition(menu: OverlayContextMenu): OverlayContextMenu {
  if (typeof window === 'undefined') return menu
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  if (!viewportWidth || !viewportHeight) return menu
  const estimatedHeight = CONTEXT_MENU_VERTICAL_PADDING + menu.items.length * CONTEXT_MENU_ITEM_HEIGHT
  const maxX = Math.max(CONTEXT_MENU_VIEWPORT_MARGIN, viewportWidth - CONTEXT_MENU_SAFE_WIDTH - CONTEXT_MENU_VIEWPORT_MARGIN)
  const maxY = Math.max(CONTEXT_MENU_VIEWPORT_MARGIN, viewportHeight - estimatedHeight - CONTEXT_MENU_VIEWPORT_MARGIN)
  return {
    ...menu,
    x: Math.min(maxX, Math.max(CONTEXT_MENU_VIEWPORT_MARGIN, menu.x)),
    y: Math.min(maxY, Math.max(CONTEXT_MENU_VIEWPORT_MARGIN, menu.y)),
  }
}

export function createChromeSlice(set: StoreSet, _get: StoreGet) {
  return {
    overlayToast: '',
    overlayDrawer: null as OverlayDrawer | null,
    overlayContextMenu: null as OverlayContextMenu | null,
    confirmModal: null as ConfirmModalState | null,
    workspaceModal: null as WorkspaceModalState | null,
    showToast: (overlayToast: string) => {
      set({ overlayToast })
      window.setTimeout(() => {
        set((state) => (state.overlayToast === overlayToast ? { overlayToast: '' } : {}))
      }, 2400)
    },
    openDrawer: (overlayDrawer: OverlayDrawer) => set({ overlayDrawer }),
    closeDrawer: () => set({ overlayDrawer: null }),
    openContextMenu: (overlayContextMenu: OverlayContextMenu) => set({ overlayContextMenu: clampContextMenuPosition(overlayContextMenu) }),
    closeContextMenu: () => set({ overlayContextMenu: null }),
    openConfirm: (confirmModal: ConfirmModalState) => set({ confirmModal }),
    closeConfirm: () => set({ confirmModal: null }),
    openWorkspaceModal: (slug: string) => set({ workspaceModal: { slug } }),
    closeWorkspaceModal: () => set({ workspaceModal: null }),
  }
}

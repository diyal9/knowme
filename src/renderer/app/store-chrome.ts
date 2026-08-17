import type { ConfirmModalState, OverlayContextMenu, OverlayDrawer, StoreGet, StoreSet, WorkspaceModalState } from './store-types'

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
    openContextMenu: (overlayContextMenu: OverlayContextMenu) => set({ overlayContextMenu }),
    closeContextMenu: () => set({ overlayContextMenu: null }),
    openConfirm: (confirmModal: ConfirmModalState) => set({ confirmModal }),
    closeConfirm: () => set({ confirmModal: null }),
    openWorkspaceModal: (slug: string) => set({ workspaceModal: { slug } }),
    closeWorkspaceModal: () => set({ workspaceModal: null }),
  }
}

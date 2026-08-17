/**
 * 工作台浮层：toast、抽屉、确认框。离开编排确认含「保存后离开」。
 */
import { useEffect } from 'react'
import { Icon } from './Icon'
import { useAppStore } from './store'
import { WorkspaceFab } from './WorkspaceFab'
import { WorkspaceTreeModal } from '../features/manage/WorkspaceTreeModal'

export function WorkspaceOverlays() {
  const toast = useAppStore((s) => s.overlayToast)
  const drawer = useAppStore((s) => s.overlayDrawer)
  const menu = useAppStore((s) => s.overlayContextMenu)
  const confirmModal = useAppStore((s) => s.confirmModal)
  const closeDrawer = useAppStore((s) => s.closeDrawer)
  const closeContextMenu = useAppStore((s) => s.closeContextMenu)
  const closeConfirm = useAppStore((s) => s.closeConfirm)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      closeDrawer()
      closeContextMenu()
      closeConfirm()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [closeDrawer, closeContextMenu, closeConfirm])

  const isLeaveConfirm = Boolean(confirmModal?.altLabel)

  return (
    <>
      <div id="toastWrap" className={`toast-wrap${toast ? ' show' : ''}`} role="status" aria-live="polite">
        <div id="toast" className="toast">{toast}</div>
      </div>
      <WorkspaceFab />
      {drawer ? (
        <>
          <div
            className="drawer-backdrop secondary-dialog-mask workspace-drawer-backdrop"
            id="drawerBackdrop"
            aria-hidden="true"
            onClick={closeDrawer}
          />
          <aside
            className="drawer open secondary-dialog workspace-drawer"
            id="drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawerTitle"
            data-testid="workspace-drawer"
          >
            <div className="drawer-head secondary-dialog__head">
              <div className="drawer-title" id="drawerTitle">{drawer.title}</div>
              <button type="button" className="drawer-close" id="drawerClose" aria-label="关闭" onClick={closeDrawer}>
                <Icon name="close" />
              </button>
            </div>
            <div className="drawer-body" id="drawerBody">{drawer.body || ''}</div>
          </aside>
        </>
      ) : null}
      {menu ? (
        <div
          id="ctxMenu"
          className="ctx-menu show"
          data-testid="workspace-ctx-menu"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
        >
          {menu.items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`ctx-item${item.danger ? ' danger' : ''}`}
              role="menuitem"
              onClick={() => {
                item.onClick()
                closeContextMenu()
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
      {confirmModal ? (
        <div
          className={`wb-modal-mask${isLeaveConfirm ? ' is-leave-confirm' : ' is-confirm'}`}
          data-testid="confirm-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wbConfirmTitle"
        >
          <div className={`wb-modal${isLeaveConfirm ? ' wb-leave-modal' : ' wb-confirm-modal'}`}>
            <div className="wb-modal-head">
              <div className="wb-modal-title" id="wbConfirmTitle">{confirmModal.title}</div>
            </div>
            {confirmModal.body ? (
              <div className="wb-modal-body">{confirmModal.body}</div>
            ) : null}
            <div className="wb-modal-foot">
              <div className="wb-modal-hint" aria-hidden="true" />
              <div className="wb-modal-actions">
                <button type="button" className="wb-modal-btn" data-leave-choice="cancel" onClick={closeConfirm}>
                  取消
                </button>
                {isLeaveConfirm ? (
                  <>
                    {/* 离开确认：放弃用普通次要钮，避免粉红危险色抢主操作 */}
                    <button
                      type="button"
                      className="wb-modal-btn"
                      data-leave-choice="discard"
                      onClick={() => {
                        void confirmModal.onConfirm()
                        closeConfirm()
                      }}
                    >
                      {confirmModal.confirmLabel || '确认'}
                    </button>
                    <button
                      type="button"
                      className="wb-modal-btn primary"
                      data-leave-choice="save"
                      onClick={() => {
                        void confirmModal.onAlt?.()
                        closeConfirm()
                      }}
                    >
                      {confirmModal.altLabel}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={`wb-modal-btn${confirmModal.danger ? ' danger' : ' primary'}`}
                    onClick={() => {
                      void confirmModal.onConfirm()
                      closeConfirm()
                    }}
                  >
                    {confirmModal.confirmLabel || '确认'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <WorkspaceTreeModal />
    </>
  )
}

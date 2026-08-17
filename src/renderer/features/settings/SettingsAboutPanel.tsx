import { useEffect, useState } from 'react'
import { Icon } from '../../app/Icon'

const ABOUT_BLOG = 'https://diyal9.github.io/tcloudblog/'
const ABOUT_WECHAT = 'diyalyin'
const ABOUT_MAIL = '670924505@qq.com'

type Props = {
  flash: (msg: string, kind?: 'ok' | 'err') => void
}

export function SettingsAboutPanel({ flash }: Props) {
  const [info, setInfo] = useState<{ name?: string; version?: string; isPackaged?: boolean }>({})
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const app = await window.api?.appInfo?.()
        setInfo(app || {})
      } catch {
        setInfo({ name: 'KnowMe' })
      }
    })()
  }, [])

  const copyText = (text: string, okMsg: string) => {
    try {
      window.api?.copyToClipboard?.(text)
      flash(okMsg)
    } catch {
      flash('无法复制', 'err')
    }
  }

  const version = info.version ? `v${info.version}` : '—'
  const buildMeta = info.version
    ? (info.isPackaged ? '正式安装版 · 支持自动更新' : '开发模式')
    : '加载中…'

  return (
    <div className="settings-section">
      <div className="settings-section-head">
        <div className="settings-section-title">关于</div>
      </div>
      <div className="settings-stat-grid settings-stat-wide">
        <div>
          <small>版本</small>
          <strong data-testid="app-version">{version}</strong>
          <span>{buildMeta}</span>
        </div>
      </div>
      <div className="settings-actions">
        <button
          type="button"
          className="settings-btn"
          disabled={checking}
          onClick={async () => {
            setChecking(true)
            try {
              const result = await window.api?.checkForUpdates?.() as { ok?: boolean; message?: string } | undefined
              flash(result?.message || (result?.ok ? '检查完成' : '检查失败'), result?.ok === false ? 'err' : 'ok')
            } catch (error) {
              flash(error instanceof Error ? error.message : '检查更新失败', 'err')
            } finally {
              setChecking(false)
            }
          }}
        >
          {checking ? '检查中…' : '检查更新'}
        </button>
      </div>
      <div className="settings-about-links" role="group" aria-label="开发者信息">
        <button
          type="button"
          className="settings-icon-btn"
          title="技术博客 · TCloud Blog"
          aria-label="技术博客"
          onClick={async () => {
            const result = await window.api?.openExternal?.(ABOUT_BLOG)
            if (!result?.ok) flash(result?.message || '无法打开博客', 'err')
          }}
        >
          <Icon name="bookOpen" />
        </button>
        <button
          type="button"
          className="settings-icon-btn"
          title="请我喝杯冰美式（不加糖）· 微信 diyalyin"
          aria-label="请喝冰美式"
          onClick={() => copyText(ABOUT_WECHAT, '喜欢喝冰美式（不加糖）· 微信已复制 diyalyin')}
        >
          <Icon name="coffee" />
        </button>
        <button
          type="button"
          className="settings-icon-btn"
          title={`邮箱 ${ABOUT_MAIL}`}
          aria-label="联系邮箱"
          onClick={async () => {
            const result = await window.api?.openExternal?.(`mailto:${ABOUT_MAIL}`)
            if (!result?.ok) copyText(ABOUT_MAIL, '邮箱已复制')
          }}
        >
          <Icon name="mail" />
        </button>
      </div>
      <p className="settings-copyright">© 2026 KnowMe · diyal9</p>
    </div>
  )
}

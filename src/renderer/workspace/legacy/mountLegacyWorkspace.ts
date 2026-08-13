/**
 * Mount legacy workspace.html body + styles + scripts under document.body
 * so product behavior matches KNOWME_RENDERER=legacy while entry is Vite/React.
 * Legacy nodes stay outside React #root to avoid reconcile wipes.
 */
import { legacyAssetBase } from '../../shared/legacyBase'

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.async = false
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`Failed to load script: ${src}`))
    document.body.appendChild(s)
  })
}

export async function mountLegacyWorkspace(): Promise<void> {
  if (document.getElementById('appShell')) return

  const LEGACY_BASE = legacyAssetBase()
  const res = await fetch(`${LEGACY_BASE}workspace.html`)
  if (!res.ok) throw new Error(`Cannot fetch legacy workspace.html (${res.status})`)
  const html = await res.text()
  const doc = new DOMParser().parseFromString(html, 'text/html')

  doc.head.querySelectorAll('style').forEach((style) => {
    document.head.appendChild(style.cloneNode(true))
  })
  doc.head.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    const href = link.getAttribute('href')
    if (!href) return
    const el = document.createElement('link')
    el.rel = 'stylesheet'
    el.href = href.startsWith('http') ? href : `${LEGACY_BASE}${href.replace(/^\.\//, '')}`
    document.head.appendChild(el)
  })

  const chrome = doc.querySelector('.app-chrome-drag')
  const shell = doc.getElementById('appShell')
  if (!shell) throw new Error('legacy workspace.html missing #appShell')

  if (chrome) document.body.insertBefore(chrome.cloneNode(true), document.getElementById('root'))
  document.body.insertBefore(shell.cloneNode(true), document.getElementById('root'))

  const bodyChildren = Array.from(doc.body.children)
  for (const child of bodyChildren) {
    if (child.id === 'appShell') continue
    if (child.tagName === 'SCRIPT') continue
    if (child.classList?.contains('app-chrome-drag')) continue
    document.body.appendChild(child.cloneNode(true))
  }

  const scripts = Array.from(doc.querySelectorAll('script[src]')) as HTMLScriptElement[]
  for (const script of scripts) {
    const raw = script.getAttribute('src') || ''
    const pathName = raw.split('?')[0].replace(/^\.\//, '')
    if (!pathName) continue
    await loadScript(`${LEGACY_BASE}${pathName}`)
  }
}

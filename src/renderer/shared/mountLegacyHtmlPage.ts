/**
 * Generic legacy HTML page host for secondary Electron windows.
 */
import { legacyAssetBase } from './legacyBase'

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

export async function mountLegacyHtmlPage(pageFile: string): Promise<void> {
  const base = legacyAssetBase()
  const res = await fetch(`${base}${pageFile}`)
  if (!res.ok) throw new Error(`Cannot fetch ${pageFile} (${res.status})`)
  const html = await res.text()
  const doc = new DOMParser().parseFromString(html, 'text/html')

  document.title = doc.title || document.title
  doc.head.querySelectorAll('style').forEach((style) => {
    document.head.appendChild(style.cloneNode(true))
  })
  doc.head.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    const href = link.getAttribute('href')
    if (!href) return
    const el = document.createElement('link')
    el.rel = 'stylesheet'
    el.href = href.startsWith('http') ? href : `${base}${href.replace(/^\.\//, '')}`
    document.head.appendChild(el)
  })

  const root = document.getElementById('root')
  if (root) root.innerHTML = ''
  const target = root || document.body
  Array.from(doc.body.childNodes).forEach((node) => {
    if (node.nodeName === 'SCRIPT') return
    target.appendChild(node.cloneNode(true))
  })

  for (const script of Array.from(doc.querySelectorAll('script[src]')) as HTMLScriptElement[]) {
    const raw = script.getAttribute('src') || ''
    const path = raw.split('?')[0].replace(/^\.\//, '')
    if (!path) continue
    await loadScript(`${base}${path}`)
  }
}

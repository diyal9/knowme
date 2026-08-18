/**
 * 表面 CSS 契约：壳层静态导入；各 feature 自带样式表。禁止只靠 useEffect 猜加载。
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const renderer = path.resolve(import.meta.dirname, '..')

function read(rel: string) {
  return readFileSync(path.join(renderer, rel), 'utf8')
}

describe('surface CSS contract', () => {
  it('AppShell routes only; loaders live in surface-registry', () => {
    const src = read('app/AppShell.tsx')
    expect(src).toMatch(/workbench-chrome\.css/)
    expect(src).not.toMatch(/ensureSurfaceCss/)
    expect(src).not.toMatch(/lazySurface\(/)
    expect(src).toMatch(/from '\.\/surface-registry'/)
  })

  it('workbench-chrome styles .wb-head and .wb-mode-tab', () => {
    const css = read('features/workbench/workbench-chrome.css')
    expect(css).toMatch(/\.wb-head\s*\{/)
    expect(css).toMatch(/\.wb-mode-tab\s*\{/)
    expect(css).toMatch(/border:\s*0/)
  })

  it('each lazy surface imports its own stylesheet', () => {
    expect(read('features/taskhome/TaskHomeSurface.tsx')).toMatch(/workbench-layout\.css/)
    expect(read('features/shelf/ShelfSurface.tsx')).toMatch(/\.\/shelf\.css/)
    expect(read('features/run/RunSurface.tsx')).toMatch(/\.\/console\.css/)
    expect(read('features/manage/DaemonComposePanel.tsx')).toMatch(/console\.css/)
    expect(read('features/manage/ManageSurface.tsx')).toMatch(/workbench-layout\.css/)
    expect(read('features/studio/StudioSurface.tsx')).toMatch(/workbench-studio\.css/)
    expect(read('features/capability-hub/CapabilityHubSurface.tsx')).toMatch(/capability-hub\.css/)
    expect(read('features/knowledge/KnowledgeSurface.tsx')).toMatch(/knowledge-chrome\.css/)
  })

  it('capability hub canvas follows the shared island token, not a private beige', () => {
    const css = read('styles/capability-hub.css')
    expect(css).not.toMatch(/--hub-bg:\s*#f3f1ed/)
    expect(css).toMatch(/--hub-bg:\s*var\(--bg-card/)
  })
})

/**
 * 表面 CSS 契约：壳层静态导入；各 feature 自带样式表。禁止只靠 useEffect 猜加载。
 */
import { readFileSync } from 'node:fs'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const renderer = path.resolve(import.meta.dirname, '..')

function read(rel: string) {
  return readFileSync(path.join(renderer, rel), 'utf8')
}

function rendererCss(dir = renderer): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return rendererCss(full)
    return entry.isFile() && entry.name.endsWith('.css') ? [full] : []
  })
}

describe('surface CSS contract', () => {
  it('loads the shared UI foundation in every renderer entry', () => {
    const entries = [
      'workspace/WorkspaceApp.tsx',
      'settings/main.tsx',
      'memory/main.tsx',
      'log-viewer/main.tsx',
    ]
    for (const entry of entries) {
      expect(read(entry), entry).toMatch(/app\/ui-system\.css/)
    }
  })

  it('publishes semantic surface, action, layout and control tokens', () => {
    const tokens = read('app/tokens.css')
    for (const token of [
      '--surface-page:',
      '--surface-panel:',
      '--text-primary:',
      '--border-default:',
      '--action-primary:',
      '--page-max:',
      '--control-md:',
      '--radius-md:',
      '--type-page:',
      '--type-body:',
      '--type-meta:',
    ]) {
      expect(tokens, token).toContain(token)
    }
    expect(tokens).toMatch(/--surface-page:\s*var\(--bg-card\)/)
    expect(read('app/ui-system.css')).toMatch(/\.ui-button/)
  })

  it('keeps the application rail compact and visually quiet', () => {
    const tokens = read('app/tokens.css')
    const chrome = read('styles/workspace-chrome.css')
    expect(tokens).toMatch(/--rail-width:\s*108px/)
    expect(chrome).toMatch(/\.rail-top\s*\{[^}]*gap:4px/s)
    expect(chrome).toMatch(/\.rail-btn\s*\{[^}]*height:40px[^}]*font:400 var\(--font-sm\)/s)
    expect(chrome).toMatch(/\.rail-btn \.ico\s*\{[^}]*width:17px; height:17px/s)
    expect(chrome).toMatch(/\.rail-btn\.active\s*\{[^}]*font-weight:500/s)
    expect(chrome).not.toMatch(/\.rail-btn:active\s*\{[^}]*translateY/s)
  })

  it('AppShell routes only; loaders live in surface-registry', () => {
    const src = read('app/AppShell.tsx')
    expect(src).toMatch(/workbench-styles/)
    expect(src).not.toMatch(/ensureSurfaceCss/)
    expect(src).not.toMatch(/lazySurface\(/)
    expect(src).toMatch(/from '\.\/surface-registry'/)
  })

  it('loads every wb feature stylesheet before lazy surfaces in a deterministic order', () => {
    const registry = read('features/workbench/workbench-styles.ts')
    const expected = [
      '../run/console.css',
      './workbench-layout.css',
      '../shelf/shelf.css',
      './workbench-daemon.css',
      './workbench-studio.css',
      '../expert/expert-workbench.css',
      '../workflow/workflow-room.css',
    ]
    const positions = expected.map((stylesheet) => {
      const position = registry.indexOf(`import '${stylesheet}'`)
      expect(position, stylesheet).toBeGreaterThanOrEqual(0)
      return position
    })
    expect(positions).toEqual([...positions].sort((a, b) => a - b))

    const featureRoot = path.join(renderer, 'features')
    const registered = new Set(expected.map((stylesheet) => path.resolve(
      renderer,
      'features/workbench',
      stylesheet,
    )))
    registered.add(path.resolve(renderer, 'features/workbench/workbench-chrome.css'))
    const wbStyles = rendererCss(featureRoot).filter((file) => readFileSync(file, 'utf8').includes('.wb-'))
    expect(wbStyles.map((file) => path.normalize(file)).sort()).toEqual(
      [...registered].map((file) => path.normalize(file)).sort(),
    )
  })

  it('keeps the side-effect-only style registry in production builds', () => {
    const vite = read('../../vite.config.ts')
    expect(vite).toMatch(/moduleSideEffects:/)
    expect(vite).toMatch(/workbench-styles\\\.ts/)
    expect(vite).toMatch(/\\\.css/)
  })

  it('workbench-chrome styles .wb-head and .wb-mode-tab', () => {
    const shell = read('app/AppShell.tsx')
    const css = read('features/workbench/workbench-chrome.css')
    expect(shell).toMatch(/workbench-styles/)
    expect(shell).toMatch(/workbench-chrome\.css/)
    expect(shell.indexOf('workbench-styles')).toBeLessThan(shell.indexOf('workbench-chrome.css'))
    expect(css).toMatch(/\.wb-head\s*\{/)
    expect(css).toMatch(/\.wb-mode-tab\s*\{/)
    expect(css).toMatch(/\.wb-shelf-search\s*\{/)
    expect(css).toMatch(/border:\s*0/)
    expect(read('features/shelf/shelf.css')).not.toMatch(/\.wb-shelf-search\s*\{/)
  })

  it('keeps wb feature styles out of lazy surface chunks', () => {
    const lazyWorkbenchSources = [
      'features/expert/ExpertDetailSurface.tsx',
      'features/expert/ExpertRoomSurface.tsx',
      'features/expert/ExpertTaskRoom.tsx',
      'features/manage/DaemonComposePanel.tsx',
      'features/manage/ManageSurface.tsx',
      'features/run/RunSurface.tsx',
      'features/shelf/ShelfSurface.tsx',
      'features/studio/StudioSurface.tsx',
      'features/taskhome/TaskHomeSurface.tsx',
      'features/workflow/WorkflowTaskRoom.tsx',
    ]
    const wbStylesheet = /(?:console|shelf|workbench-(?:chrome|daemon|layout|studio)|expert-workbench|workflow-room)\.css/
    for (const source of lazyWorkbenchSources) {
      expect(read(source), source).not.toMatch(wbStylesheet)
    }

    expect(read('features/capability-hub/CapabilityHubSurface.tsx')).toMatch(/capability-hub\.css/)
    expect(read('features/knowledge/KnowledgeSurface.tsx')).toMatch(/knowledge-chrome\.css/)
  })

  it('capability hub canvas follows the shared island token, not a private beige', () => {
    const css = read('styles/capability-hub.css')
    expect(css).not.toMatch(/--hub-bg:\s*#f3f1ed/)
    expect(css).toMatch(/--hub-bg:\s*var\(--surface-page/)
  })

  it('workflow detail uses the shared neutral canvas and inset surface tokens', () => {
    const css = read('features/shelf/shelf.css')
    expect(css).toMatch(/\.wb-workflow-detail\s*\{[^}]*background:var\(--bg-card, #fff\)/s)
    expect(css).toMatch(/\.wb-workflow-contract-flow\s*\{[^}]*background:var\(--bg-app, #f7f8f9\)/s)
    expect(css).not.toMatch(/\.wb-workflow-detail\s*\{[^}]*background:#f6f7f7/s)
  })

  it('lets long workflow summaries scroll from the true top instead of clipping centered content', () => {
    const css = read('features/shelf/shelf.css')
    expect(css).toMatch(/\.wb-workflow-detail-panel\s*\{[^}]*min-height:0/s)
    expect(css).toMatch(/\.wb-workflow-detail-panel\.is-contract\s*\{[^}]*justify-content:flex-start[^}]*overflow-y:auto[^}]*overflow-x:hidden/s)
    expect(css).not.toMatch(/\.wb-workflow-detail-panel\.is-contract\s*\{[^}]*justify-content:center/s)
  })

  it('gives desktop workflow details the available vertical space without stacked page insets', () => {
    const css = read('features/shelf/shelf.css')
    expect(css).toMatch(/#workbench:has\(\.wb-workflow-detail\)\s*>\s*\.wb-body\s*\{[^}]*padding-block:8px 12px/s)
    expect(css).toMatch(/#workbench:has\(\.wb-workflow-detail\)\s+\.wb-workflow-detail\s*\{[^}]*height:100%[^}]*padding-block:0/s)
  })

  it('keeps workflow catalog filters owned by the shelf surface', () => {
    const shelf = read('features/shelf/shelf.css')
    const consoleCss = read('features/run/console.css')
    expect(shelf).toMatch(/\.wb-domain-switcher\s*\{/)
    expect(shelf).toMatch(/\.wb-domain-chip\.active::after/)
    expect(consoleCss).not.toMatch(/\.wb-domain-(?:switcher|chip)/)
  })

  it('reuses the expert collaboration list-toggle appearance on the workflow shelf', () => {
    const shared = read('features/workbench/workbench-layout.css')
    const shelf = read('features/shelf/shelf.css')
    expect(shared).toMatch(/\.wb-team-toggle, \.wb-list-toggle\s*\{[^}]*border:0[^}]*background:transparent/s)
    expect(shelf).not.toMatch(/\.wb-shelf-catalog\s*>\s*\.wb-list-toggle/)
    expect(shelf).toMatch(/\.wb-shelf-catalog\.expanded \.wb-list-toggle-mark/)
  })

  it('keeps workflow delivery dominant and shelf filters position-stable', () => {
    const workflow = read('features/workflow/workflow-room.css')
    const chrome = read('features/workbench/workbench-chrome.css')
    expect(workflow).toMatch(/#appShell\.mode-workbench\[data-workbench-layout="task-room"\]\[data-workbench-task-kind="workflow-chat"\] \.main\s*\{[^}]*grid-template-columns:clamp\(380px, 34%, 600px\) minmax\(0, 1fr\)/s)
    expect(chrome).toMatch(/\.workbench > \.wb-body\s*\{[^}]*scrollbar-gutter:stable/s)
  })

  it('keeps the pipeline home in two columns until a genuinely narrow viewport', () => {
    const css = read('features/run/console.css')
    const shelf = read('features/shelf/shelf.css')
    expect(css).toMatch(/@media \(min-width:981px\) and \(max-width:1100px\)\s*\{\s*\.wb-daemon-home-shell\s*\{[^}]*minmax\(420px, \.74fr\)/s)
    expect(css).toMatch(/@media \(max-width:980px\)\s*\{\s*\.wb-daemon-home-shell\s*\{[^}]*grid-template-rows:auto minmax\(340px, 45vh\)/s)
    expect(css).toMatch(/@media \(max-width:980px\)[\s\S]*?\.wb-daemon-compose-panel\s*\{[^}]*min-height:620px/s)
    expect(css).not.toMatch(/@media \(max-width:1050px\)\s*\{\s*\.wb-daemon-home-shell/s)
    expect(shelf).not.toMatch(/\.wb-manage-panel \.wb-daemon-/)
  })

  it('enforces one crisp typography contract across renderer surfaces', () => {
    const tokens = read('app/tokens.css')
    expect(tokens).toMatch(/--font-family-ui:/)
    expect(tokens).toMatch(/--font-xs:\s*12px/)
    expect(tokens).toMatch(/--weight-semibold:\s*600/)

    for (const file of rendererCss()) {
      const css = readFileSync(file, 'utf8')
      expect(css, file).not.toMatch(/-webkit-font-smoothing\s*:/)
      expect(css, file).not.toMatch(/font(?:-size)?\s*:[^;}]*\b\d+\.\d+px/)
      expect(css, file).not.toMatch(/font-weight\s*:\s*(?:450|550|620|650)\b/)
      expect(css, file).not.toMatch(/font\s*:[^;}]*\b(?:450|550|620|650)\b/)
      expect(css, file).not.toMatch(/font-weight\s*:\s*(?!(?:400|500|600|700)\b)\d{3}\b/)
      expect(css, file).not.toMatch(/font\s*:\s*(?!(?:400|500|600|700)\b)\d{3}\b/)
      expect(css, file).not.toMatch(/font-size\s*:\s*(?:[1-9]|10|11)px\b/)
      expect(css, file).not.toMatch(/font\s*:[^;}]*\b(?:[1-9]|10|11)px\b/)
      expect(css, file).not.toMatch(/letter-spacing\s*:\s*-/)
      expect(css, file).not.toMatch(/font(?:-size)?\s*:[^;}]*\b\d+(?:\.\d+)?vw\b/)
      if (!file.endsWith('tokens.css')) {
        expect(css, file).not.toMatch(/\b(?:Georgia|Songti SC|SFMono-Regular|Menlo)\b/)
      }
    }

    expect(read('styles/capability-hub.css')).not.toMatch(/--hub-ui\s*:/)
    expect(read('styles/workspace-chrome.css')).not.toMatch(/--ui\s*:/)
    expect(read('features/run/console.css')).toMatch(/--wb-text-muted:\s*var\(--text2\)/)
    expect(read('features/run/console.css')).toMatch(/--wb-text-faint:\s*var\(--text3\)/)
  })
})

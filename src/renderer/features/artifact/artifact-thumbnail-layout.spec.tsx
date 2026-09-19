// Default test:renderer prerequisite (unlike the other jsdom-only tests):
// after npm ci, run `npx playwright install chromium` for the installed version.
// Do not skip when missing: chromium.launch deliberately preserves Playwright's
// actionable browser-install error. No app, persistent profile or server is used.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { chromium, type Browser } from '@playwright/test'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ArtifactPreview } from './ArtifactPreview'
import { createArtifactPreviewContract } from '../../../domain/artifact-preview'

const css = (relative: string) => readFileSync(path.resolve(import.meta.dirname, relative), 'utf8')
const common = css('../../styles/workspace-chrome.css') + css('../../app/tokens.css') + css('../../app/ui-system.css')
const shared = css('artifact-preview.css')
const expert = css('../expert/expert-workbench.css')
const shapes = [[912, 1200], [900, 900], [1600, 900], [400, 1600], [1600, 400]]
const markup = shapes.map(([width, height], index) => renderToStaticMarkup(<ArtifactPreview
  artifact={createArtifactPreviewContract({ id: `shape-${index}`, title: `shape-${index}`, type: 'image',
    source: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#27786a"/></svg>`)}`,
    actions: ['open', 'accept', 'revise'], state: 'pending',
  })} onAction={() => {}} />)).join('')

// Real component markup + complete stylesheets, with browser layout rather than
// jsdom's non-layout geometry. No server, app profile, network or hydration needed.
describe.sequential('shared image thumbnail browser layout', () => {
  let browser: Browser
  beforeAll(async () => { browser = await chromium.launch({ headless: true }) })
  afterAll(async () => { await browser?.close() })

  it('rounds all four image corners even when the image is narrower than its article', async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } })
    try {
      await page.route('**/*', route => route.abort())
      await page.setContent(`<style>${common}${shared}${expert}</style><main style="width:540px">
        <ol class="wb-expert-collab-list"><li class="wb-expert-feed-deliverable is-image">
          <div class="wb-image-preview-sequence">${markup}</div>
        </li></ol></main>`)
      const images = page.locator('.km-artifact-preview-media img')
      await images.evaluateAll(async items => Promise.all(items.map(item => (item as HTMLImageElement).decode())))
      const corners = await images.evaluateAll(items => items.map(item => {
        const style = getComputedStyle(item)
        return [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomRightRadius, style.borderBottomLeftRadius]
      }))
      expect(corners).toHaveLength(shapes.length)
      for (const radii of corners) expect(radii).toEqual(['10px', '10px', '10px', '10px'])
    } finally { await page.close() }
  })

  for (const order of ['shared-first', 'expert-first']) {
    for (const host of ['generic', 'expert']) {
      for (const viewport of [1280, 390]) {
        it(`${host}, ${order}, viewport ${viewport}: readable proportional ordered images without overflow or chrome`, async () => {
          const page = await browser.newPage({ viewport: { width: viewport, height: 820 } })
          try {
            await page.route('**/*', route => route.abort())
            const content = host === 'expert'
              ? `<ol class="wb-expert-collab-list"><li class="wb-expert-feed-deliverable is-image"><div class="wb-image-preview-sequence">${markup}</div></li></ol>`
              : `<div class="agent-artifact-list">${markup}</div>`
            await page.setContent(`<style>${common}\n${order === 'shared-first' ? shared + expert : expert + shared}</style>
              <main style="width:min(540px, calc(100vw - 48px));margin:24px">${content}</main>`)
            await page.locator('.km-artifact-preview-media img').evaluateAll(async images => {
              await Promise.all(images.map(img => (img as HTMLImageElement).decode()))
            })
            const boxes = await page.locator('.km-artifact-preview-media img').evaluateAll(images => images.map(image => {
              const img = image as HTMLImageElement
              const box = img.getBoundingClientRect()
              const parent = img.closest('.km-artifact-preview')!.getBoundingClientRect()
              return { x: box.x, right: box.right, y: box.y, bottom: box.bottom, width: box.width, height: box.height,
                ratio: img.naturalWidth / img.naturalHeight, fit: getComputedStyle(img).objectFit,
                parentRight: parent.right, parentLeft: parent.left }
            }))
            expect(boxes).toHaveLength(shapes.length)
            for (const [index, box] of boxes.entries()) {
              expect(Math.max(box.width, box.height)).toBeGreaterThanOrEqual(300)
              expect(Math.max(box.width, box.height)).toBeLessThanOrEqual(420.1)
              expect(box.width / box.height).toBeCloseTo(box.ratio, 2)
              expect(box.fit).toBe('contain')
              expect(box.x).toBeGreaterThanOrEqual(box.parentLeft - 0.1)
              expect(box.right).toBeLessThanOrEqual(Math.min(box.parentRight, viewport) + 0.1)
              if (index) expect(box.y).toBeGreaterThanOrEqual(boxes[index - 1].bottom)
            }
            expect(await page.locator('.km-artifact-preview-head, .km-artifact-preview-actions').count()).toBe(0)
            expect(await page.getByRole('button', { name: '接受成果' }).count()).toBe(0)
            // The existing image click target remains; no overlay text even on hover.
            await page.locator('.km-artifact-preview-media').first().hover()
            expect(await page.locator('.km-artifact-preview-zoom').first().isVisible()).toBe(false)
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
          } finally { await page.close() }
        })
      }
    }
  }
})

/**
 * One-time/repeatable renderer color migration.
 *
 * Raw CSS colors are classified by hue, lightness and declaration role, then
 * expressed through the semantic palette in app/brand-tokens.css. Alpha is
 * preserved with color-mix so translucent borders and shadows keep their depth.
 */
const fs = require('node:fs')
const path = require('node:path')

const repoRoot = path.resolve(__dirname, '..')
const rendererRoot = path.join(repoRoot, 'src', 'renderer')
const palettePath = path.join(rendererRoot, 'app', 'brand-tokens.css')
const write = process.argv.includes('--write')

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g
const RGB = /rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d*\.?\d+))?\s*\)/gi

const TOKENS = {
  brandInk: '--brand-ink',
  brandPaper: '--brand-paper',
  brandSignal: '--brand-signal',
  brandSignalSoft: '--brand-signal-soft',
  action: '--action-primary',
  actionHover: '--action-primary-hover',
  actionPressed: '--action-primary-pressed',
  actionSoft: '--action-primary-soft',
  actionSubtle: '--action-primary-subtle',
  surfaceApp: '--surface-app',
  surfacePage: '--surface-page',
  surfacePanel: '--surface-panel',
  surfaceSubtle: '--surface-subtle',
  surfaceMuted: '--surface-muted',
  surfaceHover: '--surface-hover',
  surfaceSelected: '--surface-selected',
  textPrimary: '--text-primary',
  textSecondary: '--text-secondary',
  textMuted: '--text-muted',
  textFaint: '--text-faint',
  textInverse: '--text-inverse',
  borderSubtle: '--border-subtle',
  borderDefault: '--border-default',
  borderStrong: '--border-strong',
  success: '--state-success',
  successSoft: '--state-success-soft',
  successBorder: '--state-success-border',
  warning: '--state-warning',
  warningSoft: '--state-warning-soft',
  warningBorder: '--state-warning-border',
  danger: '--state-danger',
  dangerSoft: '--state-danger-soft',
  dangerBorder: '--state-danger-border',
  info: '--state-info',
  infoSoft: '--state-info-soft',
  infoBorder: '--state-info-border',
}

function cssFiles(dir = rendererRoot) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return cssFiles(full)
    return entry.isFile() && entry.name.endsWith('.css') ? [full] : []
  })
}

function parseHex(value) {
  const raw = value.slice(1)
  const expanded = raw.length <= 4 ? [...raw].map((part) => part + part).join('') : raw
  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
    a: expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1,
  }
}

function rgbToHsl({ r, g, b }) {
  const rr = r / 255
  const gg = g / 255
  const bb = b / 255
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const lightness = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: lightness }
  const delta = max - min
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  let hue
  if (max === rr) hue = ((gg - bb) / delta + (gg < bb ? 6 : 0)) / 6
  else if (max === gg) hue = ((bb - rr) / delta + 2) / 6
  else hue = ((rr - gg) / delta + 4) / 6
  return { h: hue * 360, s: saturation, l: lightness }
}

function distance(color, target) {
  return Math.hypot(color.r - target.r, color.g - target.g, color.b - target.b)
}

function declarationProperty(source, offset) {
  const boundary = Math.max(
    source.lastIndexOf(';', offset),
    source.lastIndexOf('{', offset),
    source.lastIndexOf('}', offset),
  )
  const fragment = source.slice(boundary + 1, offset)
  return fragment.match(/([\w-]+)\s*:\s*[^:;{}]*$/)?.[1]?.toLowerCase() || ''
}

function insideComment(source, offset) {
  return source.lastIndexOf('/*', offset) > source.lastIndexOf('*/', offset)
}

function chooseNeutral(lightness, property) {
  const textLike = /^(?:color|fill|stroke|stop-color|caret-color)$/.test(property)
  const borderLike = /(?:border|outline|column-rule)/.test(property)
  const shadowLike = /shadow/.test(property)
  if (shadowLike && lightness < 0.8) return TOKENS.brandInk
  if (lightness >= 0.985) return textLike ? TOKENS.textInverse : TOKENS.surfacePage
  if (lightness >= 0.965) return TOKENS.surfacePanel
  if (lightness >= 0.935) return TOKENS.surfaceSubtle
  if (lightness >= 0.9) return borderLike ? TOKENS.borderSubtle : TOKENS.surfaceMuted
  if (lightness >= 0.83) return TOKENS.borderDefault
  if (lightness >= 0.72) return TOKENS.borderStrong
  if (lightness >= 0.57) return TOKENS.textFaint
  if (lightness >= 0.42) return TOKENS.textMuted
  if (lightness >= 0.28) return TOKENS.textSecondary
  if (lightness >= 0.14) return TOKENS.textPrimary
  return TOKENS.brandInk
}

function chooseToken(color, property) {
  const hsl = rgbToHsl(color)

  if (distance(color, { r: 23, g: 37, b: 53 }) < 12) return TOKENS.brandInk
  if (distance(color, { r: 244, g: 239, b: 231 }) < 8) return TOKENS.brandPaper
  if (distance(color, { r: 240, g: 93, b: 78 }) < 35) return TOKENS.brandSignal
  if (distance(color, { r: 39, g: 120, b: 106 }) < 28) return TOKENS.action

  if (hsl.s < 0.16) return chooseNeutral(hsl.l, property)

  if (hsl.h >= 105 && hsl.h < 190) {
    if (hsl.l >= 0.94) return TOKENS.actionSubtle
    if (hsl.l >= 0.84) return TOKENS.actionSoft
    if (hsl.l >= 0.68) return TOKENS.successBorder
    if (hsl.l >= 0.46) return TOKENS.success
    if (hsl.l >= 0.35) return TOKENS.action
    if (hsl.l >= 0.27) return TOKENS.actionHover
    return TOKENS.actionPressed
  }

  if (hsl.h < 20 || hsl.h >= 340) {
    if (hsl.l >= 0.93) return TOKENS.dangerSoft
    if (hsl.l >= 0.74) return TOKENS.dangerBorder
    if (hsl.s >= 0.66 && hsl.l >= 0.45) return TOKENS.brandSignal
    return TOKENS.danger
  }

  if (hsl.h < 90) {
    if (hsl.l >= 0.92) return TOKENS.warningSoft
    if (hsl.l >= 0.7) return TOKENS.warningBorder
    return TOKENS.warning
  }

  if (hsl.l >= 0.92) return TOKENS.infoSoft
  if (hsl.l >= 0.7) return TOKENS.infoBorder
  return TOKENS.info
}

function alphaPercent(alpha) {
  return Number((alpha * 100).toFixed(2)).toString()
}

function tokenValue(token, alpha) {
  if (alpha <= 0) return 'transparent'
  if (alpha >= 0.995) return `var(${token})`
  return `color-mix(in srgb, var(${token}) ${alphaPercent(alpha)}%, transparent)`
}

function migrateSource(source, stats) {
  const replaceHex = source.replace(HEX, (value, offset) => {
    if (insideComment(source, offset)) return value
    const color = parseHex(value)
    const token = chooseToken(color, declarationProperty(source, offset))
    stats.set(token, (stats.get(token) || 0) + 1)
    return tokenValue(token, color.a)
  })

  return replaceHex.replace(RGB, (value, r, g, b, a, offset) => {
    if (insideComment(replaceHex, offset)) return value
    const color = { r: Number(r), g: Number(g), b: Number(b), a: a === undefined ? 1 : Number(a) }
    const token = chooseToken(color, declarationProperty(replaceHex, offset))
    stats.set(token, (stats.get(token) || 0) + 1)
    return tokenValue(token, color.a)
  })
}

const stats = new Map()
let changedFiles = 0
for (const file of cssFiles()) {
  if (path.normalize(file) === path.normalize(palettePath)) continue
  const source = fs.readFileSync(file, 'utf8')
  const migrated = migrateSource(source, stats)
  if (migrated === source) continue
  changedFiles += 1
  if (write) fs.writeFileSync(file, migrated)
}

const total = [...stats.values()].reduce((sum, count) => sum + count, 0)
console.log(`${write ? 'migrated' : 'would migrate'} ${total} color literals across ${changedFiles} CSS files`)
for (const [token, count] of [...stats].sort((a, b) => b[1] - a[1])) {
  console.log(`${String(count).padStart(5)} ${token}`)
}


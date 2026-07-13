/**
 * note window P0 polish — icons / meta / toast
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

describe('note-polish', () => {
  const noteHtml = fs.readFileSync(path.join(__dirname, '..', 'src', 'note.html'), 'utf8');
  const icons = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui-icons.js'), 'utf8');

  it('has toast and segmented mode markup', () => {
    assert.ok(noteHtml.includes('toast-wrap'), 'toast container');
    assert.ok(noteHtml.includes('mode-seg'), 'segmented editor mode');
    assert.ok(noteHtml.includes('tool-ghost'), 'ghost action buttons');
    assert.ok(noteHtml.includes('ver-hist'), 'version history beside badge');
    assert.ok(!noteHtml.includes('tool-btn'), 'old pill tool buttons removed');
  });

  it('uses Cursor/Codicon icon style', () => {
    assert.ok(icons.includes('stroke-width="1.5"'), 'codicon stroke weight');
    assert.ok(icons.includes('panelRight:'), 'cursor panel icons');
    assert.ok(icons.includes('M8 1.8c-2.15'), 'map-pin style pin');
    assert.ok(icons.includes("chat:\n      '<path d=\"M2.4") || icons.includes('chat:\n      \'<path d="M2.4'), 'chat outline path');
    assert.ok(icons.includes('d="M2.4 3.4h11.2'), 'outline chat bubble');
    assert.ok(noteHtml.includes('ui-icons.js?v='), 'cache-busted icon script');
    assert.ok(noteHtml.includes('stroke-width:1.5'), 'note css matches codicon stroke');
    assert.ok(/\.btn-copy-primary\s*\{[^}]*background:transparent/s.test(noteHtml), 'copy is outline button');
  });

  it('uses toast instead of alert for promote/suggest', () => {
    assert.ok(!/alert\(/.test(noteHtml), 'no alert()');
    assert.ok(noteHtml.includes('function toast('), 'toast helper');
    assert.ok(noteHtml.includes('THEME_LABELS'), 'category chinese labels');
  });

  it('defaults to large note size without expand toggle', () => {
    assert.ok(!noteHtml.includes('btnExpand'), 'expand button removed');
    assert.ok(!noteHtml.includes('toggleExpand'), 'no expand toggle API usage');
    const main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
    assert.ok(main.includes('note:    { w: 440, h: 580 }') || main.includes('w: 440, h: 580'), 'default large size');
    assert.ok(!main.includes('note-toggle-expand'), 'expand IPC removed');
  });

  it('has compact head with clear labels', () => {
    assert.ok(noteHtml.includes('head-block'), 'compact head block');
    assert.ok(noteHtml.includes('meta-label'), 'field labels for theme/tags');
    assert.ok(noteHtml.includes('>全文<') || noteHtml.includes('>全文</'), 'mode: 全文');
    assert.ok(noteHtml.includes('>分段<') || noteHtml.includes('>分段</'), 'mode: 分段');
    assert.ok(noteHtml.includes('收入库'), 'promote label simplified');
    assert.ok(noteHtml.includes('智能分类'), 'suggest label simplified');
    assert.ok(noteHtml.includes('打开侧栏对话'), 'ai toggle hint plain');
  });
});

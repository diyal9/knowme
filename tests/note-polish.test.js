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

  it('has toast and plain/md mode markup', () => {
    assert.ok(noteHtml.includes('toast-wrap'), 'toast container');
    assert.ok(noteHtml.includes('mode-seg'), 'view mode segment');
    assert.ok(
      noteHtml.includes('id="modePlain"') &&
      noteHtml.includes('id="modeMd"') &&
      noteHtml.includes('id="modeMdPreview"'),
      'plain/md/preview toggle'
    );
    assert.ok(noteHtml.includes('foot-tools') && noteHtml.includes('foot-tool'), 'compact footer tools');
    assert.ok(noteHtml.includes('id="btnVersions"'), 'version history in footer tools');
    assert.ok(!noteHtml.includes('tool-btn'), 'old pill tool buttons removed');
  });

  it('uses Cursor/Codicon icon style', () => {
    assert.ok(icons.includes('stroke-width="1.5"'), 'codicon stroke weight');
    assert.ok(icons.includes('panelRight:'), 'cursor panel icons');
    assert.ok(icons.includes('M4.1 1.082'), 'codicon thumbtack pin');
    assert.ok(icons.includes('M1 4.5C1 3.11929'), 'codicon comment bubble');
    assert.ok(icons.includes('fill="currentColor" stroke="none"'), 'codicon filled icons');
    assert.ok(noteHtml.includes('ui-icons.js?v='), 'cache-busted icon script');
    assert.ok(noteHtml.includes('stroke-width:1.5'), 'note css matches codicon stroke');
    assert.ok(/\.foot-action\s*\{[^}]*background:transparent/s.test(noteHtml), 'footer actions are outline buttons');
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
    assert.ok(noteHtml.includes('文本'), 'mode: 文本');
    assert.ok(noteHtml.includes('预览'), 'mode: 预览');
    assert.ok(noteHtml.includes('收入库'), 'promote label simplified');
    assert.ok(noteHtml.includes('智能分类'), 'suggest label simplified');
    assert.ok(noteHtml.includes('打开侧栏对话'), 'ai toggle hint plain');
  });

  it('mode toggle & ai entry live in a single footer row', () => {
    const footer = noteHtml.slice(noteHtml.indexOf('<div class="footer">'), noteHtml.indexOf('</section>'));
    assert.ok(footer.includes('mode-seg'), 'mode segment in footer');
    assert.ok(
      footer.includes('id="modePlain"') &&
      footer.includes('id="modeMd"') &&
      footer.includes('id="modeMdPreview"'),
      'plain/md/preview in footer'
    );
    assert.ok(footer.includes('id="aiToggle"'), 'ai toggle merged into footer');
    assert.ok(footer.includes('id="btnCopy"'), 'copy stays in footer');
    const head = noteHtml.slice(noteHtml.indexOf('<div class="head-block">'), noteHtml.indexOf('<div class="editor-wrap"'));
    assert.ok(!head.includes('mode-seg'), 'mode-seg no longer in head');
  });

  it('AI pane uses cursor-like composer with custom menus', () => {
    const foot = noteHtml.slice(noteHtml.indexOf('class="ai-pane-foot"'), noteHtml.indexOf('class="editor-pane"'));
    assert.ok(foot.includes('id="aiComposer"'), 'single-line composer wrapper');
    assert.ok(foot.includes('ai-composer-shell'), 'cursor-style unified composer shell');
    assert.ok(foot.includes('id="aiQuickBtn"'), 'quick action trigger');
    assert.ok(foot.includes('id="aiQuickMenu"'), 'custom quick action menu');
    assert.ok(foot.includes('id="aiMoreBtn"') && foot.includes('id="aiMoreMenu"'), 'more actions menu');
    assert.ok(foot.includes('id="aiClearChat"'), 'clear chat button');
    assert.ok(noteHtml.includes('hideAiMenus('), 'menu close helper');
    assert.ok(noteHtml.includes('aiQuickMenu.addEventListener'), 'quick menu click handler');
    assert.ok(noteHtml.includes('let quickActive = 0'), 'quick menu keyboard index');
    assert.ok(noteHtml.includes("if (e.key === 'ArrowDown')"), 'quick menu arrow-down');
    assert.ok(noteHtml.includes("if (e.key === 'ArrowUp')"), 'quick menu arrow-up');
    assert.ok(noteHtml.includes('function clearChat('), 'clearChat helper');
    assert.ok(noteHtml.includes('.chat-act.subtle:hover'), 'message action hover polish');
  });
});

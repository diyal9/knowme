/**
 * list-home v0.3 — 总览主题轨 / 标签展示冒烟
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

describe('list-home v0.3', () => {
  const listHtml = fs.readFileSync(path.join(__dirname, '..', 'src', 'list.html'), 'utf8');

  it('has theme rail and tag chips markup', () => {
    assert.ok(listHtml.includes('themeRail'), 'theme rail container');
    assert.ok(listHtml.includes('chip-tag'), 'tag chip class');
    assert.ok(listHtml.includes('chip-cat'), 'category chip class');
    assert.ok(listHtml.includes('未分类'), 'uncategorized bucket');
  });

  it('uses compact single-line preview', () => {
    assert.ok(listHtml.includes('row-foot'), 'time+preview footer row');
    assert.ok(listHtml.includes('btn-primary'), 'primary new button');
    assert.ok(listHtml.includes('rail-foot'), 'rail footer for classify');
    assert.ok(listHtml.includes('data-icon="classify"'), 'classify icon button in rail');
    assert.ok(listHtml.includes('overflow-x:hidden'), 'no horizontal rail scrollbar');
    assert.ok(listHtml.includes('data-fav'), 'clickable favorite star');
    assert.ok(listHtml.includes('THEME_LABELS'), 'theme chinese labels');
    assert.ok(listHtml.includes('data-icon="star"'), 'svg favorite star');
    assert.ok(listHtml.includes('stroke-width:1.5'), 'codicon stroke on list');
    assert.ok(listHtml.includes('chip-more') || listHtml.includes('maxTags'), 'tag chip limit');
    assert.ok(listHtml.includes('chip-cat{color:var(--text2)'), 'category chip muted gray');
  });

  it('has project submenu and version collapse', () => {
    assert.ok(listHtml.includes('rail-sub'), 'sidebar project submenu');
    assert.ok(listHtml.includes('groupKeyOf'), 'project/version group key');
    assert.ok(listHtml.includes('projectKey'), 'selected project filter');
    assert.ok(listHtml.includes('row-ver-count'), 'N versions badge');
    assert.ok(listHtml.includes('data-open-group'), 'expand group from badge');
    assert.ok(listHtml.includes('data-project'), 'rail sub project click');
  });

  it('has list-only context menu wiring', () => {
    assert.ok(listHtml.includes('showListContextMenu'), 'list context menu API');
    assert.ok(listHtml.includes('contextmenu'), 'row right-click handler');
    assert.ok(listHtml.includes('data-group-key'), 'group meta for multi-version menu');
    assert.ok(listHtml.includes('onListOpenGroup'), 'open group from menu');
    assert.ok(!listHtml.includes('复制全文'), 'no note-window copy-all in list');
    assert.ok(!listHtml.includes('收录到知识库'), 'no OKF promote in list menu UI');
  });

  it('preload exposes list context menu', () => {
    const preload = fs.readFileSync(path.join(__dirname, '..', 'src', 'preload.js'), 'utf8');
    assert.ok(preload.includes('showListContextMenu'));
    assert.ok(preload.includes('onListOpenGroup'));
    assert.ok(preload.includes('show-list-context-menu'));
  });
});

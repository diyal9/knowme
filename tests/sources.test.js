'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sources = require('../src/lib/sources');
const gitlab = require('../src/lib/gitlab-source');

describe('sources path safety', () => {
  it('rejects path traversal', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-src-'));
    assert.equal(sources.resolveUnderRoot(root, '../outside.txt'), null);
    assert.equal(sources.resolveUnderRoot(root, 'a/../../x'), null);
    assert.ok(sources.resolveUnderRoot(root, 'a/b.md'));
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('read/write under root', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-src-'));
    const w = sources.writeFileUnder(root, 'notes/hello.md', '# hi');
    assert.equal(w.ok, true);
    const r = sources.readFileUnder(root, 'notes/hello.md');
    assert.equal(r.ok, true);
    assert.equal(r.content, '# hi');
    const bad = sources.readFileUnder(root, '../hello.md');
    assert.equal(bad.ok, false);
    fs.rmSync(root, { recursive: true, force: true });
  });
});

describe('sources store', () => {
  it('add local and list tree', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-src-'));
    fs.writeFileSync(path.join(root, 'a.md'), 'x');
    fs.mkdirSync(path.join(root, 'node_modules'));
    fs.writeFileSync(path.join(root, 'node_modules', 'x.js'), '1');
    const file = path.join(root, 'sources.json');
    let store = sources.loadStore(file);
    const add = sources.addLocal(store, root, 'Demo');
    assert.equal(add.ok, true);
    store = sources.saveStore(file, add.store);
    assert.equal(store.sources.length, 1);
    assert.equal(store.sources[0].type, 'local');
    const tree = sources.listTree(root);
    assert.equal(tree.ok, true);
    assert.ok(tree.nodes.some((n) => n.path === 'a.md'));
    assert.ok(!tree.nodes.some((n) => n.path.includes('node_modules')));
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('shallow list and children preserve siblings', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-src-'));
    fs.mkdirSync(path.join(root, 'alpha', 'deep', 'nest'), { recursive: true });
    fs.mkdirSync(path.join(root, 'beta'));
    fs.writeFileSync(path.join(root, 'alpha', 'deep', 'nest', 'a.md'), '1');
    fs.writeFileSync(path.join(root, 'beta', 'b.md'), '2');
    fs.writeFileSync(path.join(root, 'root.md'), '3');
    const shallow = sources.listTree(root, { maxDepth: 0 });
    assert.equal(shallow.ok, true);
    assert.equal(shallow.lazy, true);
    assert.deepEqual(
      shallow.nodes.map((n) => n.path).sort(),
      ['alpha', 'beta', 'root.md'].sort()
    );
    const kids = sources.listChildren(root, 'alpha');
    assert.equal(kids.ok, true);
    assert.ok(kids.nodes.some((n) => n.path === 'alpha/deep'));
    assert.ok(!kids.nodes.some((n) => n.path.includes('nest')));
    assert.equal(sources.listChildren(root, '../outside').ok, false);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('encode/decode fs id', () => {
    const id = sources.encodeFsId('src_1', 'docs/a.md');
    assert.deepEqual(sources.decodeFsId(id), { sourceId: 'src_1', relPath: 'docs/a.md' });
    assert.equal(sources.decodeFsId('n_123'), null);
  });

  it('supports github and web source records', () => {
    const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-gh-'));
    const webRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-web-'));
    let store = { sources: [], activeSourceId: null };
    const gh = sources.addGithub(store, {
      rootPath: repoRoot,
      remoteUrl: 'https://github.com/acme/demo.git',
      ownerRepo: 'acme/demo',
      branch: 'main',
    });
    assert.equal(gh.ok, true);
    store = gh.store;
    const web = sources.addWeb(store, {
      rootPath: webRoot,
      pageUrl: 'https://example.com/article',
      title: '示例网页',
    });
    assert.equal(web.ok, true);
    const saved = sources.saveStore(path.join(repoRoot, 'sources.json'), web.store);
    assert.deepEqual(saved.sources.map(item => item.type), ['github', 'web']);
    fs.rmSync(repoRoot, { recursive: true, force: true });
    fs.rmSync(webRoot, { recursive: true, force: true });
  });
});

describe('web-source helpers', () => {
  it('extracts readable text from html snapshots', async () => {
    const webSource = require('../src/lib/web-source');
    const root = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'knowme-web-'));
    try {
      const snapshot = await webSource.fetchPageSnapshot({
        userData: root,
        pageUrl: 'https://example.com/article',
        lookup: async () => [{ address: '93.184.216.34', family: 4 }],
        fetchImpl: async () => new Response(
          '<html><head><title>Demo Page</title></head><body><p>Hello <b>world</b></p></body></html>',
          { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } },
        ),
      });
      assert.equal(snapshot.ok, true);
      assert.equal(snapshot.title, 'Demo Page');
      const content = require('fs').readFileSync(require('path').join(snapshot.rootPath, 'index.md'), 'utf8');
      assert.match(content, /Hello\s+world/);
      assert.match(content, /Demo Page/);
    } finally {
      require('fs').rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('gitlab-source helpers', () => {
  it('builds remote url', () => {
    assert.equal(
      gitlab.buildRemoteUrl('https://gitlab.com', 'group/proj'),
      'https://gitlab.com/group/proj.git'
    );
    assert.equal(gitlab.normalizeHost('gitlab.com'), 'https://gitlab.com');
  });

  it('builds stable cache paths for remote repos', () => {
    const root = gitlab.repoCacheDirForRemote(os.tmpdir(), 'https://github.com/acme/demo.git');
    assert.ok(root.includes('github.com'));
    assert.ok(root.includes('acme_demo'));
  });
});

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const webFetch = require('../src/lib/web-fetch');
const agentWebTools = require('../src/lib/agent-web-tools');

/** 让 assertSafeUrl 走确定的解析结果，避免单测依赖真实 DNS。 */
function stubLookup(address, family = 4) {
  return async () => [{ address, family }];
}

const publicLookup = stubLookup('93.184.216.34');

describe('web-fetch address classification', () => {
  it('blocks loopback and private IPv4 ranges', () => {
    const blocked = [
      '0.0.0.0', '10.0.0.5', '100.64.0.1', '127.0.0.1', '127.1.2.3',
      '169.254.169.254', '172.16.0.1', '172.31.255.254', '192.0.0.1',
      '192.168.1.1', '198.18.0.1', '224.0.0.1', '240.0.0.1',
    ];
    for (const ip of blocked) {
      assert.equal(webFetch.isBlockedAddress(ip), true, `${ip} should be blocked`);
    }
  });

  it('allows ordinary public IPv4 addresses', () => {
    for (const ip of ['93.184.216.34', '8.8.8.8', '1.1.1.1', '172.32.0.1', '11.0.0.1']) {
      assert.equal(webFetch.isBlockedAddress(ip), false, `${ip} should be allowed`);
    }
  });

  it('blocks IPv6 loopback, unique-local and link-local', () => {
    for (const ip of ['::', '::1', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1']) {
      assert.equal(webFetch.isBlockedAddress(ip), true, `${ip} should be blocked`);
    }
  });

  it('unwraps IPv4-mapped IPv6 before judging', () => {
    assert.equal(webFetch.isBlockedAddress('::ffff:127.0.0.1'), true);
    assert.equal(webFetch.isBlockedAddress('::ffff:192.168.0.1'), true);
    assert.equal(webFetch.isBlockedAddress('::ffff:93.184.216.34'), false);
  });

  it('allows public IPv6', () => {
    assert.equal(webFetch.isBlockedAddress('2001:db8::1'), false);
    assert.equal(webFetch.isBlockedAddress('2606:4700:4700::1111'), false);
  });

  it('treats non-IP input as unsafe', () => {
    assert.equal(webFetch.isBlockedAddress('not-an-ip'), true);
    assert.equal(webFetch.isBlockedAddress(''), true);
  });
});

describe('web-fetch assertSafeUrl', () => {
  it('rejects non-http schemes', async () => {
    for (const url of ['file:///etc/passwd', 'ftp://example.com/x', 'data:text/html,hi']) {
      const result = await webFetch.assertSafeUrl(url, { lookup: publicLookup });
      assert.equal(result.ok, false, url);
      assert.equal(result.code, 'unsupported_scheme');
    }
  });

  it('rejects malformed urls', async () => {
    const result = await webFetch.assertSafeUrl('not a url', { lookup: publicLookup });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'invalid_url');
  });

  it('rejects literal loopback and private hosts without any dns call', async () => {
    const lookup = async () => { throw new Error('lookup must not be called'); };
    for (const url of ['http://127.0.0.1:8080/admin', 'http://192.168.1.1', 'http://[::1]/', 'http://localhost:3000']) {
      const result = await webFetch.assertSafeUrl(url, { lookup });
      assert.equal(result.ok, false, url);
      assert.equal(result.code, 'blocked_target');
    }
  });

  it('rejects a public hostname that resolves into a private range', async () => {
    const result = await webFetch.assertSafeUrl('https://evil.example.com/x', {
      lookup: stubLookup('127.0.0.1'),
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'blocked_target');
  });

  it('rejects when any resolved address is private', async () => {
    const result = await webFetch.assertSafeUrl('https://mixed.example.com/x', {
      lookup: async () => [
        { address: '93.184.216.34', family: 4 },
        { address: '10.1.2.3', family: 4 },
      ],
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'blocked_target');
  });

  it('reports unresolvable hostnames as network errors', async () => {
    const result = await webFetch.assertSafeUrl('https://nope.invalid/x', {
      lookup: async () => { throw new Error('ENOTFOUND'); },
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'network_error');
  });

  it('accepts a normal public url', async () => {
    const result = await webFetch.assertSafeUrl('https://example.com/article?a=1', {
      lookup: publicLookup,
    });
    assert.equal(result.ok, true);
    assert.equal(result.url.hostname, 'example.com');
  });
});

describe('web-fetch extractReadableText', () => {
  it('drops chrome elements and keeps article body', () => {
    const html = `<html><head><title>T</title><style>.a{color:red}</style></head>
      <body>
        <nav><a href="/">Home</a><a href="/blog">Blog</a></nav>
        <header>Site header</header>
        <article><h2>Section One</h2><p>First paragraph.</p>
          <ul><li>Alpha</li><li>Beta</li></ul></article>
        <aside>Related links</aside>
        <script>window.x = 1</script>
        <footer>Copyright 2026</footer>
      </body></html>`;
    const text = webFetch.extractReadableText(html);
    assert.match(text, /## Section One/);
    assert.match(text, /First paragraph\./);
    assert.match(text, /- Alpha/);
    assert.match(text, /- Beta/);
    assert.doesNotMatch(text, /Home/);
    assert.doesNotMatch(text, /Site header/);
    assert.doesNotMatch(text, /Related links/);
    assert.doesNotMatch(text, /Copyright/);
    assert.doesNotMatch(text, /window\.x/);
    assert.doesNotMatch(text, /color:red/);
  });

  it('decodes entities and strips comments', () => {
    const text = webFetch.extractReadableText('<p>A &amp; B &lt;tag&gt; &#39;q&#39;</p><!-- hidden -->');
    assert.match(text, /A & B <tag> 'q'/);
    assert.doesNotMatch(text, /hidden/);
  });

  it('decodes hex character references', () => {
    const text = webFetch.extractReadableText('<p>Here&#x27;s a &#x2014; dash and &#x4E2D;&#x6587;</p>');
    assert.match(text, /Here's a — dash and 中文/);
    assert.doesNotMatch(text, /&#x/);
  });

  it('extracts the document title', () => {
    assert.equal(webFetch.extractTitle('<title>Hello &amp; Bye</title>', 'u'), 'Hello & Bye');
    assert.equal(webFetch.extractTitle('<html></html>', 'https://x/y'), 'https://x/y');
  });
});

describe('web-fetch fetchReadablePage against a local server', () => {
  let server;
  let origin;

  before(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/article') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end('<html><head><title>Harness Design</title></head><body><nav>skip me</nav><p>Long running agents need a harness.</p></body></html>');
        return;
      }
      if (req.url === '/redirect-private') {
        res.writeHead(302, { location: 'http://127.0.0.1:9/secret' });
        res.end();
        return;
      }
      if (req.url === '/redirect-ok') {
        res.writeHead(302, { location: '/article' });
        res.end();
        return;
      }
      if (req.url === '/loop') {
        res.writeHead(302, { location: '/loop' });
        res.end();
        return;
      }
      if (req.url === '/missing') {
        res.writeHead(404, { 'content-type': 'text/html' });
        res.end('<html><body>nope</body></html>');
        return;
      }
      if (req.url === '/paper.pdf') {
        res.writeHead(200, { 'content-type': 'application/pdf' });
        res.end(Buffer.from('%PDF-1.7 binary'));
        return;
      }
      if (req.url === '/huge') {
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('x'.repeat(200000));
        return;
      }
      if (req.url === '/slow') {
        setTimeout(() => {
          res.writeHead(200, { 'content-type': 'text/plain' });
          res.end('too late');
        }, 3000).unref();
        return;
      }
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('plain body');
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://knowme.test:${server.address().port}`;
  });

  after(() => new Promise((resolve) => {
    server.closeAllConnections?.();
    server.close(resolve);
  }));

  // 主机名固定解析到测试服务器，绕开「字面 127.0.0.1 直接拦截」以便验证后续逻辑
  const localLookup = stubLookup('127.0.0.1');
  const allowLocal = async () => [{ address: '93.184.216.34', family: 4 }];

  function fetchViaTestServer(url, init) {
    const rewritten = new URL(url);
    rewritten.hostname = '127.0.0.1';
    return fetch(rewritten.href, init);
  }

  it('fetches and extracts an html page', async () => {
    const page = await webFetch.fetchReadablePage(`${origin}/article`, {
      lookup: allowLocal,
      fetchImpl: fetchViaTestServer,
    });
    assert.equal(page.ok, true);
    assert.equal(page.title, 'Harness Design');
    assert.match(page.text, /Long running agents need a harness\./);
    assert.doesNotMatch(page.text, /skip me/);
    assert.equal(page.truncated, false);
  });

  it('follows a safe redirect', async () => {
    const page = await webFetch.fetchReadablePage(`${origin}/redirect-ok`, {
      lookup: allowLocal,
      fetchImpl: fetchViaTestServer,
    });
    assert.equal(page.ok, true);
    assert.equal(page.title, 'Harness Design');
  });

  it('blocks a redirect that lands on a private address', async () => {
    const page = await webFetch.fetchReadablePage(`${origin}/redirect-private`, {
      lookup: allowLocal,
      fetchImpl: fetchViaTestServer,
    });
    assert.equal(page.ok, false);
    assert.equal(page.code, 'blocked_target');
  });

  it('stops on redirect loops', async () => {
    const page = await webFetch.fetchReadablePage(`${origin}/loop`, {
      lookup: allowLocal,
      fetchImpl: fetchViaTestServer,
      maxRedirects: 3,
    });
    assert.equal(page.ok, false);
    assert.equal(page.code, 'too_many_redirects');
  });

  it('surfaces http error status', async () => {
    const page = await webFetch.fetchReadablePage(`${origin}/missing`, {
      lookup: allowLocal,
      fetchImpl: fetchViaTestServer,
    });
    assert.equal(page.ok, false);
    assert.equal(page.code, 'http_error');
    assert.match(page.message, /404/);
  });

  it('refuses non-text content types', async () => {
    const page = await webFetch.fetchReadablePage(`${origin}/paper.pdf`, {
      lookup: allowLocal,
      fetchImpl: fetchViaTestServer,
    });
    assert.equal(page.ok, false);
    assert.equal(page.code, 'unsupported_content_type');
    assert.match(page.message, /application\/pdf/);
  });

  it('truncates oversized bodies', async () => {
    const page = await webFetch.fetchReadablePage(`${origin}/huge`, {
      lookup: allowLocal,
      fetchImpl: fetchViaTestServer,
      maxBytes: 1024,
    });
    assert.equal(page.ok, true);
    assert.equal(page.truncated, true);
    assert.equal(page.bytes, 1024);
  });

  it('times out slow responses', async () => {
    const page = await webFetch.fetchReadablePage(`${origin}/slow`, {
      lookup: allowLocal,
      fetchImpl: fetchViaTestServer,
      timeoutMs: 300,
    });
    assert.equal(page.ok, false);
    assert.equal(page.code, 'timeout');
  });

  it('still refuses a literal private host even with a permissive lookup', async () => {
    const page = await webFetch.fetchReadablePage(`http://127.0.0.1:${server.address().port}/article`, {
      lookup: localLookup,
      fetchImpl: fetchViaTestServer,
    });
    assert.equal(page.ok, false);
    assert.equal(page.code, 'blocked_target');
  });
});

describe('fetch_web_page agent tool', () => {
  it('exposes a single url parameter and points feishu links elsewhere', () => {
    const def = agentWebTools.FETCH_WEB_PAGE_TOOL.function;
    assert.equal(def.name, 'fetch_web_page');
    assert.deepEqual(def.parameters.required, ['url']);
    assert.equal(def.parameters.additionalProperties, false);
    assert.match(def.description, /feishu\.read_doc/);
  });

  it('formats a successful fetch with title and source', async () => {
    const tools = agentWebTools.buildWebTools({
      lookup: stubLookup('93.184.216.34'),
      fetchImpl: async () => new Response(
        '<html><head><title>Doc</title></head><body><p>Body text.</p></body></html>',
        { status: 200, headers: { 'content-type': 'text/html' } },
      ),
    });
    const result = await tools.handlers.fetch_web_page({ url: 'https://example.com/doc' });
    assert.equal(result.ok, true);
    assert.match(result.text, /标题：Doc/);
    assert.match(result.text, /来源：https:\/\/example\.com\/doc/);
    assert.match(result.text, /Body text\./);
    assert.equal(result.meta.title, 'Doc');
  });

  it('reports failures honestly with a readable reason', async () => {
    const tools = agentWebTools.buildWebTools({ lookup: stubLookup('93.184.216.34') });
    const result = await tools.handlers.fetch_web_page({ url: 'http://127.0.0.1/secret' });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'blocked_target');
    assert.match(result.text, /未能读取该网页/);
    assert.match(result.text, /内网/);
  });
});

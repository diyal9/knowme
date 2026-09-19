'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const asar = require('@electron/asar')

function copyProductionPackage(name, parent, sourceRoot, destination, copied) {
  let directory = parent
  let source
  while (directory !== path.dirname(directory)) {
    const candidate = path.join(directory, 'node_modules', name)
    if (fs.existsSync(path.join(candidate, 'package.json'))) { source = candidate; break }
    directory = path.dirname(directory)
  }
  if (!source || copied.has(source)) return
  const relative = path.relative(sourceRoot, source)
  assert.ok(!relative.startsWith('..') && !path.isAbsolute(relative))
  copied.add(source)
  fs.cpSync(source, path.join(destination, relative), { recursive: true })
  const manifest = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'))
  for (const dependency of Object.keys({ ...manifest.dependencies, ...manifest.optionalDependencies })) {
    copyProductionPackage(dependency, source, sourceRoot, destination, copied)
  }
}

test('sharp production closure loads and decodes through ASAR using the installed Electron Node runtime', async t => {
  const root = path.resolve(__dirname, '..')
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'knowme-image-asar-'))
  const staging = path.join(temporary, 'staging')
  fs.mkdirSync(staging)
  const builder = require('js-yaml').load(fs.readFileSync(path.join(root, 'electron-builder.yml'), 'utf8'))
  assert.equal(builder.asar, true)
  assert.ok(builder.asarUnpack.includes('**/node_modules/sharp/**/*'))
  assert.ok(builder.asarUnpack.includes('**/node_modules/@img/**/*'))
  const copied = new Set()
  copyProductionPackage('sharp', root, root, staging, copied)
  assert.ok(copied.size >= 3)
  fs.copyFileSync(path.join(root, 'src/lib/image-validation.ts'), path.join(staging, 'image-validation.js'))
  fs.writeFileSync(path.join(staging, 'probe.cjs'), `
    const assert = require('node:assert/strict');
    const sharp = require('sharp');
    const { validateImageBytes } = require('./image-validation');
    (async () => {
      for (const format of ['png', 'jpeg', 'gif', 'webp', 'avif']) {
        const bytes = await sharp({create:{width:3,height:2,channels:3,background:'red'}}).toFormat(format).toBuffer();
        assert.equal((await validateImageBytes(bytes, 'image/' + format)).ok, true, format);
      }
      assert.equal((await validateImageBytes(Buffer.from('<html/>'), 'image/png')).ok, false);
      console.log(JSON.stringify({electron:process.versions.electron,node:process.versions.node,napi:process.versions.napi,sharp:sharp.versions.sharp,formats:5}));
    })().catch(error => { console.error(error); process.exitCode=1; });
  `)
  const archive = path.join(temporary, 'app.asar')
  await asar.createPackageWithOptions(staging, archive, { unpack: `{${builder.asarUnpack.join(',')}}` })
  const native = asar.listPackage(archive).filter(file => file.endsWith('.node'))
  assert.ok(native.length > 0)
  for (const file of native) assert.equal(asar.statFile(archive, file.replace(/^[/\\]/, '')).unpacked, true)
  const result = spawnSync(require('electron'), [path.join(archive, 'probe.cjs')], {
    cwd: temporary, windowsHide: true, encoding: 'utf8', timeout: 30000,
    // No app lifecycle, windows, KnowMe bootstrap or userData access.
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_OPTIONS: '', NODE_PATH: '' },
  })
  assert.equal(result.error, undefined, String(result.error))
  assert.equal(result.status, 0, result.stderr || result.stdout)
  const output = JSON.parse(result.stdout.trim())
  assert.ok(output.electron)
  assert.equal(output.formats, 5)
  t.diagnostic(JSON.stringify(output))
})

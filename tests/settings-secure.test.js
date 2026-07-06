/**
 * settings-secure — API Key 存储策略
 */
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');

const MOD_PATH = path.join(__dirname, '..', 'src', 'lib', 'settings-secure.js');
const originalLoad = Module._load;

function mockSafeStorage(available) {
  return {
    isEncryptionAvailable: () => available,
    encryptString: s => Buffer.from(`enc:${s}`, 'utf8'),
    decryptString: buf => {
      const text = (Buffer.isBuffer(buf) ? buf : Buffer.from(buf)).toString('utf8');
      return Buffer.from(text.replace(/^enc:/, ''), 'utf8');
    },
  };
}

function loadSettingsSecure(available) {
  delete require.cache[MOD_PATH];
  Module._load = function (request, parent, isMain) {
    if (request === 'electron') {
      return { safeStorage: mockSafeStorage(available) };
    }
    return originalLoad(request, parent, isMain);
  };
  return require(MOD_PATH);
}

function restoreLoad() {
  Module._load = originalLoad;
  delete require.cache[MOD_PATH];
}

describe('settings-secure', () => {
  let tmpDir;
  let settingsFile;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sticky-settings-'));
    settingsFile = path.join(tmpDir, 'settings.json');
  });

  afterEach(() => {
    restoreLoad();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('encrypts API Key when safeStorage is available', () => {
    const { save, load } = loadSettingsSecure(true);
    const result = save(settingsFile, {
      apiEndpoint: 'https://api.example.com',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      systemPrompt: 'hi',
    });
    assert.equal(result.ok, true);
    assert.equal(result.warning, undefined);
    const raw = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    assert.ok(raw.apiKeyEnc);
    assert.equal(raw.apiKey, undefined);
    assert.equal(load(settingsFile).apiKey, 'sk-test');
    restoreLoad();
  });

  it('does not persist plaintext API Key when safeStorage unavailable', () => {
    const { save } = loadSettingsSecure(false);
    const result = save(settingsFile, {
      apiEndpoint: 'https://api.example.com',
      apiKey: 'sk-secret',
      model: 'gpt-4o-mini',
      systemPrompt: 'hi',
    });
    assert.equal(result.ok, false);
    assert.ok(result.warning);
    const raw = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    assert.equal(raw.apiKey, undefined);
    assert.equal(raw.apiKeyEnc, undefined);
    restoreLoad();
  });

  it('preserves existing encrypted key when saving without new key', () => {
    const mod = loadSettingsSecure(true);
    mod.save(settingsFile, {
      apiEndpoint: 'https://api.example.com',
      apiKey: 'sk-keep',
      model: 'gpt-4o-mini',
      systemPrompt: 'hi',
    });
    restoreLoad();

    const mod2 = loadSettingsSecure(true);
    const result = mod2.save(settingsFile, {
      apiEndpoint: 'https://api.example.com',
      apiKey: '',
      model: 'gpt-4o-mini',
      systemPrompt: 'updated',
    });
    assert.equal(result.ok, true);
    assert.equal(mod2.load(settingsFile).apiKey, 'sk-keep');
    restoreLoad();
  });
});

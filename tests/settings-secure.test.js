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
      userPrompt: 'hi',
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
      userPrompt: 'hi',
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
      userPrompt: 'hi',
    });
    restoreLoad();

    const mod2 = loadSettingsSecure(true);
    const result = mod2.save(settingsFile, {
      apiEndpoint: 'https://api.example.com',
      apiKey: '',
      model: 'gpt-4o-mini',
      userPrompt: 'updated',
    });
    assert.equal(result.ok, true);
    assert.equal(mod2.load(settingsFile).apiKey, 'sk-keep');
    assert.equal(mod2.load(settingsFile).userPrompt, 'updated');
    restoreLoad();
  });

  it('migrates legacy default systemPrompt to empty userPrompt', () => {
    const { LEGACY_DEFAULT_SYSTEM_PROMPT } = require('../src/lib/ai-assistant-context');
    fs.writeFileSync(
      settingsFile,
      JSON.stringify({
        apiEndpoint: 'https://api.example.com',
        model: 'gpt-4o-mini',
        systemPrompt: LEGACY_DEFAULT_SYSTEM_PROMPT,
      }),
      'utf8'
    );
    const { load } = loadSettingsSecure(true);
    const s = load(settingsFile);
    assert.equal(s.userPrompt, '');
    assert.equal(s.systemPrompt, undefined);
    restoreLoad();
  });

  it('migrates custom legacy systemPrompt into userPrompt', () => {
    fs.writeFileSync(
      settingsFile,
      JSON.stringify({
        apiEndpoint: 'https://api.example.com',
        model: 'gpt-4o-mini',
        systemPrompt: '专业领域：提示词工程',
      }),
      'utf8'
    );
    const { load, save } = loadSettingsSecure(true);
    const s = load(settingsFile);
    assert.equal(s.userPrompt, '专业领域：提示词工程');
    save(settingsFile, { ...s, apiKey: '' });
    const raw = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    assert.equal(raw.userPrompt, '专业领域：提示词工程');
    assert.equal(raw.systemPrompt, undefined);
    restoreLoad();
  });

  it('defaults and clamps temperature', () => {
    const { save, load, clampTemperature } = loadSettingsSecure(true);
    assert.equal(clampTemperature(undefined), 0.7);
    assert.equal(clampTemperature(-1), 0);
    assert.equal(clampTemperature(3), 2);
    assert.equal(clampTemperature(1.23), 1.23);
    save(settingsFile, {
      apiEndpoint: 'https://api.example.com',
      apiKey: 'sk-t',
      model: 'gpt-4o-mini',
      userPrompt: '',
      temperature: 1.5,
    });
    assert.equal(load(settingsFile).temperature, 1.5);
    save(settingsFile, {
      ...load(settingsFile),
      apiKey: '',
      temperature: 9,
    });
    assert.equal(load(settingsFile).temperature, 2);
    restoreLoad();
  });

  it('encrypts workbench token and omits plaintext from load()', () => {
    const { save, load, publicSettings } = loadSettingsSecure(true);
    const result = save(settingsFile, {
      apiEndpoint: 'https://api.example.com',
      apiKey: '',
      model: 'gpt-4o-mini',
      userPrompt: '',
      workbenchToken: 'wb_demo_key',
      workbenchAuth: { endpoint: 'http://127.0.0.1:8010', tenantId: 'rdpi' },
    });
    assert.equal(result.ok, true);
    const raw = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    assert.ok(raw.workbenchTokenEnc);
    assert.equal(raw.workbenchToken, undefined);
    const merged = load(settingsFile);
    assert.equal(merged.workbenchToken, 'wb_demo_key');
    assert.equal(merged.workbenchAuth.tenantId, 'rdpi');
    assert.equal(publicSettings(merged).workbenchToken, undefined);
    assert.equal(publicSettings(merged).apiKey, '');
    assert.equal(publicSettings(merged).apiKeyConfigured, false);
    assert.equal(publicSettings(merged, { includeSecrets: true }).apiKey, '');
    restoreLoad();
  });

  it('redacts apiKey by default and keeps secrets when requested', () => {
    const { publicSettings } = loadSettingsSecure(true);
    const view = publicSettings({
      apiKey: 'sk-secret',
      gitlabToken: 'gl-secret',
      model: 'gpt-4o-mini',
    });
    assert.equal(view.apiKey, '');
    assert.equal(view.gitlabToken, '');
    assert.equal(view.apiKeyConfigured, true);
    assert.equal(view.gitlabTokenConfigured, true);
    const full = publicSettings({
      apiKey: 'sk-secret',
      gitlabToken: 'gl-secret',
      model: 'gpt-4o-mini',
    }, { includeSecrets: true });
    assert.equal(full.apiKey, 'sk-secret');
    assert.equal(full.gitlabToken, 'gl-secret');
    restoreLoad();
  });
});

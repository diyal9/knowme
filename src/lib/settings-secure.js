'use strict';

const fs = require('fs');
const { safeStorage } = require('electron');
const { resolveUserPrompt } = require('./ai-assistant-context');

const DEFAULT_SETTINGS = {
  apiEndpoint: 'https://api.openai.com/v1/chat/completions',
  apiKey: '',
  model: 'gpt-4o-mini',
  /** 用户偏好：专业领域、回答风格等；追加到产品固定底座之后 */
  userPrompt: '',
};

function decryptApiKey(raw) {
  if (!raw.apiKeyEnc) return raw.apiKey || '';
  if (!safeStorage.isEncryptionAvailable()) return '';
  try {
    return safeStorage.decryptString(Buffer.from(raw.apiKeyEnc, 'base64')).toString('utf8');
  } catch {
    return '';
  }
}

function load(file) {
  let raw = {};
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    raw = {};
  }
  const apiKey = decryptApiKey(raw);
  const { userPrompt } = resolveUserPrompt(raw);
  const merged = {
    ...DEFAULT_SETTINGS,
    ...raw,
    apiKey,
    userPrompt,
  };
  delete merged.apiKeyEnc;
  delete merged.systemPrompt;
  return merged;
}

function save(file, settings) {
  const out = {
    apiEndpoint: settings.apiEndpoint,
    model: settings.model,
    userPrompt: String(settings.userPrompt != null ? settings.userPrompt : '').trim(),
  };
  const key = (settings.apiKey || '').trim();
  let warning = null;
  if (key && safeStorage.isEncryptionAvailable()) {
    out.apiKeyEnc = safeStorage.encryptString(key).toString('base64');
  } else if (key) {
    warning = '当前系统无法安全加密 API Key，密钥未保存。请在支持系统加密的正式安装版上重试。';
  } else {
    // 保留已有加密 Key（用户未修改 Key 字段时 out 不含 apiKeyEnc，需合并旧文件）
    try {
      const prev = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (prev.apiKeyEnc) out.apiKeyEnc = prev.apiKeyEnc;
    } catch { /* 新文件 */ }
  }
  fs.writeFileSync(file, JSON.stringify(out, null, 2), 'utf8');
  return { ok: !warning, warning };
}

function stripPlaintextApiKey(file) {
  if (!fs.existsSync(file)) return false;
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!raw.apiKey || raw.apiKeyEnc) return false;
    const merged = load(file);
    save(file, merged);
    return true;
  } catch {
    return false;
  }
}

module.exports = { DEFAULT_SETTINGS, load, save, stripPlaintextApiKey };

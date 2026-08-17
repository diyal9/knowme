'use strict';

const fs = require('fs');
const { safeStorage } = require('electron');
const { resolveUserPrompt } = require('./ai-assistant-context');
const { normalizeRemoteConfig } = require('./remote-config-merge');
const { normalizeWorkbenchAuth, DEFAULT_WORKBENCH_AUTH } = require('./workbench-auth');
const { normalizeIndustry, DEFAULT_INDUSTRY } = require('./industry-profile');

const DEFAULT_SETTINGS = {
  apiEndpoint: 'https://api.openai.com/v1/chat/completions',
  apiKey: '',
  model: 'gpt-4o-mini',
  llmProvider: 'custom',
  llmProfile: null,
  /** 用户显式填写的身份、领域与长期背景 */
  userProfile: '',
  /** 结构化行业偏好：影响口吻与缺事实占位示例 */
  industry: DEFAULT_INDUSTRY,
  /** 用户偏好：专业领域、回答风格等；追加到产品固定底座之后 */
  userPrompt: '',
  /** 四种助手模式的可配置要求（soul + 分模式约束） */
  assistantModeConfig: {
    soul: '',
    general: '',
    steward: '',
    writing: '',
    coding: '',
  },
  /** 对话采样温度 0–2；缺省 0.7 */
  temperature: 0.7,
  /** Prompt cache_control 注入开关（默认关闭，按 provider 门控） */
  promptCacheControl: false,
  /** token 估算在线校准（provider:model -> factor/samples） */
  tokenCalibrations: {},
  /** 是否启用向量语义重排（需 embeddings 端点，默认关闭以免额外延迟/成本） */
  semanticRerank: false,
  /** 自定义 embedding 模型 ID；留空则按 provider 推断 */
  embeddingModel: '',
  gitlabHost: '',
  gitlabToken: '',
  /** 组织远程配置（默认关闭） */
  remoteConfig: {
    enabled: false,
    endpoint: 'http://127.0.0.1:8020',
    lastOk: false,
    lastError: '',
    updatedAt: '',
    fetchedAt: '',
  },
  orgManaged: false,
  workbenchAuth: { ...DEFAULT_WORKBENCH_AUTH },
  workbenchInstall: {
    path: '',
    lastBootstrapAt: '',
    lastBootstrapOk: false,
  },
  workbenchToken: '',
};

const LEGACY_ASSISTANT_MODE_PRESET = {
  soul: [
    '回答简洁直接，先给结论再展开。',
    '语气专业克制，不空话，不夸张。',
    '不确定时明确假设与边界，并给验证路径。',
  ].join('\n'),
  general: [
    '目标：帮助用户快速推进当前工作。',
    '输出顺序：先结论，再给 1-3 步可执行动作。',
    '信息不足时：只追问推进任务所必需的关键问题，避免连环提问。',
    '风格：避免过度技术细节，优先清晰、落地。',
  ].join('\n'),
  steward: [
    '目标：优先基于知识与资料给出可靠结论。',
    '输出顺序：结论 → 依据来源 → 适用边界/风险。',
    '若证据不足：明确“缺什么信息”，并给出补齐路径。',
    '禁止：把推测当事实；来源不明时不得下确定性结论。',
  ].join('\n'),
  writing: [
    '目标：生成可直接发送/提交的文本。',
    '默认保持原意，重点优化结构、语气一致性与可执行性。',
    '输出优先：正式版；必要时附简版与可替换措辞。',
    '若用户提供模板或长度要求，必须严格遵循。',
  ].join('\n'),
  coding: [
    '目标：工程化解决问题并控制回归风险。',
    '输出顺序：问题复述 → 根因假设 → 最小改动方案 → 验收清单。',
    '优先给可落地步骤，明确影响范围与边界条件。',
    '涉及风险操作时先提示风险与回滚思路。',
  ].join('\n'),
};

function normalizeWorkbenchInstall(raw) {
  const input = raw && typeof raw === 'object' ? raw : {}
  return {
    path: String(input.path || '').trim().slice(0, 500),
    lastBootstrapAt: String(input.lastBootstrapAt || '').trim(),
    lastBootstrapOk: input.lastBootstrapOk === true,
  }
}

function normalizeAssistantModeConfig(raw) {
  const base = DEFAULT_SETTINGS.assistantModeConfig;
  const input = raw && typeof raw === 'object' ? raw : {};
  const clamp = (v) => String(v == null ? '' : v).trim().slice(0, 2000);
  const dropLegacyPreset = (key, value) => (value === LEGACY_ASSISTANT_MODE_PRESET[key] ? '' : value);
  return {
    soul: dropLegacyPreset('soul', clamp(input.soul != null ? input.soul : base.soul)),
    general: dropLegacyPreset('general', clamp(input.general != null ? input.general : base.general)),
    steward: dropLegacyPreset('steward', clamp(input.steward != null ? input.steward : base.steward)),
    writing: dropLegacyPreset('writing', clamp(input.writing != null ? input.writing : base.writing)),
    coding: dropLegacyPreset('coding', clamp(input.coding != null ? input.coding : base.coding)),
  };
}

function clampTemperature(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.temperature;
  return Math.min(2, Math.max(0, Math.round(n * 100) / 100));
}

const SECRET_KEYS = new Set([
  'apiKey', 'apiKeyEnc', 'gitlabToken', 'gitlabTokenEnc',
  'workbenchToken', 'workbenchTokenEnc', 'systemPrompt',
]);

function decryptField(encB64) {
  if (!encB64) return '';
  if (!safeStorage.isEncryptionAvailable()) return '';
  try {
    return safeStorage.decryptString(Buffer.from(encB64, 'base64')).toString('utf8');
  } catch {
    return '';
  }
}

function encryptField(plain) {
  if (!plain || !safeStorage.isEncryptionAvailable()) return null;
  return safeStorage.encryptString(plain).toString('base64');
}

function decryptApiKey(raw) {
  if (!raw.apiKeyEnc) return raw.apiKey || '';
  return decryptField(raw.apiKeyEnc);
}

function load(file) {
  let raw = {};
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    raw = {};
  }
  const apiKey = decryptApiKey(raw);
  const gitlabToken = raw.gitlabTokenEnc
    ? decryptField(raw.gitlabTokenEnc)
    : (raw.gitlabToken || '');
  const workbenchToken = raw.workbenchTokenEnc
    ? decryptField(raw.workbenchTokenEnc)
    : (raw.workbenchToken || '');
  const { userPrompt } = resolveUserPrompt(raw);
  const merged = {
    ...DEFAULT_SETTINGS,
    ...raw,
    apiKey,
    gitlabToken,
    workbenchToken,
    userPrompt,
    industry: normalizeIndustry(raw.industry != null ? raw.industry : DEFAULT_SETTINGS.industry),
    assistantModeConfig: normalizeAssistantModeConfig(raw.assistantModeConfig),
    llmProvider: String(raw.llmProvider || DEFAULT_SETTINGS.llmProvider),
    llmProfile: raw.llmProfile && typeof raw.llmProfile === 'object' ? raw.llmProfile : null,
    tokenCalibrations: raw.tokenCalibrations && typeof raw.tokenCalibrations === 'object'
      ? raw.tokenCalibrations
      : {},
    temperature: clampTemperature(
      raw.temperature != null ? raw.temperature : DEFAULT_SETTINGS.temperature
    ),
    remoteConfig: normalizeRemoteConfig(raw.remoteConfig),
    orgManaged: raw.orgManaged === true,
    workbenchAuth: normalizeWorkbenchAuth(raw.workbenchAuth),
    workbenchInstall: normalizeWorkbenchInstall(raw.workbenchInstall),
  };
  delete merged.apiKeyEnc;
  delete merged.gitlabTokenEnc;
  delete merged.workbenchTokenEnc;
  delete merged.systemPrompt;
  return merged;
}

/**
 * 供渲染进程 IPC。
 * 默认 redact apiKey/gitlabToken（仅保留 configured 标记）；设置窗传 includeSecrets:true。
 * 始终不含 Workbench 授权码明文。
 */
function publicSettings(settings, { includeSecrets = false } = {}) {
  const out = { ...settings };
  delete out.workbenchToken;
  delete out.workbenchTokenEnc;
  const hasApiKey = !!(String(settings?.apiKey || '').trim());
  const hasGitlabToken = !!(String(settings?.gitlabToken || '').trim());
  out.apiKeyConfigured = hasApiKey;
  out.gitlabTokenConfigured = hasGitlabToken;
  if (!includeSecrets) {
    out.apiKey = '';
    out.gitlabToken = '';
  }
  return out;
}

function save(file, settings) {
  let prev = {};
  try {
    prev = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    prev = {};
  }

  const out = { ...prev };
  for (const [k, v] of Object.entries(settings || {})) {
    if (SECRET_KEYS.has(k)) continue;
    out[k] = v;
  }
  out.apiEndpoint = settings.apiEndpoint;
  out.model = settings.model;
  out.llmProvider = String(settings.llmProvider || 'custom');
  out.llmProfile = settings.llmProfile && typeof settings.llmProfile === 'object'
    ? settings.llmProfile
    : null;
  out.tokenCalibrations = settings.tokenCalibrations && typeof settings.tokenCalibrations === 'object'
    ? settings.tokenCalibrations
    : {};
  out.userPrompt = String(settings.userPrompt != null ? settings.userPrompt : '').trim();
  if (settings.userProfile != null) out.userProfile = String(settings.userProfile || '').trim();
  if (settings.industry != null || out.industry != null) {
    out.industry = normalizeIndustry(
      settings.industry != null ? settings.industry : out.industry
    );
  }
  out.assistantModeConfig = normalizeAssistantModeConfig(settings.assistantModeConfig);
  if (settings.temperature != null) out.temperature = clampTemperature(settings.temperature);
  if (settings.gitlabHost != null) out.gitlabHost = String(settings.gitlabHost || '').trim();
  if (settings.remoteConfig != null) {
    out.remoteConfig = normalizeRemoteConfig(settings.remoteConfig)
  }
  if (settings.orgManaged != null) out.orgManaged = settings.orgManaged === true
  if (settings.workbenchAuth != null) {
    out.workbenchAuth = normalizeWorkbenchAuth(settings.workbenchAuth)
  }
  if (settings.workbenchInstall != null) {
    out.workbenchInstall = normalizeWorkbenchInstall(settings.workbenchInstall)
  }

  let warning = null;
  const key = (settings.apiKey || '').trim();
  if (key && safeStorage.isEncryptionAvailable()) {
    out.apiKeyEnc = encryptField(key);
    delete out.apiKey;
  } else if (key) {
    warning = '当前系统无法安全加密 API Key，密钥未保存。请在支持系统加密的正式安装版上重试。';
  } else if (!out.apiKeyEnc && prev.apiKeyEnc) {
    out.apiKeyEnc = prev.apiKeyEnc;
  }
  delete out.apiKey;

  const gToken = settings.gitlabToken != null ? String(settings.gitlabToken).trim() : null;
  if (gToken === '') {
    delete out.gitlabTokenEnc;
    delete out.gitlabToken;
  } else if (gToken) {
    const enc = encryptField(gToken);
    if (enc) {
      out.gitlabTokenEnc = enc;
      delete out.gitlabToken;
    } else if (!warning) {
      warning = '当前系统无法安全加密 GitLab Token，Token 未保存。';
    }
  } else if (!out.gitlabTokenEnc && prev.gitlabTokenEnc) {
    out.gitlabTokenEnc = prev.gitlabTokenEnc;
  }
  delete out.gitlabToken;

  const wbToken = settings.workbenchToken != null ? String(settings.workbenchToken).trim() : null;
  if (wbToken === '') {
    delete out.workbenchTokenEnc;
    delete out.workbenchToken;
  } else if (wbToken) {
    const enc = encryptField(wbToken);
    if (enc) {
      out.workbenchTokenEnc = enc;
      delete out.workbenchToken;
    } else if (!warning) {
      warning = '当前系统无法安全加密 Workbench 授权码，授权未保存。';
    }
  } else if (!out.workbenchTokenEnc && prev.workbenchTokenEnc) {
    out.workbenchTokenEnc = prev.workbenchTokenEnc;
  }
  delete out.workbenchToken;
  delete out.systemPrompt;

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

module.exports = { DEFAULT_SETTINGS, clampTemperature, load, save, publicSettings, stripPlaintextApiKey };

'use strict';

const SECTION_KEYS = ['role', 'context', 'task', 'output', 'criteria'];
const SECTION_LABELS = {
  role: '角色',
  context: '背景',
  task: '任务',
  output: '输出格式',
  criteria: '成功标准',
};

function emptySections() {
  return { role: '', context: '', task: '', output: '', criteria: '' };
}

function assembleContent(sections) {
  if (!sections) return '';
  const parts = [];
  for (const key of SECTION_KEYS) {
    const val = (sections[key] || '').trim();
    if (val) parts.push(`## ${SECTION_LABELS[key]}\n${val}`);
  }
  return parts.join('\n\n');
}

function parseSectionsFromContent(content) {
  const sections = emptySections();
  const labelToKey = Object.fromEntries(
    Object.entries(SECTION_LABELS).map(([k, v]) => [v, k])
  );
  const text = (content || '').trim();
  if (!text) return sections;

  const blocks = text.split(/^##\s*/m).filter(Boolean);
  for (const block of blocks) {
    const nl = block.indexOf('\n');
    const title = (nl >= 0 ? block.slice(0, nl) : block).trim();
    const body = nl >= 0 ? block.slice(nl + 1).trim() : '';
    const key = labelToKey[title];
    if (key) sections[key] = body;
  }
  return sections;
}

function hasStructuredMarkers(content) {
  return /^##\s*(角色|背景|任务|输出格式|成功标准)/m.test(content || '');
}

function estimateTokens(text) {
  const len = (text || '').length;
  if (!len) return 0;
  return Math.max(1, Math.ceil(len / 3));
}

const NOTE_V2_DEFAULTS = {
  category: '',
  okfTags: [],
  okfConceptId: null,
  parentNoteId: null,
  editorMode: 'free',
  sections: null,
};

function migrateNoteFields(note) {
  let dirty = false;
  for (const [k, v] of Object.entries(NOTE_V2_DEFAULTS)) {
    if (note[k] === undefined) {
      note[k] = Array.isArray(v) ? [] : v;
      dirty = true;
    }
  }
  if (note.editorMode === 'structured' && !note.sections) {
    note.sections = parseSectionsFromContent(note.content);
    dirty = true;
  }
  return dirty;
}

module.exports = {
  SECTION_KEYS,
  SECTION_LABELS,
  emptySections,
  assembleContent,
  parseSectionsFromContent,
  hasStructuredMarkers,
  estimateTokens,
  migrateNoteFields,
  NOTE_V2_DEFAULTS,
};

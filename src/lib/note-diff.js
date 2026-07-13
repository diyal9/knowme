'use strict';

/** Simple line-level diff (LCS backtrack). */
function diffLines(oldText, newText) {
  const o = (oldText || '').split('\n');
  const n = (newText || '').split('\n');
  const m = o.length;
  const p = n.length;
  const dp = Array.from({ length: m + 1 }, () => Array(p + 1).fill(0));

  for (let i = m - 1; i >= 0; i--) {
    for (let j = p - 1; j >= 0; j--) {
      dp[i][j] = o[i] === n[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const hunks = [];
  let i = 0;
  let j = 0;
  while (i < m || j < p) {
    if (i < m && j < p && o[i] === n[j]) {
      hunks.push({ type: 'same', line: o[i] });
      i++;
      j++;
    } else if (j < p && (i >= m || dp[i][j + 1] >= dp[i + 1][j])) {
      hunks.push({ type: 'add', line: n[j] });
      j++;
    } else {
      hunks.push({ type: 'del', line: o[i] });
      i++;
    }
  }
  return hunks;
}

function diffToHtml(hunks) {
  return hunks.map((h) => {
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (h.type === 'same') return `<div class="diff-same">${esc(h.line) || ' '}</div>`;
    if (h.type === 'add') return `<div class="diff-add">+ ${esc(h.line)}</div>`;
    return `<div class="diff-del">- ${esc(h.line)}</div>`;
  }).join('');
}

module.exports = { diffLines, diffToHtml };

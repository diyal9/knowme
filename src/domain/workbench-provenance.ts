/** Workbench 货架来源标签 */

export function shelfProvenanceLabel(source: string): string {
  const value = String(source || '')
  if (value === 'personal' || value === 'forked') return '我的'
  if (value === 'official') return '官方'
  return '共享'
}

module.exports = { shelfProvenanceLabel }

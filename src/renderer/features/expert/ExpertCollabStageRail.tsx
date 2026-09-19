export function expertCollabStatus(status: string, draftHasPlan = false) {
  if (status === 'draft') return draftHasPlan ? '等待确认计划' : '正在理解需求'
  if (status === 'needs_input') return '等待你补充'
  if (status === 'review') return '等待你验收'
  if (status === 'revising') return '专家修改中'
  if (status === 'completed') return '本次协作已完成'
  if (status === 'failed') return '本次执行未完成'
  if (status === 'cancelled') return '本次协作已取消'
  return '专家执行中'
}

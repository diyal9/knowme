export type ExpertInputNeed = {
  kind: 'execution' | 'reroute' | 'capability' | 'information'
  title: string
  detail: string
  item: string
  nextStep: string
  composerPlaceholder: string
  alternative?: string
}

function compactText(value: unknown) {
  return String(value || '')
    .replace(/[`*_#]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanItem(value: string, fallback: string) {
  return compactText(value)
    .replace(/[。；;，,]+$/, '')
    .slice(0, 80) || fallback
}

export function describeExpertInputNeed(summary: unknown, goal: unknown = ''): ExpertInputNeed {
  const text = compactText(summary)
  const taskGoal = compactText(goal)
  const requiredRead = text.match(/(?:缺少必需读取|还缺少可核验结果|工具结果证据不足)\s*[：:]\s*([^。；;]+)/i)
  const internalExecutionBlock = /requiredEvidence|missing_required_evidence|requiredTools|missing_required_tools/i.test(text)

  if (requiredRead || internalExecutionBlock) {
    const item = cleanItem(requiredRead?.[1] || '', '任务所需的读取结果')
    const internalMeeting = /(我的|飞书|会议|妙记|纪要|内部)/.test(taskGoal)
      && !/(公开|全网|互联网|网页|新闻|资讯|行业|市场|官网|媒体)/.test(taskGoal)
    if (/公开网络搜索/.test(item) && internalMeeting) {
      return {
        kind: 'reroute',
        title: '执行路径需要调整',
        detail: '这项任务应读取你的飞书会议，不需要公开网络搜索。',
        item,
        alternative: '飞书会议内容',
        nextStep: '改用已授权的飞书连接器，从当前任务继续。',
        composerPlaceholder: '如需调整，可补充会议范围或指定具体会议… @ 选文件',
      }
    }
    return {
      kind: 'execution',
      title: '需要完成一次读取',
      detail: `不需要补充资料。专家还没有完成「${item}」。`,
      item,
      nextStep: '让专家补做读取；也可以明确要求仅使用现有材料。',
      composerPlaceholder: `如需调整，可输入“仅使用现有材料，不再执行${item}”…`,
    }
  }

  const capabilityMatch = text.match(/(?:未启用|未安装|未授权|缺少)(?:所需的?|必需的?)?\s*(?:能力|技能|连接器)?\s*[：:]?\s*([^。；;]+)/)
  if (capabilityMatch && /(能力|技能|连接器|未启用|未安装|未授权)/.test(text)) {
    const item = cleanItem(capabilityMatch[1], '任务所需能力')
    return {
      kind: 'capability',
      title: '需要启用能力',
      detail: `当前专家缺少「${item}」，启用后可从这里继续。`,
      item,
      nextStep: '前往能力中心完成安装或授权。',
      composerPlaceholder: `也可以说明不使用「${item}」时应如何调整任务…`,
    }
  }

  const item = cleanItem(
    text.replace(/^(?:请|需要你|还需要)(?:补充|提供|确认)\s*/i, ''),
    '任务继续所需的信息',
  )
  return {
    kind: 'information',
    title: '还需要一项信息',
    detail: text || '请补充任务继续所需的材料、范围或选择。',
    item,
    nextStep: '直接在下方输入，或添加相关文件。',
    composerPlaceholder: `请补充：${item}… @ 选文件`,
  }
}

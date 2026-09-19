'use strict'

const http = require('http')

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.setEncoding('utf8')
    req.on('data', chunk => {
      raw += chunk
      if (raw.length > 4 * 1024 * 1024) {
        reject(new Error('fixture request too large'))
        req.destroy()
      }
    })
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}) } catch (error) { reject(error) }
    })
    req.on('error', reject)
  })
}

function textFromMessage(message) {
  const content = message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map(item => item?.text || '').join('\n')
  return ''
}

function lastUserPrompt(messages) {
  const user = [...(Array.isArray(messages) ? messages : [])]
    .reverse()
    .find(message => message?.role === 'user')
  return textFromMessage(user).slice(0, 8000) || 'qualification text fixture'
}

function toolCall(name, args = {}) {
  return {
    id: `text-fixture-${name}-${Date.now()}`,
    type: 'function',
    function: { name, arguments: JSON.stringify(args) },
  }
}

function responseWithToolCall(call) {
  return {
    id: `text-fixture-${Date.now()}`,
    object: 'chat.completion',
    choices: [{
      index: 0,
      message: { role: 'assistant', content: '', tool_calls: [call] },
      finish_reason: 'tool_calls',
    }],
  }
}

function calculationArguments(prompt) {
  if (prompt.includes('搜索访客900') || prompt.includes('展示访客100')) {
    return {
      calculations: [
        { label: '上周总体注册率', expression: '92/1000' },
        { label: '本周总体注册率', expression: '39/1000' },
        { label: '上周搜索注册率', expression: '90/900' },
        { label: '上周展示注册率', expression: '2/100' },
        { label: '本周搜索注册率', expression: '12/100' },
        { label: '本周展示注册率', expression: '27/900' },
      ],
    }
  }
  if (prompt.includes('订单 1200') || prompt.includes('订单1200')) {
    return {
      calculations: [
        { label: '本周失败率', expression: '72/1200' },
        { label: '上周失败率', expression: '40/1000' },
        { label: '原因合计', expression: '40+20+12' },
      ],
    }
  }
  if (prompt.includes('转化率从9%降到6%') || prompt.includes('流量从10000升到18000')) {
    return {
      calculations: [
        { label: '上期估算转化人数', expression: '10000*0.09' },
        { label: '本期估算转化人数', expression: '18000*0.06' },
      ],
    }
  }
  return { calculations: [{ label: '材料内校验', expression: '1' }] }
}

function productCandidate(prompt) {
  if (prompt.includes('用户研究') || prompt.includes('用户反馈')) {
    return [
      '# 用户反馈研究洞察',
      '',
      '## 研究范围与证据边界',
      '- 样本仅 3 条、非随机，不能代表总体，也不能计算总体比例。',
      '- 原始反馈：A「找不到导出入口」；B「导出太慢」但没有时长；C「从未使用导出」。',
      '',
      '## 可观察现象',
      '1. A 直接报告入口可发现性问题，但尚不能判断是导航、权限还是使用场景造成。',
      '2. B 表达了性能感受，缺少开始时间、结束时间和网络环境，不能量化慢的程度。',
      '3. C 只说明该样本未使用，不能推出整体使用率或需求强度。',
      '',
      '## 待验证假设',
      '- H1：导出入口在用户任务路径中不可发现。',
      '- H2：部分用户遇到高延迟或等待反馈不足。',
      '- H3：C 的未使用原因可能是无需求，也可能是入口、权限或认知问题。',
      '',
      '## 最小验证方案',
      '补采 5–8 名目标用户的导出任务观察，记录入口发现路径、权限状态、请求耗时和是否完成；同时读取一段脱敏的真实耗时分布。验证完成前不直接决定改版。',
    ].join('\n')
  }
  if (prompt.includes('冲突规则') || prompt.includes('法务要求') || prompt.includes('企业版次数不限')) {
    return [
      '# 数据导出需求评审结论：阻塞',
      '',
      '## 已确认事实',
      '- 免费版每日最多导出 10 次；企业版次数不限。',
      '- 法务要求所有导出必须经理审批；销售承诺企业版无需审批。',
      '- 导出内容包含个人邮箱。',
      '',
      '## 阻塞决策',
      '法务约束与销售承诺冲突，当前不能把任一口径写成最终规则。需要产品负责人明确：企业版是否豁免经理审批；若豁免，隐私与审计控制由谁承担。该决定会改变流程、权限和验收。',
      '',
      '## 可先确定的框架',
      '- 记录导出主体、工作区、版本和结果，不扩大导出范围。',
      '- 次数口径仍需确认按用户、工作区还是账号计算；时区、成功/失败/取消是否计数也待确认。',
      '- 个人邮箱属于隐私数据，需确认最小化、访问记录和保留期限。',
      '',
      '## 验收边界',
      '可验收免费版 10 次限制、企业版不限的计数口径和隐私提示；审批流程依赖冲突决策，暂不标记为可开发完成。',
    ].join('\n')
  }
  if (prompt.includes('席位') || prompt.includes('成员生命周期')) {
    return [
      '# 团队席位与成员生命周期 PRD',
      '',
      '## 目标与边界',
      '目标是让管理员可控地邀请、移除成员并准确占用席位。活跃率基线和文档后续归属人尚未确定，不在本版补造。',
      '',
      '## 角色与状态',
      '- 管理员：邀请、移除成员；普通成员不能执行管理动作。',
      '- invited：邀请已创建、占用规则待确认；active：接受邀请后可访问；expired：24 小时未接受；removed：立即失去团队访问权。',
      '- 移除不删除历史文档，原作者标识保留；归属人仍待确认。',
      '',
      '## 规则与异常恢复',
      '同一邮箱并发邀请必须幂等，不能重复占用席位。席位已满时创建失败但保留已填写内容；过期后可重新邀请。移除与重新邀请的并发优先级需记录最终状态，不能依赖客户端猜测。',
      '',
      '## 验收示例',
      'WHEN 管理员对未邀请邮箱提交邀请 THEN 创建一条 invited 记录；WHEN 同邮箱并发提交 THEN 只保留一条；WHEN 席位已满 THEN 返回可理解的失败且草稿仍在；WHEN 邀请超过 24 小时 THEN 标记 expired 且不继续授予访问权。',
      '',
      '## 待确认',
      '邀请是否占用席位、时区口径、重新邀请是否复用记录，以及历史文档归属策略。',
    ].join('\n')
  }
  if (prompt.includes('通知') || prompt.includes('排期')) {
    return [
      '# 批量通知排期 PRD',
      '',
      '## 目标、范围与非目标',
      '运营可选择受众并预约发送；本版不扩展邮件渠道和内容编辑能力。通知正文与受众条件必须随任务保存。',
      '',
      '## 状态与规则',
      '草稿 → 待提交 → 已排期 → 发送中 → 已完成/已失败；发送前可取消，发送开始后不可取消。同一排期重复点击只能创建一条任务。',
      '',
      '## 超时与恢复',
      '提交超时进入未知结果，先通过任务查询确认是否已创建，再决定重试；禁止盲目重试。恢复时复用原正文、受众条件和幂等键，不重复统计。',
      '',
      '## 验收',
      'WHEN 同一提交重复到达 THEN 只产生一条任务；WHEN 发送已开始 THEN 取消请求返回不可取消并展示当前状态；WHEN 创建请求超时 THEN 用户可查询最终结果，查询失败时保留草稿和明确下一步。送达率基线待补，不在本版编造。',
    ].join('\n')
  }
  return [
    '# 访客申请功能 PRD',
    '',
    '## 背景与目标',
    '员工需要提交访客姓名和到访时间，前台审批后生成二维码，降低现场核验成本。转化率和办理时长没有基线，指标目标待确认。',
    '',
    '## 范围与非目标',
    '范围：创建申请、审批、二维码生效、使用、取消、过期和异常恢复。不包含技术架构、通知渠道和后台报表实现。',
    '',
    '## 角色与状态',
    '- 员工：创建、查看、取消尚未使用的申请。前台：审批、核验、必要时处理异常。',
    '- 申请中 → 待审批 → 已批准/可使用 → 已使用；也可进入已取消、已过期。审批拒绝应有明确终态。',
    '',
    '## 核心规则',
    '二维码只在已批准且处于有效时间窗时可用；取消与核验并发时以服务端最终状态为准。网络超时不得直接再次创建，用户先查询申请状态。',
    '',
    '## 异常与恢复',
    '重复提交使用同一幂等意图并返回已有申请；审批失败保留原因和下一步；查询不到最终状态时保留输入并提示稍后查询，不把未知写成失败或成功。',
    '',
    '## 验收标准',
    'WHEN 员工提交完整信息 THEN 创建一条申请并进入待审批；WHEN 前台批准 THEN 生成当天有效二维码；WHEN 网络超时 THEN 查询可确认最终结果且重试不重复创建；WHEN 员工取消未使用申请 THEN 后续核验不可使用。',
    '',
    '## 风险与待确认',
    '有效时间窗、审批拒绝通知、指标目标和办理时长基线仍需业务确认；本稿不补造技术实现或业务数据。',
  ].join('\n')
}

function dataCandidate(prompt) {
  if (prompt.includes('搜索访客900') || prompt.includes('展示访客100')) {
    return [
      '# 渠道结构变化与注册率判断',
      '',
      '## 可复算结果',
      '| 周期 | 搜索 | 展示 | 总体 |',
      '|---|---:|---:|---:|',
      '| 上周 | 90/900=10.0% | 2/100=2.0% | 92/1000=9.2% |',
      '| 本周 | 12/100=12.0% | 27/900=3.0% | 39/1000=3.9% |',
      '',
      '渠道互斥且覆盖全部新访客，两周均为完整 7 天；总体下降与渠道结构变化同时发生，但新版落地页上线与下降共现不构成因果证明。',
      '',
      '## 不能下的结论',
      '没有费用、收入、留存或同期对照，不能判断哪个渠道更赚钱，也不能无条件把预算迁移到某渠道。',
      '',
      '## 最小验证',
      '补齐渠道成本、收入/后续质量、用户级同期对照和落地页版本维度；先做受限分层核对，不声称已执行投放。',
    ].join('\n')
  }
  if (prompt.includes('支付成功用户120') || prompt.includes('页面曝光事件1500')) {
    return [
      '# 支付转化判断：口径不可直接比较',
      '',
      '上周是用户级去重指标：120/1000=12%，且观察满 72 小时；本周是事件级未去重指标：90/1500=6%，最长观察仅 24 小时。两者分子、分母、去重和观察窗均不同，不能写成支付转化率下降。',
      '',
      '群消息中的“105”没有来源，标记为未核实，不替换原始 90。',
      '',
      '## 最小补数',
      '统一用户级去重分子/分母、相同 72 小时观察窗，并回溯来源、版本和时间范围；补齐后再比较，当前不证明改版导致变化，也不证明改版安全。',
    ].join('\n')
  }
  if (prompt.includes('采用率 40%') || prompt.includes('采用率40%')) {
    return [
      '# 指标冲突台账',
      '',
      '| 项目 | 结论 | 来源与影响 |',
      '|---|---|---|',
      '| 采用率 | 40% 与 45% 冲突 | B 是对 A 的转述，不是独立来源，不能任意择一 |',
      '| 访谈 | 仅覆盖 8 家 | 不能推广为 300 家总体比例 |',
      '| 明细表 | 无客户唯一 ID | 阻塞去重和总体计算，不能自动补 ID |',
      '',
      '可保留：报表 A 声称 300 家、采用率 40%；访谈 C 的范围和主观判断。未知：45% 是否有独立依据、明细是否重复、时间和定义是否一致。',
      '',
      '核查顺序：读取 A 原文与定义 → 查 B 引用链 → 核对 C 样本 → 补唯一 ID/时间口径后再计算。当前不能制造统一采用率或趋势。',
    ].join('\n')
  }
  if (prompt.includes('订单 1200') || prompt.includes('订单1200')) {
    return [
      '# 订单异常分析',
      '',
      '本周失败率 = 72/1200 = 6%；失败原因 40 + 20 + 12 = 72，合计一致。上周失败率 = 40/1000 = 4%，但上周原因明细缺失，因此原因结构不可比，不能据此归因趋势。',
      '',
      '本周已知原因：超时 40、库存 20；未知 12。服务计算分母曾超时，重试应复用原目标和材料，不能重复统计，也不能把未完成计算写成完成。',
      '',
      '恢复步骤：先核对分析运行状态和订单明细，再确认两周分母口径；补齐上周原因后再做结构比较。本轮未读取后台，也未执行生产修复。',
    ].join('\n')
  }
  if (prompt.includes('转化率从9%降到6%') || prompt.includes('流量从10000升到18000')) {
    return [
      '# 业务指标异常洞察',
      '',
      '## 事实',
      '转化率从 9% 降到 6%，流量从 10,000 增到 18,000。若分母定义一致，可估算转化人数从约 900 变为约 1,080，但这是按百分比乘流量的估算，不是后台实测。',
      '',
      '## 假设与限制',
      '缺少渠道、设备、用户分层、费用和收入，不能判断根因、收益变化或某一渠道责任。',
      '',
      '## 最小验证',
      '按渠道、设备、新老用户拆分同一观察窗的分子分母，核对流量质量和版本变化；在数据补齐前不执行预算或产品改版结论。',
    ].join('\n')
  }
  return [
    '# 数据分析结果',
    '',
    '先列出分子、分母、时间范围、去重口径和来源，再给出可复算计算。事实、推断、假设和未知项分开呈现；缺少维度时不补造原因、收益或显著性。',
    '',
    '当前结论仅覆盖题面材料，未读取后台、未执行外部动作。下一步只提出能改变判断的最小补数和验证方案。',
  ].join('\n')
}

function softwareCandidate(prompt) {
  if (prompt.includes('runPool')) {
    return [
      '# runPool 实现与验证',
      '',
      '```js',
      'function runPool(tasks, limit) {',
      '  if (!Array.isArray(tasks) || !Number.isSafeInteger(limit) || limit <= 0 || !tasks.every(fn => typeof fn === \'function\')) {',
      '    return Promise.reject(new Error(\'INVALID_ARGUMENT\'))',
      '  }',
      '  if (tasks.length === 0) return Promise.resolve([])',
      '  const results = new Array(tasks.length)',
      '  let next = 0; let active = 0; let stopped = false; let settled = false',
      '  return new Promise((resolve, reject) => {',
      '    const launch = () => {',
      '      if (settled) return',
      '      while (!stopped && active < limit && next < tasks.length) {',
      '        const index = next++; active++',
      '        Promise.resolve().then(() => tasks[index]()).then(value => {',
      '          active--; results[index] = value',
      '          if (next === tasks.length && active === 0) { settled = true; resolve(results) } else launch()',
      '        }, error => {',
      '          active--; if (!stopped) { stopped = true; settled = true; reject(error) }',
      '        })',
      '      }',
      '    }; launch()',
      '  })',
      '}',
      '```',
      '',
      '峰值并发不超过 limit，每个任务只从 next 取一次，结果按输入索引写回。失败后不再补位，已启动任务的拒绝被消费。测试应覆盖乱序完成、同步抛错、异步拒绝、失败后不启动新任务和空数组。本稿只给设计，未真实运行。',
    ].join('\n')
  }
  if (prompt.includes('createLoader') || prompt.includes('单飞缓存')) {
    return [
      '# TTL 单飞缓存方案',
      '',
      '实现必须为每个 key 独立维护 cache、inFlight 和 generation。命中不能用 truthy 判断，undefined 也是合法值；TTL 从成功完成时计算。同步抛错和异步拒绝清理 inFlight 且不写 cache。',
      '',
      '失效时递增 generation；请求完成时仅当 generation 与请求开始时一致，且仍是当前 inFlight，才允许写入。finally 同样做身份检查，避免旧请求删除新请求。',
      '',
      '定向测试：同 key 单飞、不同 key 隔离、undefined 命中、成功后 TTL、拒绝不缓存、invalidate 后旧请求晚到、旧 finally 不误删新请求，以及不暴露内部 Map。复杂度为每次访问 O(1) 均摊。本稿未真实运行。',
    ].join('\n')
  }
  if (prompt.includes('retry(operation') || prompt.includes('指数退避')) {
    return [
      '# retry 实现边界',
      '',
      '总尝试次数为 attempts，attempt 从 1 开始；每次失败后仅在还有下一次尝试时 sleep(baseDelayMs * 2 ** (attempt - 1))。最后一次失败不 sleep。',
      '',
      'operation 和 sleep 的同步抛错都统一进入失败路径；AbortSignal 已取消、期间取消和 AbortError 立即以 signal.reason 或 Error(\'ABORTED\') 结束，不再重试。计算 delay 前检查安全整数和溢出，失败时抛 INVALID_DELAY。',
      '',
      '测试覆盖成功、耗尽、sleep 失败、预取消、执行中取消、AbortError 和溢出；本稿是设计与实现说明，未真实运行。',
    ].join('\n')
  }
  if (prompt.includes('parsePositiveInt')) {
    return [
      '# parsePositiveInt 完整替换实现',
      '',
      '```js',
      'function parsePositiveInt(value) {',
      '  if (typeof value === \'number\') {',
      '    if (Number.isSafeInteger(value) && value > 0) return value',
      '  } else if (typeof value === \'string\' && /^[ ]*[1-9][0-9]*[ ]*$/.test(value)) {',
      '    const parsed = Number(value.trim())',
      '    if (Number.isSafeInteger(parsed) && parsed > 0) return parsed',
      '  }',
      '  throw new Error(\'INVALID_POSITIVE_INT\')',
      '}',
      '```',
      '',
      '只允许首尾 ASCII 空格和规范十进制正整数；拒绝 +1、01、1.0、全角数字及 Unicode 空白。测试覆盖原有 number 合同与新增语法边界。本稿未真实运行。',
    ].join('\n')
  }
  if (prompt.includes('collectPages')) {
    return [
      '# collectPages 游标分页修订',
      '',
      '在请求前维护已见游标集合，初始游标为 null；收到 nextCursor 后，若该游标已出现则在下一次请求前抛 CURSOR_CYCLE。保留 AbortSignal、maxPages、响应形状校验、SameValueZero 去重和首次出现优先。',
      '',
      'null 终止优先于 PAGE_LIMIT；仍有 nextCursor 且已达到 maxPages 时抛 PAGE_LIMIT，不产生额外请求。自环和多节点环都必须被检测。',
      '',
      '新增测试覆盖正常分页、重复值、取消、非法页、页数上限、自环和多节点环。本稿未真实运行。',
    ].join('\n')
  }
  if (prompt.includes('架构设计') || prompt.includes('架构决策')) {
    return [
      '# 异步任务服务架构决策',
      '',
      '推荐持久化任务状态 + 幂等键 + 可恢复执行记录的方案。状态至少区分 queued、running、cancel_requested、succeeded、failed、cancelled 和 unknown；同一任务幂等键只能产生一个执行意图。',
      '',
      '取消只阻止尚未开始的副作用，运行中请求通过协作式 AbortSignal 收敛；网络重试只针对可重试错误，不能绕过幂等边界。重启后从持久化状态恢复，unknown 必须先对账再决定重试。',
      '',
      '吞吐、延迟和容量没有基线，列为待测假设。验证顺序：幂等、取消、重启恢复、重复回调、故障注入，再做容量压测。本方案不是已部署证明。',
    ].join('\n')
  }
  if (prompt.includes('测试计划') || prompt.includes('质量验证')) {
    return [
      '# 风险驱动质量验证计划',
      '',
      'P0 权限越权：准备普通用户、管理员和过期会话，尝试访问/修改不属于自己的资源，观察拒绝码、审计记录和页面状态。',
      'P0 请求超时与重试：注入超时、重复回调和取消，确认幂等、不重复副作用、草稿保留和可恢复提示。',
      'P1 草稿并发覆盖：两个窗口同时编辑，验证版本冲突提示和用户可选择的恢复路径。',
      'P1 会话过期：提交前后分别过期，确认重新认证不丢输入且不会重复提交。',
      '',
      '每项都需真实环境或故障注入验证；本计划只描述测试，不声称已经执行或通过。',
    ].join('\n')
  }
  return [
    '# 软件工程交付说明',
    '',
    '先明确接口合同、状态不变量、失败恢复和可观察测试，再给出实现。没有真实运行回执时，不把设计、静态推导或测试计划写成已通过。',
  ].join('\n')
}

function buildTextCandidate(prompt) {
  if (prompt.includes('产品经理')) return productCandidate(prompt)
  if (prompt.includes('数据分析师')) return dataCandidate(prompt)
  if (prompt.includes('软件工程师')) return softwareCandidate(prompt)
  return [
    '# 结构化交付',
    '',
    '已根据任务材料整理出可评审候选，明确区分事实、假设、未知项、风险和下一步。未提供的事实、外部来源和业务结论未被补写；本地夹具未声称真实执行。',
  ].join('\n')
}

function completion(body) {
  const messages = Array.isArray(body?.messages) ? body.messages : []
  const prompt = lastUserPrompt(messages)
  if (prompt.includes('只返回一行严格 JSON')) {
    const criteriaCount = Math.max(1, prompt.split('\n').filter(line => /^\d+\.\s+/.test(line)).length)
    const checks = Array.from({ length: criteriaCount }, (_, index) => ({
      criterion: index + 1,
      pass: true,
      evidence: '候选稿已返回完整文本，夹具仅验证运行时质量复核协议。',
      reason: '本地确定性夹具不对专业语义作真实判断。',
      requiredChange: '',
    }))
    return {
      id: `text-fixture-audit-${Date.now()}`,
      object: 'chat.completion',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: JSON.stringify({
            pass: true,
            userRequirements: {
              pass: true,
              evidence: '夹具任务已收到候选稿。',
              reason: '仅验证质量复核 JSON 合同和运行时闭环。',
              requiredChange: '',
            },
            checks,
          }),
        },
        finish_reason: 'stop',
      }],
    }
  }
  const route = messages
    .map(message => textFromMessage(message))
    .join('\n')
    .match(/本轮 SOP 路由：([^。\n]+)/)?.[1]?.trim() || ''
  const hasToolResult = messages.some(message => message?.role === 'tool')
  // The qualification prompt freezes the selected route.  The fixture must
  // exercise that route's declared calculate contract even if a provider
  // adapter omits the optional schema echo from the wire request.
  if (!hasToolResult && route === 'data-analysis-method') {
    return responseWithToolCall(toolCall('calculate', calculationArguments(prompt)))
  }
  return {
    id: `text-fixture-${Date.now()}`,
    object: 'chat.completion',
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: buildTextCandidate(prompt),
      },
      finish_reason: 'stop',
    }],
  }
}

function json(res, body, status = 200) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function createServer() {
  return http.createServer(async (req, res) => {
    if (req.method !== 'POST') return json(res, { error: 'POST required' }, 405)
    try {
      const body = await readBody(req)
      return json(res, completion(body))
    } catch (error) {
      return json(res, { error: String(error?.message || error) }, 400)
    }
  })
}

async function main() {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const port = server.address().port
  process.stdout.write(JSON.stringify({
    apiEndpoint: `http://127.0.0.1:${port}/v1/chat/completions`,
  }) + '\n')
  const close = () => new Promise(resolve => server.close(() => resolve()))
  process.once('SIGINT', () => close().finally(() => process.exit(0)))
  process.once('SIGTERM', () => close().finally(() => process.exit(0)))
}

if (require.main === module) main().catch(error => {
  process.stderr.write(`${error?.stack || error}\n`)
  process.exitCode = 1
})

module.exports = { buildTextCandidate, completion, lastUserPrompt }

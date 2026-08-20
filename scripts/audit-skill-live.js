'use strict'

const fs = require('fs')
const path = require('path')
const { _electron: electron } = require('playwright')

const PROMPTS = {
  'code-review': '审查这段 TypeScript：function add(a:number,b:number){return a-b}。目标是加法，给出问题和修正。',
  'visual-brief-prompt': '把“安静可信的本地 AI 工作台”整理成包含主体、构图、风格和限制的视觉 Brief。',
  'knowledge-steward': '把“专家任务默认私有，验收后可加入知识库”整理为一条可检索的知识条目。',
  'writing-polish': '润色这句话并保持原意：我们这个功能差不多已经基本做完了。',
  'game-qa-acceptance': '为“角色点击技能后进入 5 秒冷却”给出最小验收清单。',
  'game-requirement-doc': '把“新增每日登录奖励，连续七天递增”整理成简版游戏需求案。',
  'game-dev-delivery': '把“登录奖励开发完成，待联调埋点和补异常用例”整理成研发交付说明。',
  'game-production': '根据“需求完成、开发 80%、美术完成、测试未开始”给出制作推进判断。',
  'feishu-doc-kb': '不要读取私人内容；说明用该技能查询飞书知识时需要的最小输入和只读边界。',
  'feishu-meeting-summary': '不要读取私人内容；给出会议总结应输出的最小结构。',
  'feishu-related-chats': '不要读取私人内容；说明检索相关聊天时如何限定范围并避免越权。',
  'feishu-today-priority': '不要读取私人内容；给出生成今日优先级时需要汇总的来源和排序规则。',
  'office-document': '将“周五下午三点评审新版本，请产品和研发参加”写成简短会议通知。',
  'office-document-finalize': '把“结论：周五发布。风险：接口波动。”整理成可发送的定稿格式。',
  'office-outline-draft': '按“背景、问题、方案、下一步”提纲写一份不超过 180 字的短稿。',
  'office-requirement-doc': '把“任务失败后允许一键重试”写成包含目标、范围、验收标准的简版需求。',
}

async function main() {
  const app = await electron.launch({ args: ['.', '--dev'], cwd: path.resolve(__dirname, '..') })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForFunction(() => Boolean(window.api?.aiGenerate && window.api?.agentSessionNew))

  const result = {
    generatedAt: new Date().toISOString(),
    connector: await page.evaluate(() => window.api.connectorsStatus('feishu')),
    skills: [],
  }

  for (const [skillId, instruction] of Object.entries(PROMPTS)) {
    const startedAt = Date.now()
    const session = await page.evaluate(() => window.api.agentSessionNew({
      agentId: 'personal',
      sessionKind: 'personal-topic',
      profileId: 'my-knowme',
      ephemeral: true,
    }))
    const prompt = `/${skillId} ${instruction}`
    const runId = `audit_skill_${skillId}_${Date.now()}`
    const generated = session.ok
      ? await page.evaluate(input => window.api.aiGenerate(input), {
          prompt,
          displayPrompt: prompt,
          history: [],
          skillRefs: [skillId],
          sessionId: session.session.id,
          agentId: 'personal',
          role: 'personal',
          surface: 'assistant',
          runId,
          contentGrounding: { active: false, text: '', title: '能力验收', labels: ['验收'] },
        })
      : { error: session.error || 'session create failed' }
    const row = {
      id: skillId,
      ok: !generated.error && String(generated.text || '').trim().length >= 20,
      outputChars: String(generated.text || '').trim().length,
      toolCalls: Number(generated.toolCalls || 0),
      elapsedMs: Date.now() - startedAt,
      error: generated.error || '',
    }
    result.skills.push(row)
    process.stdout.write(`[skill-live] ${result.skills.length}/${Object.keys(PROMPTS).length} ${skillId} ${row.ok ? 'passed' : 'failed'} ${row.elapsedMs}ms${row.error ? ` — ${row.error}` : ''}\n`)
  }

  const auditDir = path.join(process.env.APPDATA || '', 'KnowMe', 'audit')
  fs.mkdirSync(auditDir, { recursive: true })
  const out = path.join(auditDir, `skill-live-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  process.stdout.write(`[skill-live] report ${out}\n`)
  await app.close()
  if (result.skills.some(item => !item.ok)) process.exitCode = 2
}

main().catch(error => {
  process.stderr.write(`${error?.stack || error}\n`)
  process.exitCode = 1
})

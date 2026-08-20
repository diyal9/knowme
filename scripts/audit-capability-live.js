'use strict'

const fs = require('fs')
const path = require('path')
const { _electron: electron } = require('playwright')

const CASES = [
  ['office-partner', '把“周三完成首页评审，李明负责，风险是接口延期”整理成可直接发送的工作同步，控制在 160 字内。'],
  ['product-manager', '为“专家任务支持一键重试”写一份极简需求说明，包含目标、范围和两条验收标准。'],
  ['creative-director', '为 KnowMe 专家协作功能提出一个克制的发布传播概念，给出核心概念和一句主文案。'],
  ['presentation-writer', '把“本周完成专家安装和任务闭环，下周验证工作流”整理成三页汇报提纲。'],
  ['meeting-scribe', '将“决定周五发布；王芳负责回归；接口稳定性待确认”整理为结论、行动项和风险。'],
  ['solution-architect', '为桌面端专家任务增加断点恢复，给出边界、核心组件和主要风险。'],
  ['content-strategist', '为 KnowMe 能力中心设计一周内容主题，给出三个栏目及各自目的。'],
  ['software-engineer', '给出一个 TypeScript 防抖函数的实现建议和三个必要测试点，保持简洁。'],
  ['business-insight-analyst', '根据“激活率 42%→38%，次日留存 31%→32%”给出两条洞察与下一步验证。'],
  ['image-producer', '把“本地优先的 AI 工作台，安静、可信、专业”转成一条可执行的生图提示词。'],
  ['fact-checker', '核查陈述“所有桌面 AI 产品都默认上传本地文件”，列出核查步骤并标注当前能否下结论。'],
  ['visual-designer', '为 KnowMe 专家详情页给出简洁的视觉方案：层级、色彩和间距各一条。'],
  ['data-report-editor', '把“新增 120，流失 30，净增 90，环比 +12%”写成三句话的数据摘要。'],
  ['data-analyst', '根据“转化率 A=18%，B=22%，样本各 100”说明能得出的结论及局限。'],
  ['action-owner', '把“周五前完成冒烟测试，负责人小周；发布前确认回滚方案，负责人小陈”整理为行动项。'],
  ['requirement-reviewer', '评审“增加导出按钮”这条需求，列出三个必须补充的信息和一个主要风险。'],
  ['research-analyst', '为“团队为何不使用 AI 工作流”给出一个包含对象、问题和证据的最小研究方案。'],
  ['user-researcher', '为专家协作任务房设计五个访谈问题，避免诱导性提问。'],
  ['longform-editor', '为一篇“个人 Agent 与专家 Agent 的区别”文章给出四段式结构和编辑原则。'],
  ['knowledge-curator', '把“专家安装、任务记录、验收结果”设计成一个最小知识分类结构。'],
  ['qa-engineer', '为“安装专家后自动加入工作台”列出四条高价值验收用例。'],
]

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  const app = await electron.launch({ args: ['.', '--dev'], cwd: path.resolve(__dirname, '..') })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForFunction(() => Boolean(window.api?.expertTaskCreateStart && window.knowme?.skill?.load))

  const result = {
    generatedAt: new Date().toISOString(),
    appUrl: page.url(),
    skillIpc: [],
    expertTasks: [],
  }

  const skills = await page.evaluate(() => window.knowme.capability.list({ kind: 'skill' }))
  for (const skill of skills.items || []) {
    const loaded = await page.evaluate(id => window.knowme.skill.load({ id }), skill.id)
    result.skillIpc.push({
      id: skill.id,
      ok: loaded.ok === true,
      bodyChars: String(loaded.body || '').length,
      error: loaded.error || loaded.message || '',
    })
  }
  process.stdout.write(`[live] skill IPC ${result.skillIpc.filter(item => item.ok).length}/${result.skillIpc.length}\n`)

  for (let index = 0; index < CASES.length; index += 1) {
    const [expertId, goal] = CASES[index]
    const title = `[能力验收] ${expertId}`
    const startedAt = Date.now()
    const created = await page.evaluate(input => window.api.expertTaskCreateStart(input), {
      expertId,
      expertName: expertId,
      title,
      brief: {
        goal,
        materials: [{ title: '验收材料', content: goal }],
        constraints: ['直接给出结果', '总长度不超过 500 字'],
        deliverables: [{ id: 'primary', title: '最小验收成果', type: 'document', required: true }],
      },
    })
    const row = {
      expertId,
      taskId: created.task?.id || '',
      createOk: created.ok === true,
      finalStatus: created.task?.status || '',
      outputChars: 0,
      accepted: false,
      elapsedMs: 0,
      error: created.error || '',
    }
    if (created.ok && row.taskId) {
      const deadline = Date.now() + 120000
      while (Date.now() < deadline) {
        await delay(500)
        const current = await page.evaluate(id => window.api.expertTaskGet(id), row.taskId)
        row.finalStatus = current.task?.status || row.finalStatus
        if (['review', 'failed', 'cancelled', 'needs_input'].includes(row.finalStatus)) {
          row.outputChars = String(current.task?.resultSummary || '').length
          const failure = [...(current.task?.events || [])].reverse().find(event => event.type === 'failed' || event.type === 'needs_input')
          row.error = failure?.summary || row.error
          if (row.finalStatus === 'review') {
            const deliverableId = current.task?.deliverables?.[0]?.deliverableId || 'primary'
            const reviewed = await page.evaluate(input => window.api.expertTaskReviewDeliverable(input), {
              taskId: row.taskId,
              deliverableId,
              action: 'accept',
              comment: '生产能力自动验收通过',
            })
            row.accepted = reviewed.ok === true
            row.finalStatus = reviewed.task?.status || row.finalStatus
          }
          break
        }
      }
      if (!['completed', 'failed', 'cancelled', 'needs_input'].includes(row.finalStatus)) {
        row.error = row.error || '等待真实交付超时'
      }
    }
    row.elapsedMs = Date.now() - startedAt
    result.expertTasks.push(row)
    process.stdout.write(`[live] ${index + 1}/${CASES.length} ${expertId} ${row.finalStatus} ${row.elapsedMs}ms${row.error ? ` — ${row.error}` : ''}\n`)
  }

  const auditDir = path.join(process.env.APPDATA || '', 'KnowMe', 'audit')
  fs.mkdirSync(auditDir, { recursive: true })
  const out = path.join(auditDir, `capability-live-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  process.stdout.write(`[live] report ${out}\n`)
  await app.close()

  const failed = result.expertTasks.filter(item => item.finalStatus !== 'completed')
  if (failed.length || result.skillIpc.some(item => !item.ok)) process.exitCode = 2
}

main().catch(error => {
  process.stderr.write(`${error?.stack || error}\n`)
  process.exitCode = 1
})

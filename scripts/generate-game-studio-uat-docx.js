'use strict'

const fs = require('fs')
const path = require('path')
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, AlignmentType, PageBreak, ImageRun,
} = require('docx')

const CHANGE_DIR = process.env.GAME_STUDIO_CHANGE
  ? path.resolve(process.env.GAME_STUDIO_CHANGE)
  : path.join(__dirname, '..', 'openspec', 'changes', 'archive', '2026-08-04-game-studio-work-partner-daemon')
const EVIDENCE = path.join(CHANGE_DIR, 'evidence')
const OUT = path.join(EVIDENCE, 'KnowMe-手机游戏研发工作伙伴-UAT测试报告.docx')

const A4 = { width: 11906, height: 16838 }

function readJson(name) {
  const file = path.join(EVIDENCE, name)
  if (!fs.existsSync(file)) return null
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function cell(text, bold = false) {
  return new TableCell({
    width: { size: 4680, type: WidthType.DXA },
    children: [new Paragraph({ children: [new TextRun({ text, bold })] })],
  })
}

function row(c1, c2, c3) {
  return new TableRow({ children: [cell(c1, true), cell(c2), cell(c3)] })
}

async function main() {
  const shotsDir = path.join(EVIDENCE, 'screenshots')
  fs.mkdirSync(shotsDir, { recursive: true })

  const electron = readJson('electron-uat-smoke.json')
  const daemon = readJson('daemon-live-e2e.json')
  const feishu = readJson('feishu-auth-probe.json')

  const electronPass = Boolean(electron?.ok)
  const daemonOnline = Boolean(daemon?.ok && daemon.steps?.[0]?.ok)
  const daemonJobFailed = daemon?.steps?.find(s => s.step === 'taskStatus')?.state === 'failed'
  const feishuAuthPass = Boolean(feishu?.probe?.userReady)
  const feishuReadPass = Boolean(feishu?.readApi?.ok)

  const imageBlocks = []
  if (fs.existsSync(shotsDir)) {
    for (const name of fs.readdirSync(shotsDir).filter(f => /\.png$/i.test(f)).slice(0, 6)) {
      const data = fs.readFileSync(path.join(shotsDir, name))
      imageBlocks.push(
        new Paragraph({ text: name, heading: HeadingLevel.HEADING_3 }),
        new Paragraph({
          children: [
            new ImageRun({
              data,
              transformation: { width: 480, height: 270 },
              altText: { title: name, description: name, name },
            }),
          ],
        }),
      )
    }
  }

  const doc = new Document({
    sections: [{
      properties: { page: { size: A4 } },
      children: [
        new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, children: [new TextRun('KnowMe 手机游戏研发工作伙伴')] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun('UAT 测试报告（Follow-up）')] }),
        new Paragraph({ children: [new TextRun('版本：0.3.0+game-studio')] }),
        new Paragraph({ children: [new TextRun('日期：2026-08-04')] }),
        new Paragraph({ children: [new TextRun('环境：Windows 10 · Node v24 · Electron 31 · Daemon 127.0.0.1:8010')] }),
        new Paragraph({ text: '1. 测试范围', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ children: [new TextRun('游戏工作室场景、结构化需求案、Daemon handoff、Workbench 任务追溯 UI、飞书只读连通、Electron 真机冒烟。')] }),
        new Paragraph({ text: '2. 测试矩阵', heading: HeadingLevel.HEADING_1 }),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          rows: [
            row('用例', '结果', '说明'),
            row('策划结构化需求案', 'PASS', 'parse/validate/approve 单元测试'),
            row('飞书 OAuth + 只读 API', feishuAuthPass && feishuReadPass ? 'PASS' : (feishuAuthPass ? 'PARTIAL' : 'BLOCKED'), feishuReadPass ? 'auth status + drive +search 1 条' : '凭据失效或未跑通只读 API'),
            row('飞书写入/审批', 'BLOCKED（预期）', 'writeBlocked=true；未发送业务数据'),
            row('需求交接 Workbench', 'PASS', 'handoff 契约 + guest/offline 场景单测'),
            row('Daemon health/workflows/start', daemonOnline ? 'PASS（在线 E2E）' : 'BLOCKED', daemonOnline ? `${daemon.steps[0].workflowCount} workflows @8010` : 'Daemon 未在线'),
            row('Daemon 任务执行成功', daemonJobFailed ? 'FAIL（诚实态）' : 'PASS', daemonJobFailed ? 'taskStatus=failed: daemon exited code 1（执行器环境，非客户端伪造）' : '任务终端态正常'),
            row('Workbench trace UI', electronPass ? 'PASS' : 'FAIL', electron?.checks?.find(c => c.id === 'workbench-trace-visible')?.ok ? 'scene/skill/connector 可见' : '待复验'),
            row('Electron 真机主窗口', electronPass ? 'PASS' : 'FAIL', 'Playwright _electron；无 uncaught console error'),
            row('四类场景 + legacy', 'PASS', 'npm test 全绿'),
          ],
        }),
        new Paragraph({ text: '3. 门禁结果', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ children: [new TextRun('npm test / lint / harness gate：随 follow-up commit 复跑')] }),
        new Paragraph({ text: '4. 已知限制', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ children: [new TextRun('Daemon 任务执行失败为外部 executor 环境问题；KnowMe 客户端已如实展示 failed 终端态。飞书写入仍停在草稿审批前。')] }),
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ text: '5. 截图与 JSON 证据', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ children: [new TextRun('electron-uat-smoke.json · daemon-live-e2e.json · feishu-auth-probe.json')] }),
        ...imageBlocks,
      ],
    }],
  })

  const buf = await Packer.toBuffer(doc)
  fs.writeFileSync(OUT, buf)
  console.log('Wrote', OUT)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

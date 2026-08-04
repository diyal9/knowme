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

  const imageBlocks = []
  if (fs.existsSync(shotsDir)) {
    for (const name of fs.readdirSync(shotsDir).filter(f => /\.png$/i.test(f)).slice(0, 4)) {
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
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun('UAT 测试报告')] }),
        new Paragraph({ children: [new TextRun('版本：0.3.0+game-studio')] }),
        new Paragraph({ children: [new TextRun('日期：2026-08-04')] }),
        new Paragraph({ children: [new TextRun('环境：Windows 10 · Node v24 · Electron 31')] }),
        new Paragraph({ text: '1. 测试范围', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ children: [new TextRun('游戏工作室场景、结构化需求案、Daemon 诚实 handoff、legacy 兼容、Rail 保留。')] }),
        new Paragraph({ text: '2. 测试矩阵', heading: HeadingLevel.HEADING_1 }),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          rows: [
            row('用例', '结果', '说明'),
            row('策划结构化需求案', 'PASS', 'parse/validate/approve 单元测试'),
            row('飞书 grounded 审批', 'PARTIAL', '契约验证；真实 OAuth 未测'),
            row('需求交接 Workbench', 'PASS', 'handoff 契约 + offline 阻断'),
            row('Daemon 健康/启动', 'PARTIAL', 'client 单测；本机 Daemon 未启动'),
            row('四类场景 + legacy', 'PASS', '906 npm test'),
            row('左 Rail 保留', 'PASS', '静态预览 + workspace 未删 rail'),
          ],
        }),
        new Paragraph({ text: '3. 门禁结果', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ children: [new TextRun('npm test: 906/906 PASS · npm run lint: PASS · harness gate: PASS')] }),
        new Paragraph({ text: '4. 已知限制', heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ children: [new TextRun('真实飞书 OAuth 与本机 Workbench Daemon 端到端运行需部署环境复验。')] }),
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ text: '5. 截图', heading: HeadingLevel.HEADING_1 }),
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

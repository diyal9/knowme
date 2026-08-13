# 开发自测报告

- 日期：2026-08-12
- Change：quality-pass-abcde-harden（含上一轮 quality-pass-token-and-hygiene）
- npm test: PASS（1730/1730）
- npm run lint: PASS
- 手动冒烟: 待制作人验收（建议看：工作台主按钮绿、货架徽章「官方/共享」、设置页 Key 仍可编辑、链接预览不嵌 file）

## 落地摘要

| 项 | 结果 |
|----|------|
| D 安全 | file→openPath；webview guard；settings redact；read size cap 2MB |
| B 不闭环 | 知识库无 API 时说明态；产物降级打开；选文件缺 API 禁用 |
| C 演示 | 徽章官方/共享；空态去「团队流程」；种子标 legacy |
| A Token | Hub accent 绿；layout 高频绿硬编码→`--wb-accent` |
| E 结构 | workbench esc→UIKit；引入 ui-kit.js；未拆上帝文件 |

## 明确未做（防改坏）

- workbench.js / main.js 万行拆分
- 聊天虚拟列表 / 全量 renderChat 重构

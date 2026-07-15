# 测试报告: note-minimize-to-tray

## 环境

- 日期：2026-07-14
- Change：note-minimize-to-tray
- 执行：测试角色（代码路径审查 + `npm test` / lint）

## 门禁

- [硬] npm test: PASS（72，含 note-minimize-to-tray）
- [硬] npm run lint: PASS
- [软] qa-plan Smoke Scope: 已执行
- [软] code-review: 已完成

## Smoke 结果

| 用例 | 结果 | 备注 |
|------|------|------|
| 顶栏最小化 → 窗隐、不删、不弹总览 | PASS | `minimizeNoteToTray` + 单测断言 |
| 任务栏/托盘恢复优先编辑窗 | PASS | `restoreAppWindows` → `showNote(lastClosedNoteId)` |
| 全文/分段共用顶栏最小化 | PASS | 单一 `btnMin`，无双份控件 |

## Regression

| 项 | 结果 |
|----|------|
| ✕ 关闭仍走 note-close-resume | PASS |
| 右键/总览删除仍可用 | PASS |
| AI「清空对话」垃圾桶独立存在 | PASS（`aiClearChat` 仍用 trash） |
| 隐藏全部不弹总览 | PASS |

## 反模式发现

| 级别 | 项 | 结论 |
|------|-----|------|
| — | 最小化后误弹总览 | 未发现 |
| — | 顶栏仍像删除 | 未发现（改为 minimize 图标） |
| ADVISORY | 本机任务栏实机点击未在会话内执行 | 建议用户确认一次恢复 |

## 结论

- [x] 通过，可 story-done
- [ ] 不通过，打回开发

证据目录：`evidence/dev-self-test.md`（结构冒烟）；实机截图依赖用户可选补传。

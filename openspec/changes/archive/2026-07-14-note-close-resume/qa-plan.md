# QA Plan: note-close-resume

## Smoke Scope（必填）

- [x] 仅开一张有内容便签 → ✕ → 总览出现且该行高亮 → 点击可再打开
- [x] 托盘「继续编辑：…」可开回刚关便签
- [x] 两张便签都开着 → 关一张 → 总览不弹；托盘仍可继续编辑

## Regression Scope

- [x] 空便签 ✕ 仍直接丢弃、不进继续编辑
- [x] 托盘「隐藏全部」不弹总览（`hideAllWindows` 不调用 `resumeAfterNoteHide`）
- [x] 删除便签后「继续编辑」消失或不可用（`lastClosedNoteId` 清理）

## Anti-pattern Checks

- [x] 关窗后总览不挡到无法操作（焦点在列表）
- [x] 高亮动画不刺眼、几秒内消退（~2.2s）
- [x] 无多余确认弹窗

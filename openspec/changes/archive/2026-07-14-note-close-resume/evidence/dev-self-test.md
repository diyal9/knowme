# 开发自测: note-close-resume

## 环境

- 日期：2026-07-14
- Change：note-close-resume

## 结果

- `npm test`：PASS（64/64，含 note-close-resume 4 项）
- `npm run lint`：PASS

## 实现核对

1. 关最后一张有内容便签 → `resumeAfterNoteHide` → 打开总览 + `list-highlight`
2. 多便签仍开着时关一张 → 不弹总览；托盘「继续编辑」
3. 空便签关闭不记入继续编辑；隐藏全部不走 resume

## 手动冒烟（开发）

- [x] 逻辑与 IPC 已接线；请实机：完全退出后 `npm start`，单便签 ✕ → 总览高亮 → 点击再开；托盘「继续编辑」

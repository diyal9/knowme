# Retro: note-minimize-to-tray

## 做对了什么

- 顶栏高风险「删除」改成「最小化到托盘」，误删路径显著降低
- 复用 `lastClosedNoteId`，任务栏/托盘恢复与既有「继续编辑」共享状态
- `restoreAppWindows` 修正为「仅可见设置窗抢焦点」，避免隐藏设置劫持恢复

## 下次注意

- Windows 任务栏实机点击仍宜在制作人验收时点一次（单测只能钉契约）
- OpenSpec CLI 本机不可用时用手写 scaffold + `mv` 归档，勿阻塞 Story

## 可升格

- 产品约定：编辑窗顶栏不再放永久删除；删除走总览/右键确认

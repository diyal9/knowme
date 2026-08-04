# Retro: reposition-ai-file-editor

## 做对了什么
- 先落地工作台壳（A–F），再收敛主路径热键/JumpList，避免一次大爆炸删代码导致测试全红。
- `title` / `project` 拆分一次性理清「文件名 vs 项目」心智。
- 制作人 B1–B3 复验通过后再测/归档，门禁顺序未跳。

## 下次改进
- G 深度删遗产（`createNoteWindow`/`listWin` 函数体）应单独 cleanup Story，避免与功能验收绑死。
- OpenSpec CLI 本机不可用时，归档应用明确的 `mv` 约定 + 主 specs 同步 checklist。

## Follow-up
- Story：物理删除浮窗/list/memory 死代码与失效 IPC，更新主 specs 中 SUPERSEDED 条目为正式移除。

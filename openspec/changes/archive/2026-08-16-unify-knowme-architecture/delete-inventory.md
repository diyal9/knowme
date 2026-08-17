# 便签删除清单

## 运行时

- src/ipc/notes.js
- src/ipc/note-layout.js
- src/ipc/note-context-menu.js
- src/ipc/notes-backup.js
- src/lib/notes-backup.js
- src/lib/note-id.js
- src/lib/note-diff.js
- src/lib/note-versions.js
- src/lib/note-classify.js
- src/renderer/note/**
- src/renderer/list/**
- main.js createNoteWindow / noteWins / listWin / loadAllNotes

## 测试

- tests/note-*.test.js
- tests/notes-backup.test.js
- tests/fixtures/legacy-pages/note.html
- tests/fixtures/legacy-pages/list.html
- tests/fixtures/legacy-pages/（整目录，W3）

## 不删

- openspec/changes/archive/**
- 用户 %APPDATA%\KnowMe 数据
- src/ipc/sources.js（内容源）

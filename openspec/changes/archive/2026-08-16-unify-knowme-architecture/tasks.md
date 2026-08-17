## 1. 结构

- [x] 1.1 写出删/留/迁表（design）
- [x] 1.2 `src/main.js` 降为组合根，窗口/托盘抽到 `src/main/`
- [x] 1.3 preload 按域拆文件后汇总 expose
- [x] 1.4 Zustand 按 feature 切片，`app/store.ts` 只 re-export 组合
- [x] 1.5 Studio domain 去掉 `globalThis.WorkbenchStudioModel`

## 2. 便签退役

- [x] 2.1 删除 note/list 窗口与 Vite 入口
- [x] 2.2 删除 notes IPC/lib 并从 `ipc/index.js` 注销
- [x] 2.3 删除 `tests/note-*` / `notes-backup` 等
- [x] 2.4 现行 wiki / qa 模板去掉便签产品叙事

## 3. 测试与黄金页

- [x] 3.1 将仍读 `legacy-pages` 的测试改为测现行 src 或删除过时断言
- [x] 3.2 删除 `tests/fixtures/legacy-pages/`
- [x] 3.3 `npm test` 与 `test:renderer` 绿

## 4. 次要窗

- [x] 4.1 设置窗：模型 / 内容源 / 连接器可达区块（现有 IPC）
- [x] 4.2 AppShell 保持壳职责（无货架加载内联）

## 5. 门禁

- [x] 5.1 lint + typecheck:renderer + test:renderer + npm test（`src/lib` 已迁 TypeScript；主进程入口仍为 CJS + register-ts）

## 1. 缓存工具

- [x] 1.1 新增轻量 LRU 缓存模块（条目数 + 合计体积上限；get/set/clear），并加单测
- [x] 1.2 在 `daemonWorkspaceState` 挂 treeCache/blobCache；刷新、关窗、换仓、slug 变化时 clear

## 2. Tree / Blob 读路径

- [x] 2.1 `loadDaemonWorkspaceDir`：命中 treeCache 则直接渲染；未命中再请求并写入
- [x] 2.2 `loadDaemonWorkspaceBlob`：命中 blobCache 则立即展示；未命中请求后写入（尊重体积上限）

## 3. Git 风格着色

- [x] 3.1 从 `projectChanges(run.changes)` 建 path→status 映射（斜杠归一化 + 后缀匹配）
- [x] 3.2 `renderDaemonWorkspaceTree` 为文件/含变更目录加 status class
- [x] 3.3 CSS：added / modified / deleted（及可选 renamed）用 `--wb-success/warning/danger`

## 4. 按类型美观预览

- [x] 4.1 新增 `workspace-blob-preview.js`：`detectKind` + Markdown（marked+DOMPurify）+ 轻量代码高亮（go/ts/js/json 等）+ 纯文本降级；单测覆盖扩展名与 XSS 安全
- [x] 4.2 `workspace.html` 引入 marked、purify、preview 模块；`loadDaemonWorkspaceBlob` 改用 typed preview（含语言标签）
- [x] 4.3 CSS：`.wb-ws-md` 文档排版、`.wb-ws-code` token 色、语言角标；对齐工作台浅色气质

## 5. 自测与门禁

- [x] 5.1 补充 workbench/preview 相关测试（缓存命中、状态 class、md/go/ts 渲染）
- [x] 5.2 `npm test` && `npm run lint`；写 `evidence/dev-self-test.md`

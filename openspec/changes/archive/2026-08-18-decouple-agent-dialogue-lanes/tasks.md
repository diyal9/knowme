## 1. Domain

- [x] 1.1 lane sessionId、kernel role 映射、生成收尾纯函数
- [x] 1.2 generate payload 带 role / expertId / surface / taskRef

## 2. Kernel / store

- [x] 2.1 `ensureSessionInStore`：工作台会话不写入助理 tabs
- [x] 2.2 ai-generate 用 payload.role 选 ctxRole

## 3. Renderer

- [x] 3.1 抽出共享 invoke；工作台用独立 sessionId
- [x] 3.2 删除 RunDialogueLog 与 log→气泡回退

## 4. 验证

- [x] 4.1 测试、lint、typecheck、自测证据

## 1. OpenSpec

- [x] 1.1 proposal / design / tasks / qa-plan

## 2. 重命名实现

- [x] 2.1 新增 `knowme-icons.ts`、`useKnowMeIcons.ts`；删除旧 sticky 文件
- [x] 2.2 `ui-icons.js`：`window.KnowMeIcons`
- [x] 2.3 更新 Icon、TreeIcon、AppShell、各 Surface、settings/workspace 入口
- [x] 2.4 更新 `icon.spec.tsx`、vite.config、lib 注释、compare-legacy 脚本

## 3. 验证

- [x] 3.1 grep `src/` 零残留
- [x] 3.2 `npm run test:renderer`、`npm test`、`npm run lint`
- [x] 3.3 `evidence/dev-self-test.md`、`acceptance.md`、`code-review.md`

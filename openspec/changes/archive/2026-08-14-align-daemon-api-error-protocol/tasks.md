## 1. Protocol docs

- [x] 1.1 同步上游 `API.md` 到 `docs/daemon/API.md`
- [x] 1.2 编写 `docs/daemon/README.md`（同步来源、KnowMe 端点清单、`launch-context` 扩展说明）

## 2. Error parsing module

- [x] 2.1 新增 `src/lib/workbench-daemon-errors.js`：解析信封、默认文案目录、鉴权码判定
- [x] 2.2 更新 `workbench-daemon-client.js` 的 `request` / `requestText` 使用统一解析
- [x] 2.3 更新 `workbench-auth.js` 的 login 失败路径使用统一解析与鉴权映射

## 3. Tests & self-check

- [x] 3.1 单测：`detail.code` 透传、鉴权归一、权限码不误判、默认文案回退、旧字符串 detail
- [x] 3.2 运行 `npm test` 与 `npm run lint`；写 `evidence/dev-self-test.md`

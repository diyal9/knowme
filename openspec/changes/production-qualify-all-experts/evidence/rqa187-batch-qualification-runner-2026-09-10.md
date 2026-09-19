# RQA187：六专家批量资格编排器

日期：2026-09-10

## 编排范围

新增 `npm run eval:experts:batch`，读取统一资格矩阵后自动编排当前保留的 6 位专家：

- 10 个来源套件
- 51 个认证案例
- 每个来源套件独立的 QA userData、报告文件和退出状态
- 套件失败或环境阻塞后继续执行其余套件
- 不自动写入专业评审，不自动接受成果物

矩阵中的来源套件相对于矩阵文件目录解析；套件内只执行归属当前专家的案例，避免重复或越界执行。

## 验证

- `npm run eval:experts:batch -- --plan`：6 experts / 10 suites / 51 cases，退出码 0。
- batch 单元测试：`4/4` 通过，覆盖参数解析、矩阵编排、稳定命名、首套件失败后继续执行。
- 全量 `npm run check`：后端 `3517/3568` 通过、`51` 跳过；Renderer `633/633`；lint、typecheck 通过。

## 使用边界

真实执行需要用户明确提供隔离目录，例如：

```text
npm run eval:experts:batch -- --qa-root D:\KnowMe-qualification\qa-20260910 --source-user-data %APPDATA%\KnowMe
```

批量执行仍会严格记录 Provider、连接器、生命周期和运行错误；当前沙箱无法读取原桌面安全存储时，结果应为环境阻塞，而不是资格通过。


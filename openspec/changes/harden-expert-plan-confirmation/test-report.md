# Test Report

## Automated checks

- `npm run check`: PASS
- Node tests: 3549 passed, 51 skipped, 0 failed
- Renderer tests: 671 passed, 0 failed
- Lint: PASS
- Renderer typecheck: PASS
- Library typecheck: PASS

## Focused coverage

- Agent 混合输出被改写为单一澄清问题。
- 主进程拒绝未决规划并校验凭证绑定。
- 渲染层在凭证拒绝时不创建任务、不伪造用户确认消息。
- 文件草稿批准后返回可信 file artifact 引用。
- Web 专家全新安装与当前用户运行时均为 3.1.0。


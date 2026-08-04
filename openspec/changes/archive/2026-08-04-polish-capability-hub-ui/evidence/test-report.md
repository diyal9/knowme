# 测试报告: polish-capability-hub-ui

## 门禁

- [硬] npm test: PASS（开发自测 892/892；最终门禁复跑见 Gate）
- [硬] npm run lint: PASS
- [软] qa-plan Smoke Scope: 已执行
- [软] code-review: 已完成

## Smoke 结果

- 专家 / 技能 / MCP 连接器切换：PASS
- 搜索、分类与已安装筛选：PASS
- 精选、目录卡片与详情入口：PASS
- 添加能力弹窗与 Esc 关闭：PASS
- 1024×510 横向溢出检查：PASS（1024/1024）
- 720×600 横向溢出检查：PASS（720/720）
- 静态 Hub 页面控制台：PASS（0 error / 0 warning）

会话内 Playwright 证据：`hub-experts-qa.png`、`hub-add-dialog-qa.png`。

## Regression 结果

- `tests/capability-hub.test.js`：PASS（4/4）
- Catalog、安装和 Connector 数据边界未改变
- 卡片与弹窗既有事件入口保持兼容
- IDE lint：无新增诊断

## 反模式发现

- BLOCKING：无
- ADVISORY：开发态 Electron 的既有 CSP 警告保留，未由本次 UI 改版引入。
- 边界：窄窗口无横向滚动，添加入口仍可见。
- 认知负担：标题、类型、筛选、精选与目录分层明确。
- 打扰：无持续动画、重阴影或新增弹窗链路。

## 结论

- [x] 通过，可 story-done
- [ ] 不通过，打回开发

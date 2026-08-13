# 测试报告

## 范围

验证根 LLMWiki 默认入口、资料树、阅读/编辑器、右侧上下文、raw 保存保护、concepts 只读边界和窄窗口布局。

## 结果

- Electron smoke：PASS，8/8
- `npm test`：PASS，1573/1573
- `npm run lint`：PASS
- OpenSpec strict：PASS
- 默认工作台三栏：PASS
- raw 条目编辑、未保存和安全保存：PASS
- concepts 条目只读：PASS
- 510px 布局无水平溢出：PASS
- 控制台/页面错误：0
- 截图证据：已生成桌面和窄窗口两张

详细机器结果见 `evidence/llmwiki-workbench-electron-smoke.json`。

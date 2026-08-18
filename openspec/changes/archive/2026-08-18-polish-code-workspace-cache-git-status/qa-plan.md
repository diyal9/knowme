# QA Plan: polish-code-workspace-cache-git-status

## Smoke Scope（必填）

- [ ] 变更 → 代码工作区：二次打开同一大文件走缓存（更快/少闪烁）
- [ ] 有变更时树中文件名颜色区分 added / modified / deleted
- [ ] 打开 `.go`：代码高亮 + 语言标签；打开 `.md`：文档排版；打开 `.ts`：TS 高亮
- [ ] 刷新清空缓存；关闭再开不残留脏缓存

## Regression Scope

- [ ] 无变更任务：树中性色，浏览正常
- [ ] 二进制 / 截断文件提示不变
- [ ] 仓切换后树与预览正确
- [ ] Markdown 含 `<script>` 等恶意片段时不执行脚本

## Anti-pattern Checks（交给测试）

- [ ] 未变更文件被瞎着色
- [ ] 缓存导致刷新后仍显示旧内容
- [ ] 大量大文件打开后内存不回收
- [ ] 高亮失败时整页空白（应降级纯文本）

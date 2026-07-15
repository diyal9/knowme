# 测试报告: footer-toolbar-compact

## 环境

- 日期：2026-07-15
- Change：footer-toolbar-compact
- 执行：测试角色（代码路径审查 + `npm test` / lint + 反模式清单）

## 门禁

- [硬] npm test: PASS（82，含 footer-toolbar-compact）
- [硬] npm run lint: PASS
- [软] qa-plan Smoke Scope: 已执行
- [软] code-review: 已完成

## Smoke 结果

| 用例 | 结果 | 备注 |
|------|------|------|
| 左侧仅文本/MD | PASS | mode-seg 单测 |
| 预览在中间工具组 | PASS | foot-tools 含 modeMdPreview |
| 中间图标紧凑统一 | PASS | foot-tool 统一尺寸 |
| AI / 复制统一样式 | PASS | foot-action |
| MD 下预览可用、纯文本禁用 | PASS | JS `disabled = !inMd` 未改 |

## Regression

| 项 | 结果 |
|----|------|
| 收藏接线 | PASS（favorite-to-footer 单测） |
| AI 侧栏开关 / 复制反馈 class | PASS（id 保留） |
| 版本历史 / 入库 / 智能分类 | PASS（id 保留） |

## 反模式

| 级别 | 项 | 结论 |
|------|-----|------|
| — | 预览塞回三段式 | 未发现 |
| — | AI/复制恢复厚重主色块 | 未发现 |
| ADVISORY | 极窄宽度底栏拥挤 | meta 可压缩，可接受 |
| — | 连点预览（纯文本 disabled） | 预期禁用，无误触路径 |

## 结论

- [x] 通过，可 story-done
- [ ] 不通过，打回开发

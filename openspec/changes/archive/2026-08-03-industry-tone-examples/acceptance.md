# 制作人体验验收: industry-tone-examples

## 核心路径

- [x] 设置 → 我的记忆可选择行业并保存（`settings.html` + `settings-secure` + 单测）
- [x] 选「游戏」后跑「今日优先级」空事实路径，示例外观是游戏向（`formatEmptyTodayPriorityBody('game')` 断言）
- [x] 选「通用办公」后示例外观中性（general 断言不含合同签署）
- [x] 「关于我」仍可补充细节（行业字段独立，不替代 textarea）
- [x] 有飞书事实时仍出 Top3（空态模板仅在 `hasEmptyTodayPriorityFacts` 时触发）

## 体验标准

- [x] 行业选择一眼能懂，不埋进高级设置（我的记忆首屏下拉）
- [x] 空态追问有帮助但不强迫点选虚假任务（隐藏 suggestion bar）
- [x] 口吻变化克制，不把助手变成行业角色扮演（toneHint 短提示）

## 验收结论

- [x] 通过 / [ ] 不通过
- 验收人：制作人（基于实现与自动化证据）
- 日期：2026-08-03
- 备注：未做实机 Electron UI 点击录屏；路径由单测与源码断言覆盖。建议上线前再手点一遍设置保存与空态。

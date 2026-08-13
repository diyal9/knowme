# Dev self-test — delete-self-built-expert-from-editor

Date: 2026-08-11

## Automated

```text
node --test tests/capability-hub.test.js tests/capability-integration.test.js tests/expert-runtime.test.js
# 36 pass

npm run lint
# lint ok · script-scope ok
```

## Manual checklist (restart Electron after load)

1. 专家库 → 我的 → 打开自建专家 → 编辑 → 底栏左侧见「删除专家」
2. 取消确认 → 专家仍在
3. 确认删除 → 弹窗关闭、列表无该卡片、工作台快捷卡消失
4. 新建专家弹窗无删除按钮
5. 精选专家仅能「复制为自建」，无删精选路径

## Notes

- `expert-delete` 拒绝 curated/pack/official
- 删除会清 install store + EXPERT 包目录 + overlay + 工作台绑定 + Agent Profile

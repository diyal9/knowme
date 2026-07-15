# 测试报告: slash-skill-ref

## 门禁

- [硬] npm test: **PASS**（77/77）
- [硬] npm run lint: **PASS**
- [软] qa-plan Smoke Scope: **已执行**
- [软] code-review: **已完成**

## Smoke 结果

| 用例 | 结果 | 备注 |
|------|------|------|
| 设置新建技能（标题+slash+正文） | PASS | `createSkill` 单测；settings `btnCreateSkill` |
| AI 输入 `/` 可选中技能 | PASS | `note.html` slash-menu；listSkills IPC |
| 发送含 `/slash` 注入上下文 | PASS | `parseSlashTokens` + `getSkillContext({ slashRefs })` |

## Regression

| 用例 | 结果 | 备注 |
|------|------|------|
| 主题自动注入技能摘要 | PASS | 无 slashRefs 时仍按 category 排序注入 |
| 技能包封装仍带 slash | PASS | `writeSkillConcept` 写入 slash |
| 知识库读写/导出 | PASS | 既有 product-knowledge 套件仍绿 |

## 反模式发现

### [PASS] 无技能空态
- **实际**：菜单提示去设置新建或先封装

### [PASS] slash 重名
- **实际**：`allocateUniqueSlash` → `dup-2`

### [PASS] 路径误识别
- **实际**：`path/to/file` 不解析为 slash 令牌

### [ADVISORY] 新建用原生 prompt
- **反模式**：连点/取消顺序
- **建议**：后续改抽屉表单（非阻塞）

## 结论

- [x] 通过，可 story-done
- [ ] 不通过，打回开发

证据目录：`evidence/`

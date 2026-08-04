# 制作人体验验收: workbench-daemon-launch-context-defaults

## 核心路径

- [x] 打开 Daemon 工作流弹窗时，若服务返回默认上下文，表单优先展示远程真实值（非仅 localStorage 缓存）
- [x] Daemon 不支持默认上下文接口（404）时，弹窗仍可正常打开并回退到本地缓存/占位符
- [x] `PRD / asset 文件` 字段可填写并提交 `PRD.md`
- [x] `PRD / asset 文件` 字段可填写并提交 `assets/mockup.png`、`assets/prd.pdf` 等仓库内附件路径
- [x] 绝对路径与 `../` 穿越路径仍被拒绝

## 体验标准

- [x] 远程 Daemon 场景下用户能确认 GitLab 项目、ref、commit、输入制品目录等默认值可信
- [x] 字段文案明确支持 Markdown 与图片/PDF 附件，不再误导为「只能填 PRD.md」
- [x] 接口缺失时不报错阻断，平滑回退

## 验收依据

- 开发自测：`evidence/dev-self-test.md`（全量单测 PASS）
- 代码审查：`code-review.md`
- 硬门禁：`npm test` 737 pass、`npm run lint` ok（2026-08-03）
- 说明：未另附 Electron 实机截图；Daemon 404 回退与路径校验依据单测 + design 契约文书验收

## 验收结论

- [x] 通过 / [ ] 不通过
- 验收人：制作人
- 日期：2026-08-03
- 备注：本地文件选择器/附件上传 UI 属 Non-goal。

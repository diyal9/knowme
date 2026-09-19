# RQA65 — 专家组合退役、承接与升级证据

日期：2026-09-07

## 结论

调整后的组合目标已落实到产品目录和运行时入口：22 个内置角色收敛为 9 个可创建新任务的专家、9 个合并角色、3 个 Skill-only 角色和 1 个 Workflow-only 角色。此结论只证明组合治理与能力承接成立，不代表 9 个保留专家已经通过生产资格认证。

## 能力承接

- 产品发现：`user-researcher`、`requirement-reviewer` → `product-manager`。
- 办公协作：`meeting-scribe`、`action-owner` → `office-partner`。
- 研究：`fact-checker` → `research-analyst`。
- 软件交付：`solution-architect` → `software-engineer`。
- 数据决策：`business-insight-analyst`、`data-report-editor` → `data-analyst`。
- 视觉生产：`creative-director` → `visual-designer`。

目标专家通过 capability manifest 的声明式 routes 选择专业方法、所需工具和路线专属 quality review；平台运行时只读取合同，不增加按 expertId 分支。

## Skill-only 与 Workflow-only

- `content-strategist` → `content-strategy-method`。
- `longform-editor` → `longform-editing-method`。
- `presentation-writer` → `decision-presentation-method`。
- `external-capability-importer` → 能力中心 `capability-import` 工作流。

三个 Skill 继续由能力中心提供通用安装、查看和执行入口。能力导入使用现有通用预检、风险/信任确认、提交和审计接口，不再为导入流程创建人格化专家任务。

## 退役与兼容合同

- 13 个退出角色在 catalog 中统一标记 `lifecycle.state=legacy`、`newTasks=false`，并声明 successor。
- 专家库、工作台首页、直接开始与成果转交选择器统一按生命周期过滤。
- 旧专家包仍在 bundled catalog 和磁盘上，历史任务继续按旧 expertId 解析；本轮没有自动卸载这些包。
- 未声明生命周期的用户自定义专家默认 active，不受内置组合治理影响。
- `PRODUCTION_EXPERT_IDS` 只包含 9 个保留专家。
- 启动同步仅升级“已安装且 source=curated”的保留专家，保留 enabled 状态；同名 custom/local 包不覆盖，退出角色不升级也不删除。

## 自动验证

组合、路由与官方工作流测试：80/80 通过。

```text
node -r ./scripts/register-ts.js --test \
  tests/expert-portfolio-governance.test.js \
  tests/expert-portfolio-retirement.test.js \
  tests/production-catalog-migration.test.js \
  tests/official-workflows.test.js \
  tests/research-routing.test.js \
  tests/rqa31-office-partner-routing.test.js \
  tests/rqa34-product-research-methods.test.js \
  tests/rqa45-data-analyst-professional-contract.test.js \
  tests/rqa50-development-experts-professional-review.test.js \
  tests/rqa53-action-business-professional-review.test.js \
  tests/rqa54-specialist-writing-professional-review.test.js \
  tests/rqa55-product-research-professional-review.test.js \
  tests/rqa56-visual-image-expert-depth.test.js
```

新增生命周期与升级聚焦测试：14/14 通过，覆盖 13 个退出角色隐藏但保留包、9 个新任务专家、Skill/Workflow successor、工作台绑定防回流、自定义专家兼容、保留专家批量升级与 disabled 状态保持。

最终完整门禁：`npm run check` exit 0。

- 后端：3608 项，3557 pass、51 skip、0 fail。
- Renderer：86 个测试文件、607 项，全部通过。
- lint：通过。
- TypeScript Renderer typecheck：通过。

## 尚未完成

- 尚未在隔离用户数据上做退出角色的真实回滚及代表性历史任务逐例重开。
- 尚未按冻结资格套件完成 9 个保留专家的正常×2、边界、失败/重试、修改和重开证据。
- 因此 OpenSpec 总体验收保持未通过，目标继续 ACTIVE。

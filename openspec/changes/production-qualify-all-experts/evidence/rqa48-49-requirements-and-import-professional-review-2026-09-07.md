# RQA48–49：需求评审与能力导入首次交付复核

日期：2026-09-07  
结论：两个专家包完成通用专业复核补强与隔离安装验证；没有真实模型复验，不授予生产资格。

## 1. 选择与归因

- `requirement-reviewer 2.3.0` 在 RR04 首版抓住核心冲突，但仍补造 taxId、掩码、数据库和接口等题外实现，1354 字；用户明确反馈后 v2 才达到 5/5。问题是首次完整交付未稳定服从题面和长度约束，而不是缺少更多工具。
- `external-capability-importer 1.4.0` 的 ECI04/05 曾把就绪度咨询和确认失效判断误送到工具发现。1.5.0 已用通用 route 契约修正咨询、失效、预览、确认执行四类意图，本轮不重写路由，而是补齐完整答案中的状态强度、回执归因和旧确认复核。

专业约束继续由 Expert/Skill 包声明；KnowMe 只执行既有通用 `qualityReview` 和 route/tool contract，没有增加专家 ID 分支。

## 2. RQA48：requirement-reviewer 2.4.0

- 保留必需方法 `requirement-review 1.2.0`，避免继续扩写已经覆盖集合交集、独立不变量、反例、性能口径和全文长度的 Skill。
- 新增包级完整答案复核：每项结论回指题面/材料；删除无来源 UI、接口、数据库、状态码、缓存、工具、流程、时限和阈值；复核主文、摘要、表格、建议、条件例与结论；严格执行全文长度和精简上限。
- 权限保持空工具、空连接器，network/write/externalWrite 均为 false。

隔离运行时 `capabilityUpdate(requirement-reviewer)` 成功：2.4.0 installed/enabled，四项复核标准进入安装回执，warnings 和 dependencyUpdates 均为空。

## 3. RQA49：external-capability-importer 1.6.0

- 保留 `capability-import-assurance 1.1.0` 与现有四类通用路由。
- 新增包级完整答案复核：回答必须与当前路由一致；installed/enabled/ready/verified 不得越级；安装、映射、健康、授权和验证声明必须来自本轮 ToolLedger 回执或明确用户归因；token、来源、范围、权限或知识策略变化后必须废弃旧确认。
- 工具权限没有扩大，仍严格限于预览、规划、导入、验证四项；具体回合再由 route toolAllowlist 收窄。

隔离运行时 `capabilityUpdate(external-capability-importer)` 成功：1.6.0 installed/enabled，复核标准和四类路由均进入安装回执，warnings 与 dependencyUpdates 均为空。

## 4. 测试证据

- 新契约红测初始 2/4 通过、2/4 失败；实施后 4/4 通过。
- 新旧专业方法、导入四路由、目录与历史契约组合：26/26 通过。
- 全部 package-owned qualityReview、目录和路由组合：34/34 通过。
- 最终 `npm run check` exit 0：后端 3474 passed / 51 skipped / 0 failed；渲染层 86 files、606 tests 全绿；lint 与 renderer typecheck 通过。

## 5. 资格边界

本轮证明两个包能安装、路由不回退、首次答案复核合同可被通用运行时装配。它不能证明当前模型一定会在 RR04 首轮删除所有题外实现，也不能替代 ECI04/ECI05、真实预览、确认失效、导入失败、验证失败和反馈续作的现场结果。两位继续标记为“不合格/待复验”。

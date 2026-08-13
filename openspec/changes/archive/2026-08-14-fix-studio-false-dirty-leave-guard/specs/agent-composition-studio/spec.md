## MODIFIED Requirements

### Requirement: Unsaved studio drafts are protected

当编排草稿存在未保存修改时，返回货架、切换到另一条已保存工作流、切换工作台顶栏 Tab MUST 先请求确认。确认 MUST 提供「保存后离开」「放弃修改」「取消」三种结果：保存后离开 MUST 等价于执行保存流程（校验失败时留在原地），放弃修改 MUST 直接离开且丢弃草稿，取消 MUST 留在原地且草稿内容不变。草稿没有未保存修改时 MUST NOT 打断用户。

仅为在专业画布中渲染而把线性图归一化为自由图（补齐开始/结束节点与默认边）MUST NOT 单独将草稿标记为未保存。打开已保存工作流或空草稿后若用户未编辑，从货架再次点击「编辑」MUST NOT 出现离开确认。保存成功并回到货架后，内存草稿 MUST NOT 以未保存状态残留并阻断后续编辑入口。仅有开始/结束系统节点、没有业务节点的草稿，即便被误标 dirty，离开时 MUST NOT 弹出确认。

画布内联字段失焦、检查器同步在内容未变化时 MUST NOT 将草稿标记为未保存。检查器未挂载流程定义字段时 MUST NOT 把名称/目标/入出参同步为空。成功离开编排回到货架后 MUST 清空内存草稿，避免下一次货架「编辑」被幽灵脏状态打断。

#### Scenario: Leaving with unsaved changes

- **WHEN** 用户修改草稿后点击「返回货架」
- **THEN** 出现确认，提供保存后离开、放弃修改与取消

#### Scenario: Cancel keeps the draft intact

- **WHEN** 用户在离开确认中选择「取消」
- **THEN** 仍停留在编排页，草稿的步骤、参数与选择保持不变

#### Scenario: Clean draft does not prompt

- **WHEN** 草稿没有未保存修改且用户点击「返回货架」
- **THEN** 直接返回货架，不出现确认

#### Scenario: Canvas normalize does not mark dirty

- **WHEN** 用户打开一条已保存的线性工作流进入专业画布，且未改任何节点或边
- **THEN** 草稿不得显示为未保存
- **AND** 返回货架或再点另一张卡片的「编辑」不得出现离开确认

#### Scenario: Save clears dirty before shelf

- **WHEN** 用户保存工作流成功并回到货架
- **THEN** 内存中的编排草稿不得保持未保存状态
- **AND** 随后点击货架「编辑」不得因幽灵脏草稿弹出离开确认

#### Scenario: Noop inline edit does not mark dirty

- **WHEN** 用户聚焦画布内联字段后失焦，且字段内容未变化
- **THEN** 草稿不得被标记为未保存

#### Scenario: Leave to shelf clears memory draft

- **WHEN** 用户从编排成功返回货架（无未保存，或已保存/已放弃）
- **THEN** 内存编排草稿被清空
- **AND** 随后在货架点击另一张卡片的「编辑」不得出现离开确认

# 制作人体验验收: agent-kernel-executor-eval-baseline

## 验收视角

本 Story **对用户界面几乎零改动**；制作人从 C 端用户视角验收「行为保持」——对话、时间线、取消、错误提示与升级前一致。内核与 Eval 能力通过开发/测试证据验收。

## 核心路径

- [x] 打开办公助手 → 普通 chat「你好」→ 收到回复，时间线阶段正常更新
- [x] 发起 retrieval/工具类问题 → 时间线出现检索或工具卡片，最终有可读答复
- [x] 长生成过程中点击「停止」→ 显示已停止，可立即发送下一条（桌面未点到停止；Eval `cancel-mid-model` 补全，follow-up 桌面 PASS）
- [x] 未配置 API Key 时 → 仍显示清晰设置引导（Eval `error-no-api-key` 补全；桌面隔离复现受单实例干扰）

## 体验标准

- 无新增弹窗或打扰
- 时间线文案与图标风格与现有助手一致
- 停止生成后 composer 可立即继续使用
- 本 Story 不要求用户感知「内核」或「eval」

## 开发/测试证据（制作人核对）

- [x] `evidence/dev-self-test.md` 存在且记录 kernel/legacy 冒烟
- [x] `npm test` 含 agent eval 且 PASS（制作人可只看 harness gate 结果）
- [x] OpenSpec validate 通过

## 验收结论

- [x] 通过 / [ ] 不通过（原因：）
- 验收人：制作人
- 日期：2026-08-04

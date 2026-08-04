# 开发自测：silent-personalization-strengthen

## 范围

统一 Effective Personalization Packet；chat 轻对话保留短偏好；回复旁可解释「本轮沿用」。

## 验证

| 项 | 结果 |
|---|---|
| `buildEffectivePersonalization` 单测 | PASS |
| chat light personalization（orchestrator 既有用例） | PASS |
| 无勾选条 / 有 `renderPersonalizationMeta` | PASS（workspace-agent 静态断言） |
| `npm test` | PASS（763） |
| `npm run lint` | PASS |

## 手动体验要点（制作人）

1. 设置 → 填写协作偏好，或「我的记忆」接受一条习惯。
2. Agent 随便发一句；回复下方应出现「本轮沿用了 N 条习惯」，展开可见条目。
3. 清空偏好且无已确认习惯时，不应出现该行。
4. 输入框上方仍无记忆勾选芯片。

# Why
现有画布混合 Skill、LLM 和知识节点，无法表达稳定的动作契约、人工责任和显式交接。

# What Changes
- Capability Manifest v3 增加 Action Contract。
- Workflow Package v2 仅以 Agent、人、动作和控制节点进行新建。
- 边保存映射，发布固定版本且要求成功试运行证据。

# Impact
旧 v1 可读可运行；LLM/Knowledge 作为兼容节点只读，重新发布前升级。

# RQA38：内置专家更新时递归同步必需 Skill

日期：2026-09-07。范围：通用能力包生命周期，不包含任何专家 ID 分支；仅操作隔离 userData。

## 结论

内置专家更新现在会同步其声明的 bundled Skill 依赖：缺失的必需 Skill 自动安装，已安装且落后的必需/可选 Skill 升级；缺失的可选 Skill不自动安装；用户管理的同名 Skill 不覆盖；更高版本不降级；Connector 不安装、不授权。返回值公开 `dependencyUpdates` 与警告。

## 证据

- 红测：实现前首例 0/1。
- 实现后集成测试 4/4；与包/方法组合测试 24/24。
- 隔离真实运行时先后更新 action-owner、requirement-reviewer、qa-engineer，三套必需 Skill 自动从 1.1.0 升至 1.2.0，专家升至 2.3.0，快照 `issues=[]`。
- 后续 QA 方法迭代继续证明同一路径：qa-engineer 2.4.0/2.5.0 更新分别带动 qa-test-design 1.3.0/1.4.0，均无警告、快照无问题。

这只证明安装/更新闭环，不证明任何专家的专业能力。

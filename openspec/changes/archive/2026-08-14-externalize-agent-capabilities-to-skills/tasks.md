## 1. Skill 体验声明与标准兼容

- [x] 1.1 新增纯函数 Skill experience 校验/规范化模块，覆盖任务展示、preflight、工具依赖和安全模板字段
- [x] 1.2 扩展 Capability Manifest v2，仅保留已验证的 `metadata.knowme.experience`，legacy/标准 Skill 缺省为空
- [x] 1.3 扩展 Skill Runtime 扫描 Pack 来源并输出 enabled task DTO、issues 与内容 revision
- [x] 1.4 单测标准 Cursor/Claude Code Skill、有效扩展、无效扩展隔离、禁用/缺失来源和工具声明不注册工具

## 2. Capability Pack Skill 来源与生命周期

- [x] 2.1 扩展 Pack schema 保留 bundled capability catalog 声明，并区分 trusted bundled 与 imported 路径边界
- [x] 2.2 实现 Pack Skill source 解析、SKILL.md/sidecar 校验、内容哈希和重复 ID 诊断
- [x] 2.3 Pack install/enable/disable/uninstall 与 Skill task 可用性联动，legacy scene-only Pack 保持回退
- [x] 2.4 单测 catalog 越界、缺失 Skill、重复 ID、Pack 禁用和 legacy Pack 兼容

## 3. Main / preload 通用任务目录

- [x] 3.1 在主进程组合 Skill task 与 legacy scene adapter，返回 display-safe DTO、issues 和 revision
- [x] 3.2 增加最小只读 `skill-task-list` IPC/preload API，不向 Renderer 暴露路径、正文或脚本
- [x] 3.3 Capability Hub 列表映射 Pack-owned/extended Skill 的来源、依赖、工具和扩展告警
- [x] 3.4 单测 IPC DTO 最小化、disabled task 隐藏和 Pack-owned provenance

## 4. Renderer 数据驱动任务执行

- [x] 4.1 增加 task catalog 刷新与索引，动态任务优先、旧快捷常量作为安全回退
- [x] 4.2 空状态卡片和 Ctrl/Cmd+K 快捷菜单按 mode/surface/group 渲染同一 task identity
- [x] 4.3 将 preflight 改为消费声明式 connector-auth/material 配置，并保持暂存任务恢复
- [x] 4.4 `runAI` 支持独立 explicit Skill refs，任务激活加载 L1 且不污染用户可见 prompt
- [x] 4.5 实现 bounded 日期变量展开与 required tool 可用性阻断，不执行任意模板表达式

## 5. 现有办公能力 Skill 化

- [x] 5.1 创建 `feishu-related-chats` 与 `feishu-meeting-summary` 标准 Skill/sidecar，迁移工具、日期和输出契约
- [x] 5.2 创建 `feishu-today-priority` 与 `feishu-doc-kb` 标准 Skill/sidecar，迁移空事实与首轮候选契约
- [x] 5.3 创建需求文档、办公文档、提纲成稿和排版定稿四个标准 Skill/sidecar
- [x] 5.4 更新 game-studio Pack/scene Skill 引用和 catalog 声明，保持现有卡片标题、路由与 legacy mode
- [x] 5.5 回归验证动态 Skill 更新可改变入口/Prompt，同时 OAuth、Registry、审批和 grounding 仍由内核强制

## 6. 测试与开发自测

- [x] 6.1 新增 Skill-driven task runtime、Pack source、IPC 与 Renderer 静态契约测试
- [x] 6.2 扩充飞书四任务和写作四任务迁移前后行为回归，覆盖未授权、缺素材、0 事实和缺工具
- [x] 6.3 执行 OpenSpec strict validate、相关定向测试、`npm test` 与 `npm run lint`
- [x] 6.4 执行 Electron 冒烟，确认空状态、快捷菜单、Skill L1 注入和旧 fallback 可用
- [x] 6.5 写入 `evidence/dev-self-test.md`，仅在开发自测通过后提交制作人验收

## 7. 独立代码审查修复

- [x] 7.1 校验所有 Pack ID 并保证卸载路径始终位于 installed root 内
- [x] 7.2 将 Pack 复制/更新改为失败不登记、旧版本不丢失的事务流程
- [x] 7.3 bundled/imported Pack 统一执行原子依赖检查，生产接线提供完整可用能力清单
- [x] 7.4 将 task sidecar `requiredTools` 接入主进程 Registry/grounding 激活门禁
- [x] 7.5 修复跨来源重复 task ID 的确定性优先级、去重和诊断
- [x] 7.6 让 Pack-owned 写作动态任务驱动 writing 空状态，与快捷菜单保持同 identity
- [x] 7.7 按当前 task identity 解析 `requiredTools`，避免多 task Skill 依赖互相污染
- [x] 7.8 让无对应 scene 的 Pack-owned general task 进入 Pack 空状态分组
- [x] 7.9 为 Windows capability store 原子 rename 增加有限 EPERM 重试
- [x] 7.10 为 B1–B8 增加负例回归并重新执行自测、制作人验收、代码审查与 QA

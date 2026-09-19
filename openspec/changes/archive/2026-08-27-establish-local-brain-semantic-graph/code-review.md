# Code Review

## 结论

通过，无阻断项。

## 架构

- `brain-store.ts` 隐藏 JSON 物理布局，IPC 与 Renderer 只依赖共享 Brain DTO。
- 旧 Fabric 继续作为兼容检索/迁移来源；Agent 主入口已切换为 Brain Query。
- Provider Catalog 只保存脱敏元数据，RAGFlow Collection 仅同步目录级信息。

## 安全与隐私

- API Key 继续由现有安全存储加密，Brain Catalog 会移除明文密钥。
- 远程查询只发送脱敏后的问题和授权 Provider/Collection，不发送完整 Brain、Memory 或历史对话。
- 外部命中默认只存在 TTL cache；收藏保存引用，正文不进入长期 Brain。
- Agent Knowledge Policy 在本地范围、个人记忆、Provider 和 Collection 四个层面收敛权限。
- Agent 的 Brain 主查询与旧 `kbQuery`/`kbGet` 工具共用同一授权结果；空 Provider 授权不会退化成“允许全部”。
- Provider 查询遥测只保存脱敏查询哈希、命中数、状态与耗时，不保存原始问题。

## 数据完整性

- Brain 写入使用同目录临时文件替换并保留最后有效备份；损坏 JSON 可回退。
- 迁移 ID 稳定且可重复执行；旧数据不删除。
- 被移除的 Provider 节点保留历史并标记不可用，相关 Claim 失效且生成审核项。
- Growth Ledger 与 Brain 布局使用同目录临时文件替换、有效备份和失败恢复；布局输入限制为 1000 个有限坐标。
- `BrainStore.upsertClaim` 强制至少一项可解析 Evidence；查询图索引忽略无证据旧关系，迁移会将其标记失效。
- 文件夹与 GitLab Adapter 只从已授权 source binding 解析根目录，拒绝逃逸路径；正文不复制进 Provider Catalog 或 Brain。

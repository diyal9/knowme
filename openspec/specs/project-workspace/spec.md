# Spec: project-workspace

## 项目分组
- WHEN 工作台打开 THEN 左侧按项目分组：各 `project`、收藏、未分类（含计数）
- AND 文件显示名取自 `title`（空则回退正文首行 / 未命名）；`project` 仅表示所属项目
- WHEN 用户点击某项目分组 THEN 进入聚焦：文件树仅显示该项目下的文件；侧栏标题显示项目名，提供「返回全部项目」
- WHEN 项目下文件有版本链（parentNoteId）THEN 默认折叠为一条「最新版」行（文件名 + `vX`，不显示「N版」角标）
- WHEN 用户点击该行的 ▸ / 版本芯片 THEN 展开版本列表；子行仅显示 `vX` + 相对时间，不重复文件名
- WHEN 用户打开非最新版本 THEN 自动展开对应版本链，便于识别当前版本
- AND 版本链展开态与当前聚焦项目写入 `workspaceState`（`expandedChains` / `focusedProject`），重启后恢复

## category / title 迁移
- WHEN 旧数据 note 尚无 `title` 字段 THEN 将原 `project`（旧作标题）写入 `title`，并将有值的 `category` 写入 `project` 作为项目名后回存
- WHEN 旧数据已有 `title`，且 `category` 有值而 `project` 为空 THEN 将 `category` 值写入 `project` 并回存
- AND 迁移一次后不重复覆盖用户手动设置的 project / title

## 新建
- WHEN 用户在某项目下（含聚焦态）新建文件 THEN 新 note 的 `project` 预填为该项目
- WHEN 用户对某文件「新建版本」THEN 复用现有版本链逻辑（parentNoteId + version 递增）
- WHEN 用户重命名文件 THEN 更新 `title`，不改变所属 `project`
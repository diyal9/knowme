## Purpose

在代码工作区文件树中按任务变更状态着色，让用户像在 Git 集成 IDE 中一样一眼识别新增、修改与删除文件。

## ADDED Requirements

### Requirement: 变更文件 Git 风格着色

当任务存在变更文件列表时，代码工作区文件树 MUST 按文件变更状态为文件名着色：新增为成功绿、修改为警告黄/橙、删除为危险红；未知状态 MUST 保持中性色。着色 MUST 基于任务已有变更数据，MUST NOT 因着色失败而阻断浏览。

#### Scenario: 修改文件显示警告色

- **WHEN** 变更列表含某 path 且 status 为 modified（或等价标识），且该文件出现在树中
- **THEN** 该文件名以警告色显示

#### Scenario: 新增与删除可区分

- **WHEN** 树中同时存在 status 为 added 与 deleted 的文件
- **THEN** 二者颜色分别对应成功绿与危险红，互不相同

#### Scenario: 无变更数据时中性

- **WHEN** 任务无变更文件或变更数据不可用
- **THEN** 文件树文件名保持默认中性色，工作区仍可浏览

### Requirement: 含变更子项的目录提示

若某目录路径是任一变更文件的祖先路径，该目录名 SHOULD 有轻微「含变更」视觉提示（弱于文件状态色），便于展开定位。

#### Scenario: 父目录提示

- **WHEN** 变更文件位于 `server-src/pkg/fileutil/cache.go`，且树中展开显示 `pkg` 或 `fileutil` 目录
- **THEN** 对应目录节点呈现含变更提示样式

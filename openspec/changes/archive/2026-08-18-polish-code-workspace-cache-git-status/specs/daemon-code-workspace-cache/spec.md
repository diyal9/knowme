## Purpose

为管线任务代码工作区提供会话内 tree/blob 缓存，减少大文件与重复目录的重复拉取，并在刷新或关闭时诚实失效。

## ADDED Requirements

### Requirement: 会话内 blob 与 tree 缓存

代码工作区 MUST 在渲染进程缓存成功的 `workspace/tree` 与 `workspace/blob` 结果；同一任务 slug 下再次请求相同 path 时 MUST 优先使用缓存，MUST NOT 无故重复网络请求。缓存 MUST 仅存活于当前工作区会话，MUST NOT 持久化到磁盘。

#### Scenario: 二次打开同一文件走缓存

- **WHEN** 用户已成功预览某 path，且未触发缓存失效，再次点击同一文件
- **THEN** 界面立即展示缓存内容，且不发起新的 blob 网络请求

#### Scenario: 刷新清空缓存

- **WHEN** 用户点击工作区「刷新」
- **THEN** 系统清空 tree/blob 缓存并重新从 Daemon 拉取当前目录（及当前打开文件，若有）

#### Scenario: 关闭工作区释放缓存

- **WHEN** 用户关闭代码工作区
- **THEN** 系统清空缓存，下次打开须重新请求

### Requirement: 缓存体积上限

blob 缓存 MUST 限制条目数与合计内容体积；超出时 MUST 淘汰较旧条目。系统 MUST NOT 因缓存导致明显内存失控。

#### Scenario: 超出上限淘汰

- **WHEN** 缓存条目或合计体积超过上限
- **THEN** 系统移除最久未访问的条目后再写入新结果

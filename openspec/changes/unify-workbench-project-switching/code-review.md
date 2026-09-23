# Code Review: unify-workbench-project-switching

## 结论

通过。实现复用既有 Project Store 和 IPC，没有新增第二套项目状态或迁移数据。

## 核心复核

- 顶部切换器和项目侧栏共享 `activeProjectId`。
- 工作流只筛选运行历史，工作流目录仍为全局可复用资产。
- 管线仅接受明确的 KnowMe `projectId`，不混用远程工作区标识。
- missing/readonly/未选中项目均不能提交新管线任务。
- 项目归档调用既有安全生命周期，不删除工作目录或历史实体。

## 剩余风险

旧管线记录如果没有产品项目绑定，不会出现在“当前项目”范围，但仍可在“全部项目”中查看；这是避免错误归属的兼容选择。


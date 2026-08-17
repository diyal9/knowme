# list-home（delta）

## MODIFIED Requirements

便签总览窗退役。文件浏览在工作台文件树完成。

#### Scenario: List window is not loaded

- **WHEN** 应用启动
- **THEN** 不创建便签总览 BrowserWindow，也不加载 list 渲染入口

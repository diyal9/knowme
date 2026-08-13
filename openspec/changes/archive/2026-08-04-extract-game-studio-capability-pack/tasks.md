## 1. Capability Pack 契约

- [x] 1.1 实现版本化 pack manifest 校验并覆盖无效 id、版本和 schema
- [x] 1.2 实现 bundled / installed pack store、内容哈希与安全资源路径解析
- [x] 1.3 实现发现、安装、启用、禁用、卸载和第三方目录导入生命周期

## 2. Game Studio 能力包

- [x] 2.1 将游戏专家、技能、连接器、工作流、权限和知识种子声明为 `game-studio` pack
- [x] 2.2 将四个游戏场景、提示、空状态和需求 schema 放入 pack 资源
- [x] 2.3 接入场景解析、legacy mode 映射和 `industry=game` 幂等迁移

## 3. Electron 接入

- [x] 3.1 在主进程创建按需 capability pack runtime
- [x] 3.2 通过 preload 暴露最小 list/install/enable/disable/uninstall IPC
- [x] 3.3 让工作伙伴空状态与场景路由读取已启用能力包

## 4. 验证

- [x] 4.1 运行 capability pack 聚焦测试并修复契约偏差
- [x] 4.2 运行 OpenSpec strict validate，确认 proposal/spec/design/tasks 完整

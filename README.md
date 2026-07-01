# StickyNotes — 桌面便签

轻量、有设计感的 Windows 桌面便签工具，基于 Electron 构建。

## 快速启动

```bash
cd d:/aispace/sticky-notes
npm start
```

## 功能

- **多张便签**：每张便签独立窗口，无边框圆角，带阴影
- **颜色切换**：6 种配色，顶部色点点击切换
- **置顶开关**：📌 按钮，可临时取消置顶
- **拖拽移动**：拖动顶部工具栏移动便签
- **缩放大小**：拖动边角缩放
- **自动保存**：输入后 500ms 自动存盘，位置也会实时记录
- **启动恢复**：下次打开自动还原所有便签
- **系统托盘**：关闭按钮删除单张便签；应用驻托盘，右键菜单管理
- **全局热键**：`Ctrl+Alt+N` 随时新建便签

## 数据存储

| 数据 | 路径 |
|------|------|
| 便签卡片 | `%APPDATA%\sticky-notes\notes\*.json` |
| **产品 OKF 知识库** | `%APPDATA%\sticky-notes\knowledge\` |
| **产品使用记忆** | `%APPDATA%\sticky-notes\memory\` |

在 **设置 → 知识库与记忆** 可导入/导出 OKF 包。仓库内 `brain/` 仅用于 Cursor 智能体开发，不是用户数据。

## 目录结构

```
AGENTS.md          # 智能体仓库总纲（会话必读）
brain/             # 知识库 raw / wiki / knowledge(OKF) / memory
team/              # 宪章、角色、进化流程
openspec/          # OpenSpec 规格与变更
.cursor/           # Rules、Skills、Hooks、Harness、Agents
src/
  main.js          # Electron 主进程
  preload.js       # 安全桥接层
  note.html        # 便签窗口 UI
tests/             # 冒烟测试
```

## 智能体团队协作

三角色：**制作人 → 开发 → 测试**，OpenSpec OPSX + ReACT 自循环。

| 命令 | 作用 |
|------|------|
| `/start` | 仓库 onboarding |
| `/team-run` | ReACT 全自动循环 |
| `/role-producer` | 制作人：规划与验收 |
| `/role-developer` | 开发：实现与自测 |
| `/role-tester` | 测试：QA + 反模式 |
| `/gate-check` | Story 完成门禁 |
| `/story-done` | 归档 change |
| `/opsx:propose` | OpenSpec 规划 |

Harness：

```bash
npm run harness:preflight   # 会话前
npm run harness:gate        # Story 完成硬门禁
```

详见 [AGENTS.md](AGENTS.md)。

## 知识库与自我进化

基于 [Karpathy LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) + [OKF v0.1](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)：

| 命令 | 作用 |
|------|------|
| `/kb-ingest` | 吸收资料 → wiki + OKF knowledge |
| `/kb-lint` | 知识库健康检查 |
| `/kb-export` | 导出 OKF bundle 给其他用户 |
| `/kb-import` | 导入外部 OKF bundle |
| `/evolve` | 自我进化 / Skill 升格 |

```bash
npm run kb:lint
npm run kb:export    # → dist/kb-export/
npm run kb:import -- <path>
npm run memory:path      # 个人记忆根目录
```

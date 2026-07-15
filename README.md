# Sticky-Notes — AI 驱动的本地 Markdown 笔记本

轻量、本地私有的 **Markdown 笔记应用**，基于 Electron 构建：Markdown 为核心文档格式，内置版本迭代、OKF 知识库、AI 助写与使用记忆；提示词优化与管理是其中一项能力。

## 下载与安装

**推荐从 GitHub Release 获取安装包**（勿使用开发者本地 `dist/` 路径）：

| 平台 | 状态 | 下载 |
|------|------|------|
| Windows x64 | **正式支持** | [Releases](https://github.com/diyal9/sticky-notes/releases/latest) |
| macOS | 实验构建，需自行评估风险 | 同上（见 Release notes 中的 Mac 说明） |

### Windows 安装步骤

1. 下载 `Sticky-Notes-<version>-setup-win-x64.exe`（安装版）或 `Sticky-Notes-<version>-portable-win-x64.exe`（便携版）。
2. （可选）用 Release 附带的 `SHA256SUMS.txt` 校验安装包哈希。
3. 运行安装程序；便携版解压后直接运行 exe。
4. 首次启动后可在系统托盘找到 Sticky-Notes；`Ctrl+Alt+N` 新建便签。

### 未签名安装包提示

当前 Release 可能**未进行代码签名**。Windows SmartScreen 可能显示「未知发布者」——这是未签名开源软件的常见提示，不代表文件被篡改。请从上述 GitHub Releases 官方页面下载，并可用 SHA256 校验完整性。有签名证书的版本会在 Release notes 中注明。

## 数据存储与备份

| 数据 | 路径（Windows） |
|------|-----------------|
| 便签卡片 | `%APPDATA%\sticky-notes\notes\*.json` |
| 应用设置 | `%APPDATA%\sticky-notes\settings.json` |
| **产品 OKF 知识库** | `%APPDATA%\sticky-notes\knowledge\` |
| **产品使用记忆** | `%APPDATA%\sticky-notes\memory\` |

- **便签备份**：设置 → 导出便签备份，可迁移到其他机器。
- **知识库**：设置 → 知识库与记忆 → 导入/导出 OKF 包。
- 卸载应用**不会**自动删除上述数据；换机前请先备份。

仓库内 `brain/` 仅用于 Cursor 智能体开发，**不是**用户数据目录。

## 隐私

本地优先、默认无云同步。详见 [PRIVACY.md](PRIVACY.md)。

## 检查更新

正式安装版：设置 → **检查更新**（对接 GitHub Release）。开发模式（`npm start`）不支持检查更新。

## 开发者快速启动

```bash
git clone https://github.com/diyal9/sticky-notes.git
cd sticky-notes
npm install
npm start
```

构建 Windows 安装包：`npm run build:win`（产物在 `dist/`）。

## 功能

- **多张便签**：每张便签独立窗口，无边框圆角，带阴影
- **颜色切换**：6 种配色，顶部色点点击切换
- **置顶开关**：📌 按钮，可临时取消置顶
- **拖拽移动**：拖动顶部工具栏移动便签
- **缩放大小**：拖动边角缩放
- **自动保存**：输入后 500ms 自动存盘，位置也会实时记录
- **启动恢复**：下次打开自动还原所有便签
- **系统托盘**：关闭窗口仅隐藏便签；删除需点 🗑 并确认；应用驻托盘，右键菜单管理
- **全局热键**：`Ctrl+Alt+N` 随时新建便签

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
LICENSE            # MIT
PRIVACY.md         # 隐私说明
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

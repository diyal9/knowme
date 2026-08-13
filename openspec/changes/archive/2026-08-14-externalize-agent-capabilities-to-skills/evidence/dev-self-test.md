# 开发自测报告

- 日期：2026-08-06
- Change：`externalize-agent-capabilities-to-skills`（tasks 1.1–7.7）
- OpenSpec strict validate：PASS
- Skill/Pack 审查负例回归：PASS（57/57）
- Windows capability store / connector 回归：PASS（20/20）
- `npm test`：PASS（1179/1179）
- `npm run lint`：PASS（`lint ok`、`script-scope ok`）
- Electron 隔离冒烟：PASS（15/15、Renderer console 0 error）
- Harness Story 完成门禁：PASS（hard test/lint 均通过）

## 覆盖结果

- 标准兼容：Skill 主体仍为 Cursor/Claude Code 可发现的 `SKILL.md`；KnowMe 体验声明位于可选 `capability.manifest.json` sidecar，缺省或无效扩展不会破坏标准 Skill。
- 运行时：Pack/managed/linked/legacy Skill 来源可统一发现；动态 task DTO 不暴露路径、正文、脚本或凭据字段。
- UI：空状态和快捷菜单由同一 Skill task catalog 驱动；显式 `skillRefs` 可加载 L1，用户可见 prompt 不需要 slash 命令。
- 兼容回退：动态任务不可用时仍保留 scene-only/旧快捷入口；Pack 禁用后对应动态任务隐藏。
- 安全：OAuth、工具 Registry、审批和 grounding 继续由主进程强制；模板只展开 allowlist 内的有界日期字段。
- 迁移：飞书聊天、会议、今日优先级、文档知识库及四项写作能力均已迁为标准 Skill。
- 未授权验证：关闭飞书连接器后点击“分析跟我相关的聊天”，仅显示固定授权提示且未启动生成。
- 独立审查修复：非法 Pack ID 无法越界删除；复制失败保留旧版本且不登记残包；bundled Pack 不再绕过依赖；sidecar `requiredTools` 进入主进程工具面阻断；跨来源 task ID 确定性去重并告警。
- task 级门禁：主进程按可信 task identity 重新解析当前任务的 `requiredTools`，同一 Skill 的其它 task 不会造成误阻断。
- 通用空状态：没有 legacy scene 的 Pack-owned `todayPriority` 仍会按声明出现在 general empty surface。
- Windows 稳定性：capability store 原子 rename 对 `EPERM/EACCES/EBUSY` 做有限重试，避免杀毒/索引瞬时锁导致连接器状态写入失败。
- 写作验证：从真实 UI 切换到写作模式后，四个空状态入口均来自 Pack-owned Skill task，不再退回 legacy 常量。

## 证据

- `skill-driven-electron-smoke.json`
- `skill-driven-electron-smoke.js`
- `screenshots/skill-driven-office-home.png`
- `screenshots/skill-driven-auth-preflight.png`
- `screenshots/skill-driven-writing-empty.png`

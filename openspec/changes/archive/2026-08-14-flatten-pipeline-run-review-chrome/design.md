## Context

见 proposal。现有 daemon 审阅面叠在 `.wb-run-shell` 渐变底 + `.wb-runner` + `.wb-daemon-review` + tip/progress 卡片上；顶栏 `wbStartTitle` / `wbRecentNote` / `wbRunnerTitle` / `审阅 制品` 可能同显工作流名。代码工作区动作为 stub toast。

## Goals / Non-Goals

**Goals:** 扁平化、标题唯一、字阶收敛、工作区入口诚实。  
**Non-Goals:** 新 IPC；重做 Tab 信息架构。

## Decisions

1. **运行壳背景改白/浅灰，去掉渐变米色**  
   与侧栏 `wb-side-panel` 同属「白卡 + 细边」体系。

2. **daemon 审阅态隐藏 `.wb-runner-head`；删除/降级「审阅 制品」大标题**  
   顶栏已承载身份；审阅区直接从 Tab 开始。

3. **`wbRecentNote` 在 running 阶段写节点进度摘要，禁止与标题同文重复**  
   空则隐藏副行。

4. **代码工作区**  
   优先 `workbenchDaemonArtifactOpen` 打开首个本地制品路径；否则禁用/隐藏按钮。不再 stub toast + 强制切 changes。

## Risks / Trade-offs

- [Risk] 用户期待打开 GitLab Web → Mitigation：本轮只保证本地路径；无路径时隐藏，避免假承诺。

## Migration Plan

无数据迁移。回滚 CSS/HTML/JS 即可。

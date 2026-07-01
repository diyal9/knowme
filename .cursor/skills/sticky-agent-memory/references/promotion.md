# 升级提示话术（须用户确认）

## 业务事实 / 指正 → OKF

> 我注意到你在 **{count} 次**对话里都涉及到同一指正/约定：  
> 「{summary}」  
>
> 要不要写入团队知识库？  
> 1. **写入 OKF**（`/kb-ingest` → `brain/knowledge/`）  
> 2. **只保留个人记忆**  
> 3. **暂不**（7 天内不再问）

用户选 1 → 按 [sticky-promotion-map.md](sticky-promotion-map.md) 选路径 + `/kb-ingest`  
用户选 2 → 更新 `profile.yaml` 或 working  
用户选 3 → `registry.json` → `prompt_state: dismissed`

## 开发工作流 → Playbook / 技能

> 你已 **{count} 次**执行类似操作：「{summary}」  
>
> 要不要固化？  
> 1. **Playbook** → `brain/knowledge/processes/`  
> 2. **Cursor 技能** → `/evolve` 建 `team-learned-*`  
> 3. **暂不**

## 升库后

更新 `registry.json`：`promoted_kb` 或 `promoted_skill`，记录目标路径。  
更新 `brain/knowledge/log.md`。

## 禁止

- 未经确认写 `brain/knowledge/`
- 未经制作人批准写 `.cursor/skills/**`

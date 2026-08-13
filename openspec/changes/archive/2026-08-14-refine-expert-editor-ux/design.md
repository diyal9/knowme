## Context

专家编辑已在 `polish-expert-editor-dialog` 中完成分组与卡片多选；头像预设来自 `add-expert-preset-avatars`。当前问题集中在渲染层：原生 `<select>` 无选项分隔、`.hub-field input` 把 checkbox 撑满整行、头像网格占高、Skills 长列表把主表单压窄。全部发生在能力 Hub 渲染进程，不经过 IPC。

## Goals / Non-Goals

**Goals:**
- 把目录多选抽到 `src/lib/catalog-picker.js`，专家编辑用二级弹窗消费
- 用自定义下拉替代 AgenticType 原生 select，选项间画分隔线
- 头像改为单行 overflow-x 滚动；自动匹配只在未手动选择时静默发生
- 放大 `.hub-expert-dialog`，不改通用导入弹窗尺寸

**Non-Goals:**
- 不改 `expertSave` / agent profile payload
- 不把 picker 接到工作台其它页面（本次只落地 Hub，组件可复用）
- 不改预设头像资源

## Decisions

1. **Catalog Picker 独立模块**  
   与 `ui-kit.js` / `capability-hub-icons.js` 一样用 IIFE + `module.exports` + `window.CatalogPicker`。渲染进程 `<script>` 加载，Node 单测 `require`。  
   备选：继续把 HTML 拼在 `capability-hub.js` —— 无法被其它入口复用，也不满足「封装组件」。

2. **主表单只留摘要，目录在二级 mask 弹窗确认**  
   打开 picker 时复制当前已选；点「完成」才写回 `state.expertEditor` 与摘要。取消不改草稿。  
   备选：主表单继续内嵌网格 —— 与「弹窗处理 / 界面更大」冲突。

3. **AgenticType 自定义 listbox，隐藏 input 保留 `#hubExpertAgenticType`**  
   现有 `readAgenticConfigFromForm` / change 监听仍读该节点。选项之间用 `.hub-select-sep` 横线。  
   备选：原生 `<select>` 插 `<hr>` —— Chromium 支持但不稳定、Win32 系统皮肤难与 KnowMe 对齐。

4. **Checkbox 用 `.hub-flag` 覆盖 `.hub-field input` 全宽规则**  
   根因是 `.hub-field input { width:100%; min-height:38px }`。Agentic 布尔项改用与 `.hub-check-box` 相同的自定义勾，文字同行。

5. **头像横滑 + 去掉匹配 CTA**  
   保留 `autoMatchExpertAvatar()` 在名称/职责/Skill 变化且 `avatarManual === false` 时调用。创建时 `suggestExpertAvatarKey` 写入默认选中。

6. **IPC 边界**  
   无新通道。保存仍走既有 `expert.save` / `agentProfileSave`。跳转技能页只切 Hub 内部 tab。

## Risks / Trade-offs

- [二级弹窗挡主编辑] → picker mask z-index 高于 expert dialog；Esc 先关 picker。
- [空 Skill 跳转丢失未保存表单] → 「去安装技能」只切 tab 并关闭 picker/编辑器前先把草稿留在 `state.expertEditor` 不够（关编辑器会清空）。改为关闭 picker、保持编辑器打开，并 toast 提示「安装完成后回到此窗口点选择」。若用户坚持离开，取消编辑才丢草稿。
- [测试静态契约绑死 `editorPickerGroup`] → 同步改 `tests/capability-hub.test.js` 指向 CatalogPicker 与新 DOM 契约。

## Migration

无需数据迁移。已保存专家的 avatar / skills / agenticType 原样加载。

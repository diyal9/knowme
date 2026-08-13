## Why

能力 Hub 的「全部专家」里，内置专家显示「办公伙伴」「游戏工作室伙伴」，从 Cursor 仓库导入的专家却显示 `artbundle-expert`、`ui-expert`、`rdpi-config-assistant`、`th-bi-analytics-assistant` 这类英文 slug。原因是导入时直接把 `AGENT.md` / `SKILL.md` frontmatter 的 `name`（工程标识）当成了展示名，而这些源文件的中文身份写在 `description` 与 `persona.role` 里。

对 C 端用户来说，同一张目录里一半中文一半英文标识，既难扫读也难判断这位专家是干什么的；`th-bi-analytics-assistant` 这种名字还会和技能 ID 混淆。

## What Changes

- 新增专家展示名推导：从源信息按优先级推导中文名——已含中文的 `name` → `persona.role` → `description` 的中文标题段（先剥离「中文：/English：」这类语种前缀与括注）→ 推导不出时保留原名。
- Cursor 仓库导入（含由技能生成的仓库专家）在扫描与注册时使用推导出的中文名作为展示名，并保留原 slug 为 `originName`。
- 用户在专家编辑弹窗改名后，改名结果同步写入 install store 与 catalog overlay，并标记为用户命名；重新扫描 / 更新同一仓库时 MUST NOT 覆盖用户改过的名字。
- 已导入的存量专家在能力服务初始化时做一次幂等回填：名字不含中文且未被用户改过的，按同一套规则补上中文名。
- 能力 Hub 卡片标题显示中文名，原 slug 降级到卡片副标题与详情抽屉的元信息里，仍可查、可搜索。

### 目标用户

- 从 Cursor 仓库导入自有专家、在能力 Hub 与工作台里挑选专家的 KnowMe 使用者。

### 验收标准

- 「全部专家」列表中，导入自 Cursor 仓库的专家显示中文名（如「ArtBundle 专家」「UI 专家」「RDPI 配置协作」）。
- 源信息里推导不出中文名时保留原名展示，不出现空标题或机器拼接的怪名。
- 卡片副标题与详情抽屉可以看到原始标识（slug），搜索原 slug 仍能命中该专家。
- 在专家编辑弹窗改名并保存后，卡片标题立即变为新名字；重新扫描导入同一仓库后名字不被改回。
- 已经导入过的存量专家，升级后首次打开能力 Hub 即显示中文名，无需重新导入。

### 非目标（Non-goals）

- 不调用模型翻译，不联网；推导只使用包内已有的中文信息。
- 不改专家 ID、调用标识与 slash 触发方式。
- 不改技能与连接器的命名展示。
- 不为专家新增头像、模型等字段。

## Capabilities

### Modified Capabilities

- `cursor-repository-capability-import`: 补充导入时的中文展示名推导、`originName` 保留与用户改名保护要求。
- `capability-hub`: 补充专家卡片以中文名为标题、原始标识降级展示的要求。
- `expert-runtime`: 补充展示名与原始标识的持久化字段要求。

## Impact

- 新增 `src/lib/expert-display-name.js`（纯函数推导）。
- 影响 `src/lib/cursor-capability-repository.js`（扫描与注册）、`src/lib/capability-hub-service.js`（改名同步、存量回填、列表映射）、`src/lib/expert-runtime.js`（`originName` 字段）、`src/capability-hub.js`（卡片与抽屉展示）。
- 影响用户数据：`capabilities/install-store.json`、`capabilities/catalog-overlay.json` 与 `capabilities/experts/*/EXPERT.md` 的 `name` 字段会被回填一次，回填幂等且保留原 slug。
- 体验价值：能力目录从「一半英文 slug」变成统一中文身份，扫读与选择成本下降。

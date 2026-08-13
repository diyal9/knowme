## Why

技能 Hub 的分类 chip 与卡片真实分类不一致：精选里大量「游戏」技能无法筛选，而「飞书」是连接器维度、多数飞书 skill 实际标成「能力包」，点「飞书」往往空结果。「效率」也缺少对应条目。需要按工作域对齐筛选，提升发现效率。

## What Changes

- 技能分类 chip 调整为：`全部 · 写作 · 游戏 · 研发 · 办公`（移除「飞书」「效率」）
- 目录与能力包派生的技能主分类对齐工作域（如「开发」→「研发」、飞书协作 skill →「办公」）
- 连接器 Tab 仍保留「飞书」筛选；技能页不再设专用飞书标签
- 更新 capability-hub 规格中的分类筛选约定

## Capabilities

### New Capabilities

- （无）

### Modified Capabilities

- `capability-hub`: 技能分类筛选维度改为工作域（写作/游戏/研发/办公），并与卡片主分类一致

## Impact

- `src/capability-hub.js`（chip 列表与筛选匹配）
- `src/lib/capability-hub-service.js`（能力包 skill 主分类推断）
- `src/catalog/catalog.json`（精选 skill 分类）
- 测试与自测证据

## 目标用户

在能力 Hub 浏览/安装技能的桌面端用户（含游戏工作室与办公协作场景）。

## 验收标准

1. 技能 Tab 分类 chip 为：全部、写作、游戏、研发、办公；无「飞书」「效率」
2. 点「游戏」能看到游戏精选技能；点「办公」能看到飞书协作类已安装 skill；点「研发」能看到代码审查等研发 skill
3. MCP 连接器 Tab 仍可用「飞书」筛选连接器
4. `npm test` / `npm run lint` 通过

## 非目标（Non-goals）

- 不改连接器/专家 Tab 的既有分类（专家仍含办公等）
- 不引入「能力包」作为顶层筛选维度
- 不重构能力包安装/生命周期

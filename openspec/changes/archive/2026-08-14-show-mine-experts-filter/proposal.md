## Why

用户在专家库「新建专家」保存后，卡片常不出现在列表，也没有按「我创建的」归类的入口，导致自建专家无法被找回与管理。

### 目标用户

- 在能力 Hub / 专家库创建与管理自建专家的用户
- 从精选专家「复制为自建」后需要集中查看副本的用户

### 验收标准

- 「按场景浏览」专家芯片在场景类目后包含 **「我的」**
- 点击「我的」仅展示用户自建/导入的专家（非 curated/pack/official 精选）
- 新建/保存专家后写入能力目录（install store + overlay），刷新后可见
- 保存成功后自动切到「我的」并打开详情
- 历史仅落盘未进目录的 EXPERT.md 也会在列表中合并显示

### 非目标（Non-goals）

- 不新增专家属性字段（如 ownership 表）
- 不改场景类目划分（办公/写作/研发/知识）
- 不改安装/卸载精选专家流程

## What Changes

- 专家 tab chips 增加「我的」；筛选按 `source ∈ {local, custom, zip, https, local-repo}` 判定
- `expert-save` 成功后登记 install store + catalog overlay
- `listCapabilities` 合并 filesystem 上未登记的自建专家
- Hub 保存后切筛选到「我的」

## Capabilities

### New Capabilities

- `expert-library-mine-filter`: 专家库「我的」筛选与自建专家入目录。

### Modified Capabilities

- （无 delta 至主 specs 要求；变更以 Hub 行为为准）

## Impact

- `src/capability-hub.js`
- `src/lib/capability-hub-service.js`
- 测试：`tests/capability-hub.test.js`、`tests/capability-integration.test.js`

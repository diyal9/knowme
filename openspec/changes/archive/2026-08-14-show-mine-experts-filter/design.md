## Context

能力 Hub 专家列表来自 `listCapabilities` → `listCatalog`（bundled + overlay + install store）。`expert-save` 此前只写 `EXPERT.md`，未登记目录，导致新建专家「消失」。场景芯片仅匹配 `category`，无法覆盖来源维度。

## Goals / Non-Goals

- Goals：自建专家可见可筛；修复保存未入目录；不破坏精选来源
- Non-Goals：新 ownership 模型；跨设备同步

## Decisions

1. **「我的」是筛选器而非分类字段**  
   用 `isLocalExpert(source)` 判断，避免覆盖用户已有 `categories`。

2. **保存即发布**  
   `publishSavedExpert` 写入 install store（enabled）与 overlay；已为 curated/pack/official 的条目保留原 source，禁止误降级。

3. **列表回填**  
   `listCapabilities` 合并 `listExperts()` 中未见 id，修复历史孤儿专家。

4. **保存后 UX**  
   切到「我的」并打开详情，降低「刚建完找不到」的挫败。

## Risks / Trade-offs

- 调优精选会在该专家包目录上就地改写；仍保留 curated source，不进入「我的」（副本才进）。

## Migration

无需迁移脚本；列表回填即时生效。

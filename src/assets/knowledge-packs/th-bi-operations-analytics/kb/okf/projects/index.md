# Projects

多游戏 / 多项目时，按 slug 分域放置项目专属 Concept。

```
projects/
└── <game_slug>/
    ├── index.md
    ├── filter-registry.md    # Filter Slot → 字段绑定（多项目澄清）
    ├── metric-implementation.md
    ├── analytics-readiness.md
    ├── semantic/             # 可选
    └── behavioral/           # 可选
```

frontmatter 中 `project_id` 应与盘古项目 ID 一致。

## 已接入

| slug | 盘古 ID | TE ID | Filter Registry |
|------|---------|-------|-----------------|
| [temperedheroes](./temperedheroes/) | 69 | 101 | [✅ filter-registry](./temperedheroes/filter-registry.md) |
| [fingertipff](./fingertipff/) | 82 | 249 | [✅ filter-registry](./fingertipff/filter-registry.md) |

多项目并存 SOP：[multi-project-operating-guide](../synthesis/multi-project-operating-guide.md) · 字段对照：[ff-vs-temperedheroes-field-diff](../synthesis/ff-vs-temperedheroes-field-diff.md)

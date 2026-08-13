# Dev self-test — polish-pipeline-service-console

Date: 2026-08-11 (v2 layout densify)

## Changes

### v1
- 去掉与顶栏「管线服务」Tab 重复的页头标题
- 操作台：连接条 → 路径 → 开工台 → 运行

### v2（文字降噪 + 排版）
- **滤掉** Daemon 目录长文（含 `->` / 选型）上屏；产物用短标签
- 检查项改为四字格：连接 / 路径 / 需求 / 材料（状态靠色块，不拼「·待补」）
- 去掉中栏说明书段落与「材料可后补」提示墙；仅不可开工时短提示
- 右栏运行改为单行：`徽章 | 标题 | 动作`，去掉每条「查看失败原因」刷屏
- 连接条扁平化；阶段改为等分轨道；筛选缩写为 全部/待办/进行/完成

## Checks

| Check | Result |
|---|---|
| `node --test tests/workbench-daemon-surface.test.js` | 通过（含技术长文过滤用例） |
| `npm run lint` | 通过 |
| `npm test` | 1662/1663：`workspace-agent` launch docking 断言失败为无关用例（未改 Agent composer） |

## Manual smoke

1. 管线服务中栏只见路径名 + 开工，无长串技术说明
2. 就绪四格状态，悬停才见细节
3. 运行列表一排一条，待办才显示右侧短动作
4. 连接 host 用 monospaced 短写（127.0.0.1:8010）

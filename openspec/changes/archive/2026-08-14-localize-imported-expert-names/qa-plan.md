## Smoke Scope

- 能力 Hub「全部专家」列表：导入自 Cursor 仓库的专家显示中文名，内置专家不受影响。
- 卡片副标题与详情抽屉能看到原始标识（slug）。
- 搜索原 slug 仍能命中对应专家。
- 专家编辑改名保存后卡片标题即时更新。
- 重新扫描导入同一仓库后，用户改过的名字不被覆盖。
- 重启应用后名字稳定，专家包不被重复改写。

## 反模式检查

- 推导不出中文名时是否出现空标题、音译或机器拼接的怪名。
- 中文名是否过长撑破卡片标题（20 字上限与省略号）。
- 描述里带「中文：/English：」双语前缀的包，是否把「中文」当成了名字。
- 改名后工作台、对话标题等其他入口是否仍显示旧英文名。
- 回填是否在每次启动都写盘（观察文件修改时间）。

## Evidence

- 单测与 lint：`openspec/changes/localize-imported-expert-names/evidence/dev-self-test.md`
- 截图：`openspec/changes/localize-imported-expert-names/evidence/screenshots/`

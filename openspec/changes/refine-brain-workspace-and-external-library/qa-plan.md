# QA Plan：Brain 工作区与外部知识库

## 覆盖范围

1. 岗位分类模板的初始化、升级与岗位切换。
2. 模板和外挂知识不污染本地认知统计与检索。
3. Brain 默认折叠布局、星图/归类切换、详情与关系链。
4. 外部 Provider 选择、默认源、Collection 授权、同步与断开。
5. 旧数据迁移幂等性与外部正文不导入边界。

## 自动化策略

- Node 单测验证 BrainStore、taxonomy、迁移、联邦查询和权限。
- Vitest 验证前端折叠状态、空分类、Provider 管理交互。
- Playwright 在 1280×800 真实 Chromium 中走 Brain、资料和来源核心路径并留存截图。
- TypeScript、OpenSpec strict 与 migration audit 作为结构门禁。

## Smoke Scope

- [x] 1280×800 默认紧凑 Brain 首页与星图可见。
- [x] 岗位归类视图显示八类稳定社区。
- [x] 外挂 LLM Wiki 与 RAGFlow 只显示为外围知识入口。
- [x] 外部知识库管理页可浏览目录并切换 Collection 授权。
- [x] Brain 图谱、资料视图和来源页之间可往返，浏览器无运行时错误。

## 回归风险

- 岗位设置变化不应删除用户真实认知。
- taxonomy 节点不应被自然语言查询返回。
- Provider 卡片点击不得等价于“设为默认”。
- 外部命中不得写入 Brain 正文或增加“已理解”统计。

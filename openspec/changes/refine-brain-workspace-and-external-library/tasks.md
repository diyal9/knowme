## Role taxonomy

- [x] 实现岗位分类模板、版本签名、Evidence-backed 节点和关系
- [x] 岗位变化时幂等替换模板并保留真实认知
- [x] 从 Brain Query 和理解统计中排除分类模板
- [x] Renderer 使用模板进行固定归类并支持空分类

## Product surface

- [x] 默认收起 Brain 筛选和详情面板
- [x] 增加紧凑的筛选、详情控制和可关闭 Inspector
- [x] 重做外部知识库管理台
- [x] 分离 Provider 选择与默认知识源切换
- [x] 支持目录刷新、Collection 授权、连接编辑与断开

## Verification

- [x] Brain taxonomy 单元测试
- [x] Renderer 分类、折叠布局与 RAGFlow 管理测试
- [x] Playwright 真实布局、来源管理和零错误截图
- [ ] `npm run check`（主进程、lint、知识页与类型检查通过；被 3 个非本 change 的 Renderer 失败阻塞）
- [x] OpenSpec strict validation
- [ ] Harness gate（被 2 个非本 change 的专家工作台/能力中心 Renderer 失败阻塞）
- [x] 制作人验收、测试 QA 和代码审查

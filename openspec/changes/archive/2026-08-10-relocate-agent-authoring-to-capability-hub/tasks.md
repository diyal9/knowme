## 0. 治理与迁移映射（动代码前填完）

- [x] 0.1 在 `add-workbench-work-mode-tabs/proposal.md` 顶部加 superseded 标注（两 Tab 主张被取代）
- [x] 0.2 确认 Agent 能力迁移无遗漏映射表：创建/编辑/调优→能力界面；节点候选→Agent store；助理"我的专家"→只读；个人工作流→单一货架

## 1. 能力界面：Agent 创建/编辑/调优

- [x] 1.1 专家页新增「新建自建 Agent」表单（persona / Skill / 知识库范围 / Tool）
- [x] 1.2 专家卡片「调优」在能力界面内配置并持久化
- [x] 1.3 官方(curated)只读 + 「复制为自建」再调优
- [x] 1.4 去 `MOCK_CATALOG`，专家目录接真实本地 + 官方种子数据
- [x] 1.5 安装/自建写入统一 Agent store，供工作台编排消费

## 2. 工作台：撤 Tab 回单一货架

- [x] 2.1 移除 `#wbModeTabs` 与 `activeWorkMode`/两 Tab 路由，默认落地单一货架
- [x] 2.2 `shelfItems()` 单一货架混排全部来源，卡片计算「团队/我的」标签
- [x] 2.3 领域筛选保留、默认全部
- [x] 2.4 旧存档 `activeWorkMode` / `shelfSource` 值安全忽略

## 3. 工作台：编排升为一级动作

- [x] 3.1 货架「新建工作流」入口进入编排；个人工作流卡片「编辑」进入编排
- [x] 3.2 编排节点候选读能力界面 Agent store
- [x] 3.3 编排节点检查器裁剪为仅步骤目标/角色，移除 Agent 本体 Skill/知识/Tool 配置项
- [x] 3.4 编排保存回流：工作流以「我的」标签即时进货架

## 4. 移除工作台 Agent 编辑 + 收敛入口

- [x] 4.1 撤销管理抽屉「智能体管理」面板与 `wbAgentManagerForm` 相关 DOM/逻辑
- [x] 4.2 管理抽屉收敛为执行后端 + 自动化两面板
- [x] 4.3 工作台内指向 Agent 创建/编辑/调优的入口改为跳转能力界面
- [x] 4.4 助理「我的专家」改只读消费，移除增删改路径

## 5. 样式

- [x] 5.1 删两 Tab、智能体面板、失效选择器
- [x] 5.2 货架来源标签样式；能力界面 Agent 表单样式；窄窗(760px)适配

## 6. 验证与证据

- [x] 6.1 更新 `tests/workbench-templates.test.js` 与能力 hub 相关测试
- [x] 6.2 更新 Electron 冒烟：无 Tab 单一货架、标签、编排回流、抽屉两面板、能力界面新建/调优、安装后进节点候选
- [x] 6.3 `npm test` 全绿
- [x] 6.4 `npm run lint` 无 error
- [x] 6.5 `npx openspec validate relocate-agent-authoring-to-capability-hub --strict` 通过
- [x] 6.6 Electron 实机自测：零报错，截图工作台单一货架、编排、管理抽屉、能力界面 Agent 表单
- [x] 6.7 写 `evidence/dev-self-test.md`

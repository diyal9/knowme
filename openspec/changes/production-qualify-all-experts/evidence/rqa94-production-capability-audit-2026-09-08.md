# RQA94 — 生产能力包审计与依赖分层

日期：2026-09-08

## 目标

为通用 KnowMe runtime 建立一条可重复的能力审计入口，分别核对能力目录、安装状态、Skill L1、grounding 契约、专家会话快照、工作台绑定和任务目录；审计结果不能把“能加载”误报成“能真实生产执行”。

## 实现

- 新增 `npm run audit:production-capabilities`，自动加载 TypeScript runtime 注册器。
- 支持 `--user-data <dir>`，支持在隔离 user-data 下审计或 `--apply` 安装目录能力并绑定当前工作台；不默认写入生产 `%APPDATA%`。
- 手动触发型 Skill 用 `explicit-user` 方式校验 L1，不再把“禁止模型自动调用”误报为加载失败；报告同时保留 `modelInvocationAllowed` 和 `invocationMode`。
- 未安装能力不伪造 L1/grounding 通过，明确记录 `not_installed`；专家快照仍单独报告 `degraded` 及缺失依赖。
- 普通审计模式用于诊断并保持退出码 0；增加 `--strict` 门禁后，当前隔离环境因 4 个未安装 Skill、2 个降级专家返回退出码 2，避免被 CI/发布误判为生产就绪。

## 隔离审计结果

命令：

```text
npm run audit:production-capabilities -- --user-data .tmp/production-capability-audit --apply
```

- 目录清单：6 个专家、41 个 Skill。
- 安装并启用：37/41 个 Skill；6/6 个专家；6/6 个专家完成会话快照；6 个专家完成工作台绑定。
- 已安装 Skill：37/37 可加载 L1，37/37 grounding 契约通过；其中 6 个仅允许用户显式触发，35 个可由模型或用户触发（统计按已安装/目录记录交叉核对）。
- 未安装 Skill：4 个飞书 Skill，统一因缺少 `feishu` 连接器而被依赖门禁阻断；没有伪造安装成功。
- 专家能力状态：产品经理、软件开发工程师、数据分析师、研究分析师快照完整；办公协作专家因飞书 Skill/连接器缺失降级；生图执行专家因 `pango-image-mcp` 连接器缺失降级。
- 任务目录：4 项，0 个目录问题。

## 结论

当前 6 个保留专家具备结构化加载和通用 runtime 装配能力，但不能宣布 6/6 生产就绪：办公协作和生图仍必须在连接器可用环境中做真实只读/隔离执行，远程 Provider 资格验证仍未获授权。该审计解决的是“能力是否已安装、能否装配、哪里降级”的统一判断，不替代真实输出质量评审。

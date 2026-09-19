# RQA181：真实 Provider 资格前置复核

日期：2026-09-09

## 结果

在隔离资格目录中启动产品经理 `PM01` 的真实 Electron 资格入口，并指定生产 KnowMe 用户目录作为加密配置来源。执行器确认：

- 生产 `settings.json` 存在加密 Provider 配置；
- 仅向隔离目录复制了非敏感 Provider 配置和加密字段，没有复制明文密钥；
- 任务进入 `needs_input`，阻塞码为 `secure_storage_unavailable`；
- 没有发起 Provider API 调用，没有保存模型结果，也没有生成资格通过证据。

## 根因边界

当前执行环境中的 Windows DPAPI 返回“未加载用户配置文件”，因此 Electron 无法解密既有凭据。提升命令权限后仍复现同一状态，说明问题属于当前沙箱/用户配置文件环境，不足以推断用户在正常 KnowMe 桌面进程中的授权已失效。

## 门禁结论

该结果只计入环境阻塞诊断，不计入生命周期、工具回执或专业资格。`productionReady=false` 保持正确。后续应在正常 KnowMe Electron 进程中执行同一隔离资格入口，或由用户在设置页重新保存凭据；不应在沙箱中重复扫码或录入密钥。

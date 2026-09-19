# RQA04 cached Pango 定向只读核查（2026-09-06）

## 结论

缓存投影早返回的反例成立，但不是当前真实MCP getConnectorStatus路径的必现故障。没有修改源码、权限或矩阵测试，没有真实网络/API/用户数据访问。

- src/lib/expert-task-tool-preflight.ts:13 遇status.projectedAllowlist数组直接return，跳过discovery及selected rawName→公共别名。
- src/lib/connectors/index.ts:80 的MCP分支调用probeMcpHealth，src/lib/connector-capabilities.ts:105只返回ok/state/message/toolsCount，不返回projectedAllowlist。
- src/lib/connectors/index.ts:151的getConnectorTools返回buildMcpAllowlistDto，后者在connector-capabilities.ts:189提供真实投影与availableTools[].rawName/projectedName/selected。
- 公共定义来自agent-image-tools.ts:11/32，实际handler在337调用raw generate_image；mcp-host-names.ts:12生成的真实投影名为mcp.pango_image_mcp.generate_image，不是含连字符的示例。
- 源码projectedAllowlist赋值检查未发现MCP健康状态缓存生产者。Feishu状态确有该字段，但不是Pango。
- 原定向测试的Pango正例仅覆盖无status投影的discovery路径，并用手写含连字符投影；不能覆盖本反例。应补真实DTO命名和缓存分支反例。

GitNexus debugging已执行query/context；FTS不可用且connectorProjection不在索引，未得到可用调用图，不把空结果当不存在调用。随后用实际定义、真实服务函数和隔离执行核实。没有修改既有符号，因此本轮没有执行改动impact，也不声称完成修复。

## 定向结果

真实createConnectorsApi及MCP DTO链执行，仅底层fetchImpl返回内存tools/list，stores和secrets均注入内存对象。无tools/call，无实际HTTP、文件用户数据或图片成果。

| 场景 | preflight discovery调用 | ok | 说明 |
|---|---:|---|---|
| real_service_no_cached_status | 1 | true | 完整通过 |
| cached_real_projection_selected | 0 | false | required_tool_unavailable |
| cached_empty_projection | 0 | false | required_tool_unavailable |
| cached_projection_unselected | 0 | false | required_tool_unavailable |
| real_service_unselected | 1 | false | required_tool_unavailable |
| real_service_tool_acl_denied | 1 | false | scope_denied |
| raw_config_claim_not_discovered | 1 | false | required_tool_unavailable |

7场景断言全部通过（cached selected断言预期为false，用于记录当前bug，不表示修复后验收通过）。
真实status形状：{"ok":true,"state":"online","message":"MCP 在线，发现 1 个工具","toolsCount":1}。
只将已选工具同一真实投影数组加到status后，discovery调用从1变0，错误变required_tool_unavailable: generate_image；因果对比只改变缓存状态字段。

## 修复建议（本轮未执行）

保留status投影作为可用名的上界，但不能在需要已声明adapter别名时直接跳过身份发现。别名必须同时满足：绑定且获准的真实provider；discovery中rawName精确匹配真实definition；selected===true；projectedName同时存在于实际投影及缓存上界。空缓存继续拒绝，缺失或失败discovery不能用raw配置冒充，最终照常过工具allowlist/denylist及connector ACL。不应直接删前缀或信任raw allowlist。
新增回归应让cached selected正例变绿，同时保留空投影、未选中、ACL拒绝、raw配置未发现负例。当前canonical服务无该缓存字段，先作为兼容性缺口处理，不能据此宣布真实Pango QA失败或已修复。

## 可复现命令

从仓库根目录在PowerShell执行（仅内存mock传输）：

```powershell
$repro = @'
const assert = require('node:assert/strict')
const { createConnectorsApi } = require('./src/lib/connectors')
const { preflightExpertTools } = require('./src/lib/expert-task-tool-preflight')
const { PANGO_CONNECTOR_ID } = require('./src/lib/agent-image-tools')
const { buildMcpAgentToolName } = require('./src/lib/mcp-host')
;(async () => {
const id = PANGO_CONNECTOR_ID
const projectedName = buildMcpAgentToolName(id, 'generate_image')
const rows = []
for (const scenario of [
 {name:'real_service_no_cached_status', expected:true},
 {name:'cached_real_projection_selected', cache:true, expected:false},
 {name:'cached_empty_projection', cache:true, empty:true, expected:false},
 {name:'cached_projection_unselected', cache:true, unselected:true, expected:false},
 {name:'real_service_unselected', unselected:true, expected:false},
 {name:'real_service_tool_acl_denied', denied:true, expected:false},
 {name:'raw_config_claim_not_discovered', missing:true, expected:false},
]) {
 const conn = {id,type:'mcp',enabled:true,agentVisible:true,allowlist:scenario.unselected?[]:['generate_image'],mcp:{transport:'streamable-http',url:'https://not-contacted.invalid/mcp'},secretSlots:[]}
 const rpcMethods=[]
 const api = createConnectorsApi({
  connectorStore:{migrateLegacy(){},loadConnectors(){return [conn]}},
  secretStore:{configuredKeys(){return []},resolveSecrets(){return {}}},
  capabilityStore:{listEntries(){return {entries:[]}}},
  fetchImpl:async (_url,opts) => {
   const request=JSON.parse(opts.body); rpcMethods.push(request.method)
   assert.equal(request.method,'tools/list')
   return {json:async()=>({result:{tools:scenario.missing?[]:[{name:'generate_image',inputSchema:{type:'object',properties:{}}}]}})}
 }
 })
 const status=await api.getConnectorStatus(id)
 assert.equal(Object.hasOwn(status.connector.status,'projectedAllowlist'),false)
 const discovered=await api.getConnectorTools(id)
 if(!scenario.missing)assert.equal(discovered.availableTools[0].projectedName,projectedName)
 let discoveryCalls=0
 const checkedApi={
  getConnectorStatus:async () => scenario.cache
   ? {...status,connector:{...status.connector,status:{...status.connector.status,projectedAllowlist:scenario.empty?[]:[projectedName]}}}
   : status,
  getConnectorTools:async () => {discoveryCalls++;return discovered}
 }
 const snapshot={bindings:{connectors:[id]},capabilityManifest:{permissions:{tools:{allowlist:scenario.denied?[]:['generate_image']},connectors:{allowedConnectorIds:[id]},network:true,write:true}}}
 const result=await preflightExpertTools({snapshot,connectorIds:[id],requiredTools:['generate_image'],getConnectorsApi:()=>checkedApi})
 assert.equal(result.ok,scenario.expected,scenario.name)
 assert.equal(discoveryCalls,scenario.cache?0:1,scenario.name)
 rows.push({scenario:scenario.name,status:status.connector.status,projectedName,discovery:discovered,preflightDiscoveryCalls:discoveryCalls,result,rpcMethods})
}
console.log(JSON.stringify({assertions:'7 scenarios passed; cached selected intentionally reproduces rejection',rows},null,2))
})().catch(error=>{console.error(error);process.exitCode=1})
'@
node -r ./scripts/register-ts.js -e $repro
```

最后成功运行exit code=0。未运行fullcheck；main负责user-data scope与矩阵修复，本报告不触及该范围。


const { test }=require('node:test')
const assert=require('node:assert/strict'),path=require('node:path')
const agentTools=require('../src/lib/agent-tools')
const builder=require('../src/lib/tool-surface-builder')
const policy=require('../src/lib/context-engine/policy')
const sandbox=require('../src/lib/agent-sandbox')
const names=['search_knowledge','fabric_search','kb_query','kb_get','calculate']
const noop=()=>null
let seq=0
async function probe({mode='v1',tier='assist',permissions,sessionPermissions,expert=true,noTools=false,planning=false,snapshotPermissions}={}) {
const calls=[],adoptions=[]
const libs={
 app:{getPath:()=>process.cwd()},path,agentTools,contextEngine:policy,
 isToolSurfaceV1:builder.isToolSurfaceV1,resolveToolSurfaceForRun:builder.resolveToolSurfaceForRun,
 mergeExtraTools:require('../src/lib/merge-extra-tools').mergeExtraTools,
 agentSandbox:{normalizeSandboxPermissions:sandbox.normalizeSandboxPermissions},
 agentPlanTools:{buildPlanTools:noop},agentWebTools:{buildWebTools:noop},agentArtifactTools:{buildArtifactTools:noop},agentImageTools:{},
 agentCapabilityImportTools:require('../src/lib/agent-capability-import-tools'),
 getSessionCapabilityBindings:()=>({allowedConnectorIds:[]}),
 researchRouting:{classifyResearchIntent:()=>({}),buildResearchRoute:()=>({active:false})},
 logger:{systemPrompt(){}},connectorToolRuntime:{buildConnectorToolSurface:async(_root,opts)=>({surface:agentTools.createToolSurface({extraDefinitions:opts.extraTools?.definitions,handlers:opts.extraTools?.handlers}),close:async()=>{}})}
}
const lid=require.resolve('../src/lib/agent-generate-libs'),sid=require.resolve('../src/lib/agent-generate-tool-surface')
const oldLib=require.cache[lid],oldSurface=require.cache[sid],oldMode=process.env.KNOWME_TOOL_SURFACE
try {
require.cache[lid]={id:lid,filename:lid,loaded:true,exports:libs};delete require.cache[sid]
process.env.KNOWME_TOOL_SURFACE=mode
const canonical=snapshotPermissions || {tools:{allowlist:[]},connectors:{allowedConnectorIds:[]},network:false,write:false}
const run=await require(sid).buildRunToolSurface({
 deps:{ensureCapabilityHub:()=>({expertRuntime:()=>({getSessionPersona:()=>({ok:true,capabilityManifest:{permissions:canonical}})}),buildSkillToolsForSession:noop}),
 ensureAgentTeamRuntime:()=>({enabled:false,manager:{adoptRunningRun:r=>adoptions.push(r)},store:{writeReceipt(){}}}),
 getActiveSourceRoot:()=>null,buildActiveSourceFileTools:noop},
 payload:{...(permissions===undefined?{}:{permissions})},runId:'rqa11-'+(++seq),metrics:{},fail:error=>({error})},
 {session:{id:'isolated',...(expert?{expertId:'generic-test-expert'}:{}),...(noTools?{executionPolicy:'no-tools'}:{}),run:{...(sessionPermissions?{permissions:sessionPermissions}:{})}},
 s:{agentScriptsEnabled:false},slashRefs:[],tier,prompt:'static supplied materials',apiMessages:[],
 executionPolicy:policy.resolveExecutionPolicy({conversationMode:planning?'expert-planning':'',toolsEnabled:true}),
 queryKnowledge:async()=>{calls.push('search');return {ok:true,hits:[]}},
 kbQueryTool:async()=>{calls.push('query');return {ok:true,hits:[]}},
 kbGetTool:async()=>{calls.push('get');return {ok:false,code:'knowledge_scope_denied',error:'fixture: no document ACL'}},
 })
assert.ok(!run.early)
try {
const args={search_knowledge:{query:'x'},fabric_search:{query:'x'},kb_query:{collection:'local-pkg',query:'x'},kb_get:{ref:'local-pkg:okf'},calculate:{calculations:[{expression:'6*7'}]}}
const results={}
for(const name of names){const r=await run.toolExecutor.executeToolCall({name,arguments:JSON.stringify(args[name])});results[name]={advertised:run.toolSurface.getToolDefinitions().some(d=>d.function.name===name),allowed:run.toolSurface.isAllowedTool(name),validation:run.toolSurface.validateToolCall(name,JSON.stringify(args[name])).ok,ok:r.ok,code:r.code||null,text:r.text}}
const unknown=await run.toolExecutor.executeToolCall({name:'knowledge_search',arguments:'{"query":"x"}'})
assert.deepEqual(run.toolSurface.getToolRecords().map(d=>d.function.name),run.toolSurface.getToolDefinitions().map(d=>d.function.name))
return {records:run.toolSurface.getToolRecords(),mode:run.resolvedSurface.mode,needsConnectorTools:run.needsConnectorTools,noTools:run.noTools,runPermissions:run.runPermissions,adoptedPermissions:adoptions[0].governanceEnvelope.permissions,governance:run.resolvedSurface.governancePolicy||null,results,calls,unknownCode:unknown.code}
} finally {await run.connectorRuntime.close()}
} finally {
if(oldLib) require.cache[lid]=oldLib;else delete require.cache[lid]
if(oldSurface) require.cache[sid]=oldSurface;else delete require.cache[sid]
if(oldMode===undefined) delete process.env.KNOWME_TOOL_SURFACE;else process.env.KNOWME_TOOL_SURFACE=oldMode
}
}

const scenarios=[
{label:'minimal empty allowlist',tier:'chat',permissions:{tools:{allowlist:[]}}},
{label:'minimal denylist priority',tier:'chat',expert:false,permissions:{tools:{allowlist:names,denylist:names}}},
{label:'v1 empty allowlist',permissions:{tools:{allowlist:[]}}},
{label:'v1 denylist priority',expert:false,permissions:{tools:{allowlist:names,denylist:names}}},
{label:'legacy empty allowlist',mode:'legacy',permissions:{tools:{allowlist:[]}}},
{label:'legacy denylist priority',mode:'legacy',expert:false,permissions:{tools:{allowlist:names,denylist:names}}},
{label:'explicit no-tools dominates allow',noTools:true,permissions:{tools:{allowlist:names}}},
{label:'planning has no tools',planning:true,permissions:{tools:{allowlist:names}}},
{label:'ordinary partner minimal defaults',tier:'chat',expert:false,allowed:true},
{label:'ordinary partner v1 defaults',expert:false,allowed:true},
{label:'session empty allowlist fallback',tier:'chat',expert:false,sessionPermissions:{tools:{allowlist:[]}}},
{label:'empty payload cannot erase session restriction',tier:'chat',expert:false,permissions:{},sessionPermissions:{tools:{allowlist:[]}}},
{label:'snapshot-only canonical empty allowlist'},
]
for(const scenario of scenarios) test('RQA11 '+scenario.label,async()=>{
 const r=await probe(scenario)
 assert.equal(r.unknownCode,'unknown_tool')
 for(const name of names) {
   assert.equal(r.results[name].advertised,!!scenario.allowed,name+' definition')
   assert.equal(r.results[name].allowed,!!scenario.allowed,name+' allowed')
   assert.equal(r.results[name].validation,!!scenario.allowed,name+' public validation')
   // Tool permission never grants access to a document rejected by the resource ACL.
   assert.equal(r.results[name].ok,!!scenario.allowed&&name!=='kb_get',name+' executor')
 }
 assert.deepEqual(r.calls,scenario.allowed?['search','search','query','get']:[])
 if(scenario.allowed) assert.match(r.results.kb_get.text,/knowledge_scope_denied/)
})

// Frozen real assignment permission shapes; no model/API or live userdata.
for(const [caseId,taskId] of [['QA01','task-mtotfx67-mplj8'],['RR01','task-mtotfx1i-lg9q9']]) {
 test('RQA11 '+caseId+' assignment permission replay '+taskId,async()=>{
   const permissions={connectors:{allowedConnectorIds:[]},tools:{allowlist:[]},network:false,write:false,externalWrite:false}
   const r=await probe({permissions,snapshotPermissions:permissions})
   assert.deepEqual(r.runPermissions.tools.allowlist,[])
   assert.equal(r.runPermissions.network,false)
   assert.equal(r.runPermissions.write,false)
   assert.equal(r.mode,'v1')
   assert.equal(r.results.search_knowledge.advertised,false)
   assert.equal(r.results.search_knowledge.validation,false)
   assert.equal(r.results.search_knowledge.ok,false)
   assert.deepEqual(r.calls,[])
 })
}
for(const allowlist of [[],['search_knowledge']]) {
 test('RQA11 registry public validation equals executor closure '+JSON.stringify(allowlist),async()=>{
   const {createRegistry}=require('../src/lib/tool-contract-registry')
   const registry=createRegistry()
   const definition=agentTools.SEARCH_KNOWLEDGE_TOOL
   assert.equal(registry.registerTool(definition,definition._knowme,async()=>({ok:true,text:'registry'})).ok,true)
   const {surface}=builder.buildToolSurfaceFromRegistry(registry,{governancePolicy:{allowlist}})
   let calls=0
   const executor=surface.createToolExecutor({searchKnowledge:async()=>{calls++;return {ok:true,hits:[]}}})
   const validation=surface.validateToolCall('search_knowledge','{"query":"x"}')
   const result=await executor.executeToolCall({name:'search_knowledge',arguments:'{"query":"x"}'})
   assert.equal(validation.ok,allowlist.length>0)
   assert.equal(result.ok,validation.ok)
   assert.equal(calls,allowlist.length)
   assert.deepEqual(surface.getToolRecords().map(d=>d.function.name),allowlist)
   if(allowlist.length) assert.deepEqual(surface.getToolRecords()[0]._knowme,definition._knowme)
 })
}

test('RQA11 governed records retain original contracts and filter before budgeting', async () => {
  const math=require('../src/lib/agent-calculation-tools').buildCalculationTools()
  const denied={...math.definitions[0],function:{...math.definitions[0].function,name:'denied'}}
  const surface=agentTools.createToolSurface({extraDefinitions:[denied,...math.definitions],handlers:math.handlers,
    toolBudget:1,governancePolicy:{allowlist:['calculate']}})
  assert.deepEqual(surface.getToolDefinitions().map(d=>d.function.name),['calculate'])
  assert.deepEqual(surface.getToolRecords()[0]._knowme,math.definitions[0]._knowme)
  assert.equal(surface.getToolDefinitions()[0]._knowme,undefined)
  assert.equal((await surface.createToolExecutor().executeToolCall({name:'calculate',arguments:'{"calculations":[{"expression":"6*7"}]}'})).ok,true)
})

for(const mode of ['minimal','v1','legacy']) {
  test('RQA11 '+mode+' connector ACL + denylist + retained metadata',async()=>{
    const math=require('../src/lib/agent-calculation-tools').buildCalculationTools()
    const definition={type:'function',function:{name:'mcp.fixture.read',parameters:{type:'object',properties:{}}},
      _knowme:{...math.definitions[0]._knowme,source:'mcp',capability:'fixture',connectorId:'fixture',timeoutMs:1234}}
    for(const [allowedConnectorIds,denylist,allowed] of [[[],[],false],[['fixture'],['mcp.fixture.read'],false],[['fixture'],[],true]]) {
      let calls=0,closed=0
      const extraTools={definitions:[definition],handlers:{'mcp.fixture.read':async()=>{calls++;return {ok:true,text:'fixture'}}}}
      const governancePolicy=builder.buildRunGovernancePolicy({permissions:{tools:{allowlist:['mcp.fixture.read'],denylist},connectors:{allowedConnectorIds}}})
      const savedMode=process.env.KNOWME_TOOL_SURFACE
      process.env.KNOWME_TOOL_SURFACE=mode==='legacy'?'legacy':'v1'
      let resolved
      try {
        resolved=mode==='minimal'
          ? {surface:agentTools.createToolSurface({extraDefinitions:extraTools.definitions,handlers:extraTools.handlers,governancePolicy}),close:async()=>{}}
          : await builder.resolveToolSurfaceForRun({governancePolicy,extraTools,
            connectorBuild:async opts=>{
              // Collector intentionally does not consume policy; legacy must still govern internally.
              if(opts.registry) opts.registry.registerTool(definition,definition._knowme,extraTools.handlers['mcp.fixture.read'])
              return {surface:agentTools.createToolSurface({extraDefinitions:extraTools.definitions,handlers:extraTools.handlers}),close:async()=>{closed++}}
            }})
        const surface=resolved.surface
        assert.equal(surface.isAllowedTool('mcp.fixture.read'),allowed)
        assert.equal(surface.validateToolCall('mcp.fixture.read','{}').ok,allowed)
        assert.equal((await surface.createToolExecutor().executeToolCall({name:'mcp.fixture.read',arguments:'{}'})).ok,allowed)
        assert.equal(calls,Number(allowed))
        assert.deepEqual(surface.getToolRecords().map(d=>d.function.name),allowed?['mcp.fixture.read']:[])
        if(allowed) assert.deepEqual(surface.getToolRecords()[0]._knowme,definition._knowme)
      } finally {
        await resolved?.close()
        if(savedMode===undefined) delete process.env.KNOWME_TOOL_SURFACE;else process.env.KNOWME_TOOL_SURFACE=savedMode
      }
      assert.equal(closed,mode==='minimal'?0:1)
    }
  })
}

test('RQA11 direct registry option and legacy full builder also enforce policy',async()=>{
  const {createRegistry}=require('../src/lib/tool-contract-registry')
  const math=require('../src/lib/agent-calculation-tools').buildCalculationTools()
  const registry=createRegistry()
  registry.registerTool(math.definitions[0],math.definitions[0]._knowme,math.handlers.calculate)
  const direct=agentTools.createToolSurface({registry,governancePolicy:{allowlist:[]}})
  assert.deepEqual(direct.getToolRecords(),[])
  assert.equal((await direct.createToolExecutor().executeToolCall({name:'calculate',arguments:'{}'})).ok,false)
  const saved=process.env.KNOWME_TOOL_SURFACE
  try {
    process.env.KNOWME_TOOL_SURFACE='legacy'
    const full=builder.buildFullToolSurface({permissions:{tools:{allowlist:[]}},
      legacySurface:{extraDefinitions:math.definitions,handlers:math.handlers}})
    assert.deepEqual(full.getToolDefinitions(),[])
    assert.equal((await full.createToolExecutor().executeToolCall({name:'calculate',arguments:'{}'})).ok,false)
  } finally {if(saved===undefined) delete process.env.KNOWME_TOOL_SURFACE;else process.env.KNOWME_TOOL_SURFACE=saved}
})

test('RQA11 permission sources intersect, with denylist union and snapshot ACL',()=>{
  const result=builder.buildRunGovernancePolicy({
    permissions:{tools:{allowlist:['calculate','search_knowledge'],denylist:['kb_get']}},
    session:{run:{permissions:{tools:{allowlist:['calculate'],denylist:['kb_query']}}}},
    expertSnapshot:{capabilityManifest:{permissions:{tools:{allowlist:['calculate'],denylist:['fabric_search']},connectors:{allowedConnectorIds:[]}}}},
    allowedConnectorIds:['fixture'],
  })
  assert.deepEqual(result.allowlist,['calculate'])
  assert.deepEqual(result.denylist,['kb_get','kb_query','fabric_search'])
  assert.deepEqual(result.allowedConnectorIds,[])
})

for(const name of ['search_knowledge','fabric_search','kb_query','kb_get']) {
  test('RQA01 surface builtin receives per-call signal: '+name,async()=>{
    const parent=new AbortController(),call=new AbortController()
    let received
    const receive=async(...args)=>{received=args.at(-1);return {ok:true,hits:[],content:'fixture'}}
    const executor=agentTools.createToolSurface().createToolExecutor({
      signal:parent.signal,searchKnowledge:receive,fabricSearch:receive,kbQuery:receive,kbGet:receive})
    const result=await executor.executeToolCall({name,arguments:'{"query":"x","collection":"x","ref":"x"}',signal:call.signal})
    assert.equal(result.ok,true)
    assert.equal(received,call.signal)
    call.abort()
    assert.equal((await executor.executeToolCall({name,arguments:'{}',signal:call.signal})).code,'cancelled')
  })
}

for(const registered of [false,true]) {
  test('RQA01 extra handler receives trusted call context and abort '+registered,async()=>{
    const parent=new AbortController(),call=new AbortController()
    let observed,started
    const ready=new Promise(resolve=>{started=resolve})
    const definition={type:'function',function:{name:'fixture',parameters:{type:'object',properties:{}}},
      _knowme:{source:'builtin',capability:'fixture',risk:'read',sideEffects:false,requiresApproval:false,
        scope:'ephemeral',timeoutMs:30000,idempotencySupported:false,rollbackSupported:false}}
    const handler=(args,signal,ctx)=>new Promise(resolve=>{
      observed={args,signal,ctx};started()
      signal.addEventListener('abort',()=>resolve({ok:false,code:'cancelled',text:'fixture cancelled'}),{once:true})
    })
    let surface
    if(registered) {
      const registry=require('../src/lib/tool-contract-registry').createRegistry()
      registry.registerTool(definition,definition._knowme,handler)
      surface=builder.buildToolSurfaceFromRegistry(registry,{governancePolicy:{allowlist:['fixture']}}).surface
    } else surface=agentTools.createToolSurface({extraDefinitions:[definition],handlers:{fixture:handler},governancePolicy:{allowlist:['fixture']}})
    const execution=surface.createToolExecutor({signal:parent.signal}).executeToolCall({
      name:'fixture',arguments:'{"timeoutMs":999999,"signal":"untrusted"}',signal:call.signal,timeoutMs:321})
    await ready
    // Abort before assertions, so even the old implementation cannot hang this test.
    call.abort()
    const abortedByCall=observed.signal.aborted
    parent.abort()
    await execution
    assert.equal(abortedByCall,true,'the per-call signal must reach the handler independently of parent cancellation')
    if(registered) assert.ok(observed.ctx?.timeoutMs>0&&observed.ctx.timeoutMs<=321)
    else assert.equal(observed.ctx?.timeoutMs,321)
    assert.notEqual(observed.ctx.signal,'untrusted')
    assert.equal(observed.signal.aborted,true)
    if(!registered) assert.equal(observed.signal,call.signal)
    assert.deepEqual(surface.getToolRecords()[0]._knowme,definition._knowme)
  })
}
test('RQA01 fallback signal remains supported; arguments cannot inject timeout context',async()=>{
  const parent=new AbortController()
  let ctx,signal
  const surface=agentTools.createToolSurface({extraDefinitions:[{type:'function',function:{name:'fixture'}}],
    handlers:{fixture:async(_args,s,c)=>{signal=s;ctx=c;return {ok:true}}}})
  await surface.createToolExecutor({signal:parent.signal}).executeToolCall({name:'fixture',arguments:'{"timeoutMs":1,"signal":"untrusted"}'})
  assert.equal(signal,parent.signal)
  assert.equal(ctx?.timeoutMs,undefined)
  assert.equal(ctx?.signal,parent.signal)
})

test('RQA11 no-tools is turn-local and must not persist a new deny-all permission',async()=>{
  const r=await probe({expert:false,noTools:true,permissions:{tools:{allowlist:names}}})
  assert.deepEqual(r.runPermissions.tools.allowlist,names)
  assert.deepEqual(r.calls,[])
})

test('RQA11 builder dependency context cannot replace the effective policy',async()=>{
  const resolved=await builder.resolveToolSurfaceForRun({governancePolicy:{allowlist:[]},deps:{governancePolicy:{allowlist:['search_knowledge']}}})
  try {assert.deepEqual(resolved.surface.getToolDefinitions(),[])} finally {await resolved.close()}
})
test('RQA11 full builder retains top-level declarations with sparse dependencies',()=>{
  const result=builder.buildFullToolSurface({forceV1:true,permissions:{tools:{allowlist:[]}},deps:{}})
  assert.deepEqual(result.surface.getToolRecords(),[])
})

test('RQA01 per-call budget cannot extend the inherited registry run budget',async()=>{
  const registry=require('../src/lib/tool-contract-registry').createRegistry()
  const definition=require('../src/lib/agent-calculation-tools').buildCalculationTools().definitions[0]
  let observed
  registry.registerTool(definition,definition._knowme,async(_args,_signal,ctx)=>{observed=ctx.timeoutMs;return {ok:true,text:'bounded'}})
  const {surface}=builder.buildToolSurfaceFromRegistry(registry,{getRemainingTimeoutMs:()=>500})
  const result=await surface.createToolExecutor().executeToolCall({name:'calculate',
    arguments:'{"calculations":[{"expression":"1"}]}',timeoutMs:5000})
  assert.equal(result.ok,true)
  assert.ok(observed>0&&observed<=500)
})

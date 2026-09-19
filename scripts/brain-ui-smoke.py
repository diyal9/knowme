from pathlib import Path
import sys
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "openspec" / "changes" / "refine-brain-workspace-and-external-library" / "evidence"
SHOT = EVIDENCE / "brain-role-categories.png"
STAR_SHOT = EVIDENCE / "brain-compact-home.png"
SOURCES_SHOT = EVIDENCE / "external-library-manager.png"
RAG_SHOT = EVIDENCE / "rag-library-manager.png"

API_MOCK = r"""
const brainThemeFixtures = [
  ['产品与需求','requirements'], ['架构与方案','architecture'], ['工程与实现','engineering'], ['质量与评测','quality'],
  ['发布与运维','delivery'], ['安全与合规','security'], ['项目与协作','collaboration'], ['技术资产','assets']
];
const ragCollections = [
  {id:'rules',name:'制度与流程',description:'团队制度、流程与质量规范',documentCount:42,updatedAt:'2026-08-26T08:00:00Z'},
  {id:'product',name:'产品研究',description:'用户研究、需求洞察与产品资料',documentCount:81,updatedAt:'2026-08-25T08:00:00Z'},
  {id:'engineering',name:'工程实践',description:'研发规范、架构决策与工程手册',documentCount:126,updatedAt:'2026-08-24T08:00:00Z'},
  {id:'quality',name:'质量与评测',description:'测试策略、评测基线与回归记录',documentCount:67,updatedAt:'2026-08-23T08:00:00Z'},
  {id:'operations',name:'发布与运维',description:'部署流程、运行手册和故障复盘',documentCount:39,updatedAt:'2026-08-22T08:00:00Z'},
  {id:'security',name:'安全与合规',description:'安全基线、权限规范与审计资料',documentCount:28,updatedAt:'2026-08-21T08:00:00Z'}
];
const taxonomyNodes = brainThemeFixtures.map((category,index) => ({
  id:`taxonomy:software:ai-engineer:${category[1]}`, kind:'concept', label:category[0],
  summary:'AI 工程 / 架构岗位的知识分类入口', tags:['brain-taxonomy','brain-taxonomy-category',`taxonomy:${category[1]}`,`taxonomy-order:${index}`,...(index === 7 ? ['taxonomy-catchall'] : [])], scope:'global', authority:5
}));
const taxonomyRoot = {id:'taxonomy:software:ai-engineer:root',kind:'concept',label:'AI 工程 / 架构知识框架',tags:['brain-taxonomy','brain-taxonomy-root'],scope:'global',authority:5};
const brainConcepts = Array.from({length: 48}, (_, index) => {
  const category = brainThemeFixtures[index % brainThemeFixtures.length];
  return {
    id:`brain-concept:${index}`, kind:'concept', label:`${category[0]}认知 ${index + 1}`,
    summary:'用户确认后沉淀的本地认知', tags:[`taxonomy:${category[1]}`], scope:'global', authority:4
  };
});
const brainClaims = brainConcepts.slice(1).map((node,index) => ({id:`brain:${index}`,subjectId:brainConcepts[index].id,predicate:'relatesTo',objectNodeId:node.id,status:'confirmed',confidence:.9,evidenceRefs:['e1']}));
const taxonomyClaims = taxonomyNodes.map((node,index) => ({id:`taxonomy-claim:${index}`,subjectId:taxonomyRoot.id,predicate:'contains',objectNodeId:node.id,status:'confirmed',confidence:1,evidenceRefs:['taxonomy-evidence']}));
window.api = {
  onWorkspaceOpenSettings: () => () => {},
  onWorkspaceOpenRoute: () => () => {},
  onAttentionItem: () => () => {},
  onAttentionClear: () => () => {},
  getWorkspaceState: async () => ({}),
  appInfo: async () => ({ name: 'KnowMe', version: 'test' }),
  knowledgeOsList: async () => ({ ok: true, wiki: [{kind:'wiki',path:'projects/brain.md',title:'Brain 方案'}], okf: [] }),
  knowledgeProviderList: async () => ({ ok: true, activeProviderId: 'local-default', providers: [{id:'local-default',kind:'qmd-local',displayName:'工程知识 Wiki',sourceId:'source:engineering',collections:[{id:'root',name:'外挂资料库',description:'本机挂载的 688 份工程资料',documentCount:688,tags:['llmwiki']}]},{id:'wiki-product',kind:'qmd-local',displayName:'产品研究 Wiki',sourceId:'source:product',collections:[{id:'product-root',name:'产品资料',documentCount:126}]},{id:'rf',kind:'ragflow',displayName:'团队 RAGFlow',endpoint:'https://rag.example.com',collectionIds:['rules'],hasApiKey:true,collections:ragCollections}] }),
  knowledgeProviderSetActive: async () => ({ok:true}),
  knowledgeProviderSave: async () => ({ok:true,id:'rf'}),
  knowledgeProviderRemove: async () => ({ok:true}),
  brainProviderSync: async () => ({ok:true,collections:[{id:'rules'},{id:'product'}]}),
  knowledgeStewardTaskList: async () => ({ ok: true, tasks: [], proposals: [] }),
  personalAgentGrowthList: async () => ({ ok: true, proposals: [] }),
  fabricGraph: async () => ({ ok: true, nodeCount: 4, edgeCount: 3 }),
  brainProposalList: async () => ({ ok: true, proposals: [] }),
  brainGrowthList: async () => ({ ok: true, events: [] }),
  brainLayoutSave: async (positions) => ({ ok: true, layout: { version: 1, positions } }),
  brainPath: async ({fromId,toId}) => ({ ok:true, nodeIds:[fromId,toId], claimIds:['c1'], explanation:'我 → 参与项目 → KnowMe' }),
  brainSnapshot: async () => ({ ok: true, state:{taxonomyRoleLabel:'AI 工程 / 架构'}, stats:{nodes:65,claims:61,evidence:2,proposals:1,providers:2}, proposals:[], providers:[{id:'local-default',kind:'qmd-local',displayName:'本地 LLM Wiki',health:'ready',collections:[{id:'root',name:'外挂资料库',description:'本机挂载的 688 份工程资料',documentCount:688,tags:['llmwiki']}]},{id:'rf',kind:'ragflow',displayName:'团队 RAGFlow',endpoint:'https://rag.example.com',health:'ready',lastQueryAt:'2026-08-27T01:00:00Z',collections:ragCollections}], evidence:[{id:'e1',title:'用户确认',documentRef:'conversation:1'},{id:'taxonomy-evidence',title:'岗位分类模板'}], nodes:[
    {id:'self:me',kind:'self',label:'我',summary:'由你确认的长期理解',tags:[],scope:'global',authority:5},
    {id:'project:knowme',kind:'project',label:'KnowMe',summary:'当前工作项目',tags:[],scope:'project',authority:4},
    {id:'preference:conclusion',kind:'preference',label:'先给结论',summary:'已确认的回复偏好',tags:[],scope:'global',authority:5},
    {id:'provider:local-default',kind:'source',label:'本地 LLM Wiki',summary:'本地挂载知识库，仅在查询时读取，不属于 Brain',tags:['provider','qmd-local'],scope:'global',authority:2,external:true,providerId:'local-default'},
    {id:'collection:local-default:root',kind:'collection',label:'外挂资料库',summary:'688 篇外部资料，仅保留目录元数据',tags:['collection','llmwiki'],scope:'global',authority:2,external:true,providerId:'local-default',collectionId:'root'},
    {id:'provider:rf',kind:'source',label:'RAGFlow',summary:'按需检索的外部知识源',tags:[],scope:'organization',authority:3,external:true,providerId:'rf'},
    {id:'collection:rf:rules',kind:'collection',label:'制度库',summary:'组织制度与流程',tags:[],scope:'organization',authority:3,external:true,providerId:'rf',collectionId:'rules'},
    taxonomyRoot, ...taxonomyNodes, ...brainConcepts
  ], claims:[
    {id:'c1',subjectId:'self:me',predicate:'worksOn',objectNodeId:'project:knowme',status:'confirmed',confidence:1,evidenceRefs:['e1']},
    {id:'c2',subjectId:'self:me',predicate:'hasPreference',objectNodeId:'preference:conclusion',status:'confirmed',confidence:1,evidenceRefs:['e1']},
    {id:'c3',subjectId:'provider:local-default',predicate:'contains',objectNodeId:'collection:local-default:root',status:'confirmed',confidence:1,evidenceRefs:['e1']},
    {id:'c4',subjectId:'provider:rf',predicate:'contains',objectNodeId:'collection:rf:rules',status:'confirmed',confidence:1,evidenceRefs:['e1']},
    ...taxonomyClaims, ...brainClaims
  ]}),
  brainNeighborhood: async () => window.api.brainSnapshot().then(x => ({ok:true,rootId:'self:me',nodes:x.nodes,claims:x.claims,stats:x.stats})),
  sourcesList: async () => ({ok:true,sources:[{id:'source:engineering',kind:'local',displayName:'工程知识 Wiki',rootPath:'D:/Knowledge/Engineering'},{id:'source:product',kind:'local',displayName:'产品研究 Wiki',rootPath:'D:/Knowledge/Product'}]}),
  sourcesTree: async (sourceId) => ({ok:true,rootPath:sourceId === 'source:product' ? 'D:/Knowledge/Product' : 'D:/Knowledge/Engineering',nodes:[{type:'dir',name:'10_项目与协作',path:'10_项目与协作'},{type:'dir',name:'20_架构与方案',path:'20_架构与方案'},{type:'dir',name:'30_工程与研发',path:'30_工程与研发'},{type:'file',name:'README.md',path:'README.md'}]}),
  sourcesTreeChildren: async () => ({ok:true,nodes:[{type:'file',name:'本地 Brain 设计.md',path:'30_工程与研发/本地 Brain 设计.md'},{type:'file',name:'知识路由.md',path:'30_工程与研发/知识路由.md'}]}),
  sourcesReadFile: async ({path}) => ({ok:true,content:`# ${path.split('/').pop().replace('.md','')}\n\n这是外挂 LLM Wiki 中的资料。正文保留在原目录，仅在查询时读取。`}),
  sourcesAddLocal: async () => ({canceled:true}),
  sourcesOpenRoot: async () => ({ok:true}),
  capabilityList: async () => ({ok:true,items:[]}),
  capabilityPackList: async () => ({ok:true,items:[]}),
  workbenchLoad: async () => ({workflows:[],workflowPackages:[]}),
  workbenchModeList: async () => ({ok:true,modes:[],activeModeId:''}),
  workbenchAutomationList: async () => ({ok:true,jobs:[],templates:[]}),
  workbenchTaskList: async () => ({items:[]}),
  agentSessionList: async () => ({items:[]}),
  llmModels: async () => ({presets:[]})
};
"""

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 800}, device_scale_factor=1)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.add_init_script(API_MOCK)
    page.goto(sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5173/workspace/", wait_until="networkidle")
    page.get_by_role("button", name="知识").click()
    page.get_by_label("搜索 Brain").wait_for()
    assert "compact-rail" in page.locator(".brain-layout").get_attribute("class")
    assert "inspector-collapsed" in page.locator(".brain-layout").get_attribute("class")
    assert page.get_by_role("button", name="切换星图").count() == 0
    assert page.get_by_role("button", name="切换归类图").count() == 0
    assert page.get_by_text("双击展开", exact=False).count() == 0
    page.locator(".brain-radial-card").nth(8).wait_for()
    page.locator(".brain-radial-card").nth(1).dblclick()
    page.locator(".brain-node-core").nth(1).wait_for()
    page.locator(".brain-canvas-context button").click()
    page.locator(".brain-radial-card").nth(8).wait_for()
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(STAR_SHOT), full_page=True)
    SHOT.parent.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(SHOT), full_page=True)
    page.get_by_role("button", name="懂我", exact=False).click()
    page.get_by_role("button", name="关系链", exact=True).click()
    page.get_by_role("button", name="你：我").focus()
    page.get_by_role("button", name="你：我").press(" ")
    page.get_by_role("button", name="项目：KnowMe").focus()
    page.get_by_role("button", name="项目：KnowMe").press(" ")
    page.get_by_text("我 → 参与项目 → KnowMe", exact=True).wait_for()
    assert page.locator(".brain-edge.path-active").count() >= 1
    assert page.get_by_role("button", name="图谱", exact=True).count() == 0
    assert page.get_by_role("button", name="资料", exact=True).count() == 0
    page.get_by_role("tab", name="知识库", exact=True).click()
    page.locator(".library-manager").wait_for()
    assert page.locator(".library-list-panel").count() == 0
    page.get_by_label("切换知识库").select_option("wiki-product")
    page.get_by_text("D:/Knowledge/Product", exact=True).wait_for()
    page.get_by_label("知识库操作").click()
    page.get_by_role("menuitem", name="刷新索引", exact=False).wait_for()
    page.get_by_text("目录内容不会全量导入 Brain", exact=False).wait_for()
    page.screenshot(path=str(SOURCES_SHOT), full_page=True)
    page.get_by_role("tab", name="RAG", exact=True).click()
    page.locator(".source-manager-item").filter(has_text="团队 RAGFlow").click()
    page.get_by_text("制度与流程", exact=True).wait_for()
    page.screenshot(path=str(RAG_SHOT), full_page=True)
    assert not errors, "Browser errors: " + " | ".join(errors)
    print(f"brain-ui-smoke ok screenshots={SHOT},{SOURCES_SHOT},{RAG_SHOT}")
    browser.close()

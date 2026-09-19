from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "openspec" / "changes" / "activate-brain-cognition-loop" / "evidence"
REVIEW_SHOT = EVIDENCE / "cognition-review.png"
GRAPH_SHOT = EVIDENCE / "cognition-confirmed-graph.png"
GROWTH_SHOT = EVIDENCE / "cognition-growth-undo.png"

API_MOCK = r"""
let pending = true;
let confirmed = false;
let reverted = false;
let remembered = '我的偏好是项目资料采用本地优先存储';
const proposal = () => ({
  id:'observation:smoke', kind:'cognition', targetType:'brain', status:'pending',
  summary:'我的偏好是项目资料采用本地优先存储', category:'about', confidence:.95, observationCount:3,
  rationale:'这项表达在近期协作中重复出现 3 次，可能值得形成长期理解。',
  impact:'确认后，伙伴会在后续协作中稳定采用这项偏好。',
  sourceLabel:'你在伙伴对话中的明确表达', evidenceRefs:['evidence:smoke'], effects:[]
});
const snapshot = () => {
  const cognitionNodes = confirmed && !reverted ? [{id:'cognition:smoke',kind:'preference',label:remembered,summary:'你确认的长期偏好',tags:['confirmed'],scope:'global',authority:5}] : [];
  const cognitionClaims = confirmed && !reverted ? [{id:'claim:smoke',subjectId:'self:me',predicate:'hasPreference',objectNodeId:'cognition:smoke',status:'confirmed',confidence:1,evidenceRefs:['evidence:smoke']}] : [];
  return {ok:true,state:{taxonomyRoleLabel:'AI 工程'},stats:{nodes:1+cognitionNodes.length,claims:cognitionClaims.length,evidence:1,proposals:pending?1:0,providers:0},proposals:pending?[proposal()]:[],providers:[],evidence:[{id:'evidence:smoke',type:'conversation',title:'伙伴对话',snippet:'我的偏好是项目资料采用本地优先存储',persistence:'local'}],nodes:[{id:'self:me',kind:'self',label:'我',summary:'由你确认的长期理解',tags:[],scope:'global',authority:5},...cognitionNodes],claims:cognitionClaims};
};
window.api = {
  onWorkspaceOpenSettings: () => () => {}, onWorkspaceOpenRoute: () => () => {}, onAttentionItem: () => () => {}, onAttentionClear: () => () => {},
  getWorkspaceState: async () => ({}), appInfo: async () => ({name:'KnowMe',version:'test'}),
  knowledgeOsList: async () => ({ok:true,wiki:[],okf:[]}), knowledgeProviderList: async () => ({ok:true,providers:[]}),
  knowledgeStewardTaskList: async () => ({ok:true,tasks:[],proposals:[]}), personalAgentGrowthList: async () => ({ok:true,proposals:[]}), fabricGraph: async () => ({ok:true,nodeCount:0,edgeCount:0}),
  brainProposalList: async () => ({ok:true,proposals:pending?[proposal()]:[]}),
  brainProposalConfirm: async ({patch}) => { remembered=patch?.summary||proposal().summary; pending=false; confirmed=true; reverted=false; return {ok:true}; },
  brainProposalReject: async () => ({ok:true}), brainProposalSnooze: async () => ({ok:true}),
  brainGrowthList: async () => ({ok:true,events:confirmed?[{id:'growth:smoke',targetType:'brain',kind:'cognition',summary:remembered,status:reverted?'reverted':'applied',reversible:true}]:[]}),
  brainGrowthUndo: async () => { reverted=true; return {ok:true}; },
  brainSnapshot: async () => snapshot(), brainNeighborhood: async () => { const data=snapshot(); return {ok:true,rootId:'self:me',nodes:data.nodes,claims:data.claims,stats:data.stats}; },
  brainLayoutSave: async (positions) => ({ok:true,layout:{positions}}), brainPath: async () => ({ok:false,nodeIds:[],claimIds:[]}),
  capabilityList: async () => ({ok:true,items:[]}), capabilityPackList: async () => ({ok:true,items:[]}),
  workbenchLoad: async () => ({workflows:[],workflowPackages:[]}), workbenchModeList: async () => ({ok:true,modes:[],activeModeId:''}), workbenchAutomationList: async () => ({ok:true,jobs:[],templates:[]}), workbenchTaskList: async () => ({items:[]}), agentSessionList: async () => ({items:[]}), llmModels: async () => ({presets:[]})
};
"""

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 800}, device_scale_factor=1)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.add_init_script(API_MOCK)
    page.goto("http://127.0.0.1:5173/workspace/", wait_until="networkidle")
    page.get_by_role("button", name="知识").click()
    page.get_by_role("tab", name="待我确认", exact=True).click()
    page.get_by_role("heading", name="我的偏好是项目资料采用本地优先存储").wait_for()
    page.get_by_text("近期出现 3 次", exact=True).wait_for()
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(REVIEW_SHOT), full_page=True)

    editor = page.get_by_label("KnowMe 将记住")
    editor.fill("项目资料优先保存在本地")
    page.get_by_role("button", name="确认并记住", exact=True).click()
    page.get_by_text("这里已经处理好了", exact=True).wait_for()
    page.get_by_role("tab", name="Brain", exact=True).click()
    page.locator(".brain-node-label", has_text="项目资料优先保存在本地").first.wait_for()
    page.screenshot(path=str(GRAPH_SHOT), full_page=True)

    page.get_by_role("tab", name="待我确认", exact=True).click()
    page.get_by_role("button", name="撤销", exact=True).wait_for()
    page.screenshot(path=str(GROWTH_SHOT), full_page=True)
    page.get_by_role("button", name="撤销", exact=True).click()
    page.get_by_text("已撤销", exact=True).wait_for()
    page.get_by_role("tab", name="Brain", exact=True).click()
    page.wait_for_timeout(150)
    assert page.locator(".brain-node-label", has_text="项目资料优先保存在本地").count() == 0
    assert not errors, "Browser errors: " + " | ".join(errors)
    print(f"brain-cognition-smoke ok screenshots={REVIEW_SHOT},{GRAPH_SHOT},{GROWTH_SHOT}")
    browser.close()

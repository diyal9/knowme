# AgentEvals Report

- Rubric: AgentEvals v3.2 · lifecycle-scoped production candidates + configuration-scoped runtime evidence + legacy compatibility audit
- Agents: 9
- Average package-contract score: 100 (structure only; not professional qualification)
- Average overall score: — (no runtime evidence)
- Qualified experts: 0/9
- Expert-title eligible: 0/9
- Legacy packages retained for history: 13/13

| Agent | Package contract | Runtime-backed overall | Qualification | Expert title | Confidence | Issues |
|---|---:|---:|---|---|---|---:|
| 数据分析师 (data-analyst) | 100 | — | unverified | pending_evidence | unverified | 0 |
| 生图执行专家 (image-producer) | 100 | — | unverified | pending_evidence | unverified | 0 |
| 知识策展专家 (knowledge-curator) | 100 | — | unverified | pending_evidence | unverified | 0 |
| 办公协作专家 (office-partner) | 100 | — | unverified | pending_evidence | unverified | 0 |
| 产品经理 (product-manager) | 100 | — | failed | not_eligible | low | 0 |
| 质量测试专家 (qa-engineer) | 100 | — | unverified | pending_evidence | unverified | 0 |
| 研究分析师 (research-analyst) | 100 | — | unverified | pending_evidence | unverified | 0 |
| 软件开发工程师 (software-engineer) | 100 | — | unverified | pending_evidence | unverified | 0 |
| 视觉方案设计师 (visual-designer) | 100 | — | unverified | pending_evidence | unverified | 0 |

## Details

### 数据分析师 (data-analyst)

- Package-contract score: 100 (structure only)
- Runtime-backed overall score: —
- Qualification: unverified
- Skills: data-analysis-method, business-metrics-analysis, business-cause-analysis, business-insight-report, data-report-method, writing-polish
- Connectors: none
- Runtime configuration: unscoped / not recorded
- Expert-title eligibility: pending_evidence
- Observed samples: 0; descriptively evaluated rows: 0; unscoped (never qualifying) samples: 0
- Issues: none

### 生图执行专家 (image-producer)

- Package-contract score: 100 (structure only)
- Runtime-backed overall score: —
- Qualification: unverified
- Skills: th-art-intake, th-art-prompt-enrich, th-art-pango-generate
- Connectors: pango-image-mcp, photoshop-mcp
- Runtime configuration: unscoped / not recorded
- Expert-title eligibility: pending_evidence
- Observed samples: 0; descriptively evaluated rows: 0; unscoped (never qualifying) samples: 0
- Issues: none

### 知识策展专家 (knowledge-curator)

- Package-contract score: 100 (structure only)
- Runtime-backed overall score: —
- Qualification: unverified
- Skills: knowledge-curation-method, knowledge-steward
- Connectors: none
- Runtime configuration: unscoped / not recorded
- Expert-title eligibility: pending_evidence
- Observed samples: 0; descriptively evaluated rows: 0; unscoped (never qualifying) samples: 0
- Issues: none

### 办公协作专家 (office-partner)

- Package-contract score: 100 (structure only)
- Runtime-backed overall score: —
- Qualification: unverified
- Skills: office-collaboration-method, meeting-evidence-method, action-extraction, writing-polish, feishu-meeting-summary, feishu-related-chats, feishu-today-priority, feishu-doc-kb
- Connectors: feishu
- Runtime configuration: unscoped / not recorded
- Expert-title eligibility: pending_evidence
- Observed samples: 0; descriptively evaluated rows: 0; unscoped (never qualifying) samples: 0
- Issues: none

### 产品经理 (product-manager)

- Package-contract score: 100 (structure only)
- Runtime-backed overall score: —
- Qualification: failed
- Skills: product-definition-method, requirement-review, research-evidence-analysis, writing-polish
- Connectors: none
- Runtime configuration: expert-config-v2:b7fc634bff640ced480e8b90ce1f8a9027686fe9d3f151b561fd3aa04ac2101b
- Expert-title eligibility: not_eligible
- Observed samples: 1; descriptively evaluated rows: 1; unscoped (never qualifying) samples: 0
- Configuration evidence:
  - [current] expert-config-v2:b7fc634bff640ced480e8b90ce1f8a9027686fe9d3f151b561fd3aa04ac2101b: 1 samples; failed; hard failures 1; raw score —; missing scenarios normal:2, edge, retry, revision, reopen
- Issues: none

### 质量测试专家 (qa-engineer)

- Package-contract score: 100 (structure only)
- Runtime-backed overall score: —
- Qualification: unverified
- Skills: qa-test-design, code-review
- Connectors: none
- Runtime configuration: unscoped / not recorded
- Expert-title eligibility: pending_evidence
- Observed samples: 0; descriptively evaluated rows: 0; unscoped (never qualifying) samples: 0
- Issues: none

### 研究分析师 (research-analyst)

- Package-contract score: 100 (structure only)
- Runtime-backed overall score: —
- Qualification: unverified
- Skills: research-synthesis-method, evidence-verification, knowledge-steward, writing-polish
- Connectors: none
- Runtime configuration: unscoped / not recorded
- Expert-title eligibility: pending_evidence
- Observed samples: 0; descriptively evaluated rows: 0; unscoped (never qualifying) samples: 0
- Issues: none

### 软件开发工程师 (software-engineer)

- Package-contract score: 100 (structure only)
- Runtime-backed overall score: —
- Qualification: unverified
- Skills: software-change-verification, architecture-decision, code-review
- Connectors: none
- Runtime configuration: unscoped / not recorded
- Expert-title eligibility: pending_evidence
- Observed samples: 0; descriptively evaluated rows: 0; unscoped (never qualifying) samples: 0
- Issues: none

### 视觉方案设计师 (visual-designer)

- Package-contract score: 100 (structure only)
- Runtime-backed overall score: —
- Qualification: unverified
- Skills: creative-concept-method, visual-brief-prompt, writing-polish
- Connectors: none
- Runtime configuration: unscoped / not recorded
- Expert-title eligibility: pending_evidence
- Observed samples: 0; descriptively evaluated rows: 0; unscoped (never qualifying) samples: 0
- Issues: none

## Legacy compatibility audit

| Legacy role | Package retained | Successor | Package issues |
|---|---|---|---:|
| 行动项管理员 (action-owner) | yes | expert:office-partner | 0 |
| 商业洞察专家 (business-insight-analyst) | yes | expert:data-analyst | 0 |
| 内容策划专家 (content-strategist) | yes | skill:content-strategy-method | 0 |
| 创意策划 (creative-director) | yes | expert:visual-designer | 0 |
| 数据报告专家 (data-report-editor) | yes | expert:data-analyst | 0 |
| 智能体运维专员 (external-capability-importer) | yes | workflow:capability-import | 0 |
| 事实核查专家 (fact-checker) | yes | expert:research-analyst | 0 |
| 长文编辑 (longform-editor) | yes | skill:longform-editing-method | 0 |
| 会议纪要专家 (meeting-scribe) | yes | expert:office-partner | 0 |
| 汇报撰写专家 (presentation-writer) | yes | skill:decision-presentation-method | 0 |
| 需求评审专家 (requirement-reviewer) | yes | expert:product-manager | 0 |
| 解决方案架构师 (solution-architect) | yes | expert:software-engineer | 0 |
| 用户研究员 (user-researcher) | yes | expert:product-manager | 0 |


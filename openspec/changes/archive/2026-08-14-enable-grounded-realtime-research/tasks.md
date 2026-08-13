## 1. Research intent and routing

- [x] 1.1 Extend chat intent and conversation grounding so time-sensitive news/research requests enable tools while greetings remain lightweight
- [x] 1.2 Implement a pure research router that classifies scope/recency, discovers actual projected research tools, and builds model context plus task frame

## 2. Built-in web search

- [x] 2.1 Implement a bounded injectable RSS search provider with URL filtering, result normalization, deduplication, recency metadata, and stable errors
- [x] 2.2 Add the `search_web` tool definition/handler, validation summaries, Registry research semantics, and user-facing timeline label

## 3. Runtime grounding

- [x] 3.1 Integrate two-phase research routing into the production Agent Run after the real tool surface is resolved
- [x] 3.2 Enforce successful search evidence for current public facts and update assistant rules for autonomous execution, source time labels, and honest fallback

## 4. Verification

- [x] 4.1 Add intent, provider, routing, tool-surface, prompt, executor, and grounding regression tests
- [x] 4.2 Run focused tests, full `npm test`, lint, strict OpenSpec validation, and record developer self-test evidence
- [x] 4.3 Restart KnowMe and run Electron smoke for a current AI news request; record timeline, answer, source, console, and screenshot evidence
- [x] 4.4 Complete producer acceptance, tester anti-pattern QA, and Story harness gate evidence
- [x] 4.5 Normalize the grounding source disclosure typography, marker, spacing, and list presentation

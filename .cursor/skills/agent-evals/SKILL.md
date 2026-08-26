---
name: agent-evals
description: Evaluate and score Agent packages in the KnowMe repository using the project-side AgentEvals rubric. Use when reviewing expert Agent design, running AgentEvals, diagnosing weak Agent packages, or preparing an Agent evaluation report.
disable-model-invocation: true
---

# AgentEvals

This skill evaluates repository Agent assets only. Do not add scoring UI, runtime scoring state, or product-facing AgentEvals features to KnowMe unless the user explicitly asks for that separate change.

## Workflow

1. Run `npm run agent-evals -- --out AgentEvals/reports/latest`.
2. Read the generated Markdown report and inspect every `error` and `warning`.
3. For a runtime evaluation, prepare a JSON file matching `AgentEvals/schemas/runtime-results.schema.json` and run:

   ```bash
   npm run agent-evals -- --results path/to/results.json --out AgentEvals/reports/runtime
   ```

4. Treat design score and runtime score separately when sample count is zero or low.
5. Do not improve a score by adding arbitrary connectors or knowledge sources. Add only capabilities required by the Agent's stated work.
6. After changing an Agent package, rerun AgentEvals and the relevant tests.

## Report interpretation

- `designScore`: static package quality from the v1 rubric.
- `runtime.displayScore`: sample-shrunk task performance score.
- `overallScore`: design-only score without runtime samples, or 30% design + 70% runtime when samples exist.
- `confidence`: `unverified`, `low`, `medium`, or `high`.
- `issues`: actionable package gaps; `error` blocks trust, `warning` needs review, `info` is optional.

## Guardrails

- Never claim an Agent is effective from its prompt alone.
- Never treat missing user data or connector authorization as an Agent quality failure.
- Never use model self-ratings as the primary evidence.

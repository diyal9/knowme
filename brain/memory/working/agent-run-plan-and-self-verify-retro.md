# Retro — agent-run-plan-and-self-verify

Date: 2026-08-01

## What shipped

Local Agent Loop gained Cursor-like long-horizon execution: persistent `run.plan`, `update_plan`, limited dynamic budget, and plan-driven self-verify with partial finalize. Writes still require artifact approval.

## Lessons

- Keep plan SSOT separate from `run.steps` tool traces.
- Budget expansion must hard-cap and refuse on repeated tool calls / chat tier.
- Prefer lib modules (`agent-verify`, `agent-plan-tools`) over growing `main.js`.

## Follow-ups

- Optional sandbox verify (test/lint) beyond checklist evidence.
- Further extract ai-generate loop helpers from `main.js`.

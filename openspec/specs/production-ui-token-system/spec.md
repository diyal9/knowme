# production-ui-token-system Specification

## Purpose
Defines KnowMe renderer design-token layering so shell charcoal and workbench green accents keep deliberate dual semantics without accidental same-screen mixing.
## Requirements
### Requirement: Token semantic layers are documented and applied
The renderer MUST expose documented CSS custom properties for shell chrome (`--accent` charcoal family) and workbench primary CTA (`--wb-accent` green family). Feature CSS for primary actions MUST reference the property belonging to that surface's layer, not hard-coded hex of the other layer.

#### Scenario: Workbench primary CTA uses workbench accent
- **WHEN** the user views a workbench primary action such as「新建协作」or shelf「开始」
- **THEN** the filled primary button background resolves from `--wb-accent` (or a documented alias of that layer)

#### Scenario: Settings primary CTA uses shell accent
- **WHEN** the user views a settings primary save/confirm button
- **THEN** the filled primary button background resolves from `--accent` (shell charcoal layer)

### Requirement: Same-screen primary CTA colors MUST NOT mix layers by mistake
Within a single visible surface that has at most one primary filled CTA role, the product MUST NOT show one primary filled button in charcoal and another primary filled button in workbench green for the same CTA role. Secondary/ghost/outline controls MAY use neutral borders.

#### Scenario: Expert-collaboration home has consistent primary CTA
- **WHEN** the user opens 工作台 → 专家协作 with an empty or populated quick-expert section
- **THEN** all filled primary CTAs on that surface share the workbench accent layer

### Requirement: Token drift is detectable
The change MUST include a lightweight guard (script assertion or documented lint check in evidence) that fails or reports when known primary selectors hard-code the wrong layer hex.

#### Scenario: Guard catches wrong-layer hardcode
- **WHEN** a known workbench primary selector hard-codes shell charcoal `#3d3a36` as its filled background
- **THEN** the guard reports a failure or advisory listed in `evidence/` before Story 完成签字


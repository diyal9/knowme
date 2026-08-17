## Purpose

Specifies production-grade interaction polish for KnowMe high-exposure surfaces: focus, hover, keyboard reachability, motion, scrolling, and feedback without introducing new product flows.

## ADDED Requirements

### Requirement: Keyboard focus is visible and reachable
Interactive controls on signed surfaces (rail buttons, tabs, primary CTAs, composer tools, settings tabs) MUST be reachable by keyboard and MUST show a visible `:focus-visible` indicator that meets contrast against the surface background.

#### Scenario: Tab through workbench head and primary CTA
- **WHEN** the user presses Tab from the workbench mode tabs through the primary CTA
- **THEN** each control receives focus in a sensible order AND a visible focus ring appears without removing the control from view

### Requirement: Hover and active states are intentional
Signed surfaces MUST provide hover and pressed/active feedback for clickable rows, cards, and buttons that does not rely solely on cursor change; feedback MUST be subtle and consistent with existing chrome (background tint or border), not a new glow language.

#### Scenario: Rail and card hover
- **WHEN** the user hovers a rail item and a workbench/hub card
- **THEN** both show a background or border state change within the existing token palette

### Requirement: No layout jump or double scroll on signed surfaces
Signed surfaces MUST avoid nested scroll regions fighting each other for the same viewport, and MUST NOT jump layout when empty→populated states toggle for the same container height budget used in baseline.

#### Scenario: Assistant empty to first message
- **WHEN** the user sends the first message from the empty assistant state
- **THEN** the conversation layout transitions without a full-page jump that hides the composer off-screen

### Requirement: Motion is short and purposeful
Transitions for panels, menus, and tab underlines on signed surfaces MUST complete within 200ms for micro interactions and 320ms for panel open/close unless matching a documented baseline longer animation. The product MUST NOT add continuous decorative motion on idle empty states.

#### Scenario: Mode tab underline
- **WHEN** the user switches 专家协作 / 工作流 / 管线服务
- **THEN** the active underline updates promptly without a multi-second animation

### Requirement: Loading and empty feedback are honest
When data is loading on signed surfaces, the UI MUST show a non-blocking loading affordance; when empty, copy MUST match baseline intent (actionable, no lorem). Error toasts MUST not obscure primary CTAs permanently.

#### Scenario: Empty collaboration copy
- **WHEN**协作记录为空
- **THEN** empty copy tells the user how to create the first collaboration and remains readable beside the primary CTA

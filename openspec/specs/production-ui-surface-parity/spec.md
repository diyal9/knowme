# production-ui-surface-parity Specification

## Purpose
Aligns high-exposure KnowMe surfaces with baseline `f6ad048` layout density, empty states, and spacing so the React migration no longer feels visually unfinished.
## Requirements
### Requirement: Assistant empty state matches baseline composition
On the assistant empty state, the system MUST present the greeting, starter prompts, and composer in the baseline composition: starter cards in a compact grid (not a sparse vertical-only stack that leaves large unused center space), and the composer anchored to the empty-state layout used in `f6ad048` (not an unexplained mid-pane float that differs from baseline screenshots without a recorded exception).

#### Scenario: Empty assistant shows grid starters and baseline composer placement
- **WHEN** the user opens 助理 with no active messages in the current session
- **THEN** starter cards render in a multi-column grid matching baseline density AND the composer placement matches the signed baseline layout (or a documented accepted delta in acceptance.md)

### Requirement: Workbench expert-collaboration home matches baseline density
The专家协作 home MUST keep section headers, quick-expert preview count, and「你的协作」empty/list density consistent with baseline: default preview of a small set of items with expand/more behavior rather than oversized empty cards or unbounded lists.

#### Scenario: Quick experts preview then expand
- **WHEN** the user opens 工作台 → 专家协作 with more installed experts than the preview limit
- **THEN** only the preview count is shown until the user expands or chooses more, matching baseline preview behavior

#### Scenario: Collaboration empty state is compact
- **WHEN** there are no collaboration records
- **THEN** the empty state uses baseline empty copy and a compact dashed/empty region without pushing the page into dual-scroll or large unused padding relative to baseline screenshots

### Requirement: Iconography and type hierarchy stay consistent on signed surfaces
Signed surfaces (assistant empty, workbench home, capability hub list chrome, settings tabs) MUST use the shared icon set and type sizes/weights already defined by workspace chrome tokens; ad-hoc font sizes that break hierarchy relative to baseline MUST be corrected on those surfaces.

#### Scenario: Visual hierarchy spot-check
- **WHEN** a maker compares signed-surface screenshots to `f6ad048` baseline captures
- **THEN** section labels remain smaller/muted than titles, and icons share stroke weight with neighboring chrome

### Requirement: Evidence captures before/after for signed surfaces
The change MUST store baseline-reference and post-fix captures under `openspec/changes/align-production-ui-visual-parity/evidence/screenshots/` for each signed surface listed in acceptance.md.

#### Scenario: Evidence folder complete for acceptance
- **WHEN** development claims the surface wave done
- **THEN** corresponding before/after or baseline/current screenshots exist for that surface id


## ADDED Requirements

### Requirement: Studio canvas viewport navigation

The free-graph Studio canvas SHALL support panning and zooming without relying solely on native scrollbars.

#### Scenario: Zoom with wheel and toolbar

- **WHEN** the user scrolls the mouse wheel over the free canvas, or clicks zoom toolbar controls
- **THEN** the viewport scale changes between a bounded minimum and maximum, preserving the focal point under the cursor when possible

#### Scenario: Pan the board

- **WHEN** the user drags on empty canvas space, middle-clicks, or holds Space while dragging
- **THEN** the board translates under the viewport

### Requirement: Multi-side ports and smooth edges

Canvas nodes with inputs SHALL expose left and top inbound ports; nodes with outputs SHALL expose right and bottom outbound ports. Edge paths SHALL choose connection sides from relative geometry and use cubic Bezier curves rather than orthogonal polylines.

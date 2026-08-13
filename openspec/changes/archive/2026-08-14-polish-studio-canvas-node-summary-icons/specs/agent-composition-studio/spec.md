## ADDED Requirements

### Requirement: Canvas node icons match the component library

Professional canvas node headers SHALL use the same `data-icon` glyph set as the studio palette (`ui-icons` / StickyIcons), not Unicode decorative characters.

#### Scenario: Start and end match palette glyphs

- **WHEN** a start or end node is rendered on the professional canvas
- **THEN** the header icon SHALL use `play` / `square` respectively (same as the palette items)

#### Scenario: Expert and gate match palette glyphs

- **WHEN** an agent or gate node is rendered on the professional canvas
- **THEN** the header icon SHALL use `users` / `clipboardCheck` respectively

### Requirement: Canvas summaries show key content without hard clipping

Canvas summary cards SHALL prioritize key fields and truncate long text with ellipsis or an overflow hint, rather than cutting mid-glyph at the card edge.

#### Scenario: Long IO lists summarize with overflow hint

- **WHEN** a start or end node has more than two input/output labels
- **THEN** the card SHALL show at most two labels and an overflow hint such as「等 N 项」

#### Scenario: Long titles remain hoverable

- **WHEN** a node title exceeds the header width
- **THEN** the visible title SHALL ellipsize and the full title SHALL remain available via the element's `title` attribute

#### Scenario: Multi-row summary fits card height

- **WHEN** a node summary has multiple section rows within the display budget
- **THEN** the computed card height SHALL accommodate the header plus visible rows so content is not clipped by the bottom border

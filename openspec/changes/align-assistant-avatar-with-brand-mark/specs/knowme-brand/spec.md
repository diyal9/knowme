## ADDED Requirements

### Requirement: In-app brand mark matches the application icon
Any KnowMe surface that renders the brand mark inside the application UI SHALL use the same node coordinates, connection topology, and palette as the master application icon source. The in-app mark SHALL consist of one ivory non-crossing four-node connected path and one coral origin node on a navy carrier, and SHALL NOT introduce an alternative node count, an alternative coral node position, or an alternative carrier color.

#### Scenario: Assistant panel header renders the brand avatar

- **WHEN** the floating assistant panel opens and renders its header avatar
- **THEN** the avatar mark uses the same node coordinates as `assets/brand-src/knowme-icon.svg`
- **AND** exactly one node is coral and it sits at the path origin rather than at the path center
- **AND** the carrier uses the brand navy with proportionally equivalent corner rounding

#### Scenario: Brand geometry changes in the icon source

- **WHEN** the master icon source geometry is edited
- **THEN** automated tests fail unless the in-app brand mark is updated to the same coordinates

#### Scenario: Floating assistant trigger stays a bell

- **WHEN** the floating assistant trigger button renders
- **THEN** it keeps the outlined bell glyph and does not render the connected brand mark

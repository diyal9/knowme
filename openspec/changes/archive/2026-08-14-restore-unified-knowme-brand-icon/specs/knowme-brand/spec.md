## MODIFIED Requirements

### Requirement: Unified connected application icon
KnowMe SHALL use one connected application mark across the master PNG, every Windows ICO frame, native window and taskbar surfaces, packaged application artwork, and the system tray. The mark SHALL consist of a navy rounded-square carrier, one ivory non-crossing five-node path, and one coral origin node, with transparent rounded corners and no speech-bubble tail, rear card, or readable KM lettering.

#### Scenario: Native window title bar selects a small icon frame
- **WHEN** Windows renders a KnowMe native window icon at any supplied size from 16 through 48 px
- **THEN** the visible artwork remains fully inside the frame with transparent pixels on all four edges
- **AND** the navy carrier, ivory connected path, and single coral origin remain visually distinguishable
- **AND** the visible artwork spans at least 75% of the frame width and height

#### Scenario: Taskbar refreshes after the icon asset changes
- **WHEN** the bundled Windows icon content changes and the user restarts KnowMe
- **THEN** the Windows taskbar uses the current icon content rather than a stale icon cached from the previous asset
- **AND** the selected small frame uses the same connected composition as the full-size brand artwork

#### Scenario: System tray renders the compact brand mark
- **WHEN** KnowMe creates its Windows system tray icon
- **THEN** the tray source provides a 32 px raster as a 2× representation of the 16 DIP target
- **AND** the tray uses the same navy, ivory, and coral connected composition
- **AND** its visual footprint is comparable to adjacent notification-area icons
- **AND** Windows scaling above 100% does not enlarge a 16 px low-resolution bitmap

#### Scenario: Large application artwork is used
- **WHEN** Windows or another surface renders the KnowMe application artwork at 64 px or larger
- **THEN** the artwork uses the same connected geometry and palette as the native small frames
- **AND** the rounded carrier preserves transparent pixels at all four corners

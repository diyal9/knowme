## ADDED Requirements

### Requirement: Windows small icon safe area
KnowMe SHALL provide Windows icon frames at 16, 24, 32, and 48 px whose visible brand artwork is centered inside a transparent safe area of at least 12% on every edge, while retaining a recognizable high-contrast KM mark.

#### Scenario: Native window title bar selects a small icon frame
- **WHEN** Windows renders a KnowMe native window icon at any supplied size from 16 through 48 px
- **THEN** the visible artwork remains fully inside the frame with transparent pixels on all four edges
- **AND** the KM mark remains visually distinguishable from the surrounding title bar

#### Scenario: Taskbar refreshes after the icon asset changes
- **WHEN** the bundled Windows icon content changes and the user restarts KnowMe
- **THEN** the Windows taskbar uses the current icon content rather than a stale icon cached from the previous asset
- **AND** the taskbar artwork retains the same transparent safe area as the selected small icon frame

#### Scenario: System tray renders the compact brand mark
- **WHEN** KnowMe creates its Windows system tray icon
- **THEN** the visible KM artwork is centered inside a transparent safe area of at least 12% on every edge
- **AND** the artwork does not fill or visually exceed the notification-area icon slot

#### Scenario: Large application artwork is used
- **WHEN** Windows or another surface renders the KnowMe application artwork at 64 px or larger
- **THEN** the existing full-size brand composition remains unchanged

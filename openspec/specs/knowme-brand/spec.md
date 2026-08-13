## Purpose

Define KnowMe product naming, data paths, copy conventions, and Windows brand icon presentation.

## Requirements

### Requirement: Product display name
KnowMe SHALL use consistent product naming across the desktop shell and packaging.

#### Scenario: Application shell labels
- **WHEN** the application starts
- **THEN** tray tooltip, main window title, and settings/memory window brand copy SHALL use `KnowMe` (中文场景可并列「知我」)

#### Scenario: Windows installer naming
- **WHEN** packaging a Windows installer
- **THEN** `productName` and shortcut names SHALL be `KnowMe`

### Requirement: User data directory
KnowMe SHALL use a dedicated user data root and MUST NOT silently migrate legacy app data.

#### Scenario: First launch path
- **WHEN** KnowMe launches for the first time
- **THEN** `userData` SHALL resolve to `%APPDATA%\KnowMe\` (or the Electron equivalent)
- **AND** the application MUST NOT automatically migrate or read a legacy application data directory

### Requirement: Product copy in AI prompts
Default AI system prompts SHALL reference the current product name.

#### Scenario: System prompt mentions the product
- **WHEN** default AI system prompts mention the product name
- **THEN** they SHALL use KnowMe / 知我
- **AND** repository source and documentation MUST NOT reintroduce deprecated brand literals or legacy path slugs

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

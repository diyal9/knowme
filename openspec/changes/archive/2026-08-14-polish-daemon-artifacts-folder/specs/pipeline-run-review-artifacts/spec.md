## Purpose

Defines how the Daemon/pipeline run review surface presents the Artifacts tab as a readable folder panel—status-aware empty guidance and file rows with icons and metadata—without inventing fake artifact entries.

## ADDED Requirements

### Requirement: Artifacts empty state is status-aware and actionable
When the Artifacts tab has zero files, the system SHALL show a compact empty panel with an icon, a clear title, and a status-aware explanation. The empty panel MUST NOT show preview instructions (e.g. “点击「预览」打开制品”). The system MUST NOT invent placeholder artifact rows. When the run has failed or otherwise recommends Steps, the empty panel SHOULD include a control or clear cue to open the Steps tab.

#### Scenario: Failed run with no artifacts
- **WHEN** the user opens the Artifacts tab on a failed run with an empty artifact list
- **THEN** the panel shows an empty-state title and an explanation that no outputs were produced (or similar), and does not show “点击预览” style tip text
- **AND** no fake file rows are rendered

#### Scenario: Running task with no artifacts yet
- **WHEN** the user opens the Artifacts tab while the run is still in progress and artifacts are empty
- **THEN** the empty copy indicates artifacts will appear after the pipeline produces outputs (distinct from the failed-run wording)

### Requirement: Artifact list rows read as a file folder
When one or more artifacts exist, the Artifacts tab SHALL render each item as a file row with a file icon, the artifact name, and available metadata (such as size when known). Preview / reuse actions MUST remain available when the corresponding capability applies. Empty-state preview tip text MAY appear only when the list is non-empty.

#### Scenario: Non-empty artifact list
- **WHEN** the Artifacts tab receives one or more projected artifact files
- **THEN** each row shows a file icon and the artifact name
- **AND** if a download URL or local path is available, a Preview control remains usable
- **AND** the section does not use the empty-state panel

#### Scenario: Size metadata when present
- **WHEN** an artifact includes a finite size value
- **THEN** the row shows a human-readable size beside the name or as secondary meta

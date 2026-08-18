## ADDED Requirements

### Requirement: Workspace first paint stays lean

The workspace shell MUST keep the default assistant route eagerly loaded. Non-default surfaces MUST load on demand. The files sidebar MUST NOT mount or fetch its tree while closed. Assistant chrome load MUST NOT fetch the capability hub list. Knowledge for the composer MAY load after first paint.

#### Scenario: Closed files sidebar is idle

- **WHEN** `filesOpen` is false
- **THEN** FilesPane is not mounted and does not invoke file-tree load

#### Scenario: Assistant chrome avoids hub fan-out

- **WHEN** the assistant pane loads chrome
- **THEN** it loads models/profile/skills and does not call capability hub list as part of that chrome path

#### Scenario: Task home loads hub once

- **WHEN** TaskHomeSurface mounts
- **THEN** hub capabilities are fetched once for experts without a duplicate fetch caused by setting the hub tab

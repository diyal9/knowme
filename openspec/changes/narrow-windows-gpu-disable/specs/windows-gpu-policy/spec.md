## ADDED Requirements

### Requirement: Windows GPU and UI degrade automatically

On Windows, KnowMe MUST automatically choose GPU and UI refresh policy without requiring user environment variables for normal operation. KnowMe MUST throttle high-frequency UI timers when a remote desktop session is detected. KnowMe MUST disable GPU when a persisted GPU-crash fallback is active. Optional `KNOWME_FORCE_GPU` / `KNOWME_DISABLE_GPU` MAY override for advanced recovery only.

#### Scenario: Local console keeps full performance

- **WHEN** the session is local (no RDP session name and no CLIENTNAME) and no crash fallback is active
- **THEN** hardware acceleration stays enabled and UI timers use the normal interval

#### Scenario: Remote session auto-throttles

- **WHEN** `SESSIONNAME` matches `RDP-Tcp*` OR `CLIENTNAME` is set and no crash fallback is active
- **THEN** hardware acceleration stays enabled, in-process GPU may be applied, and UI timers use the throttled interval

#### Scenario: GPU crash auto-fallback

- **WHEN** the GPU child process exits abnormally
- **THEN** KnowMe persists a fallback marker and relaunches so the next boot disables GPU without user configuration

#### Scenario: Crash fallback auto-recovers

- **WHEN** a crash fallback has remained stable for the recovery window
- **THEN** KnowMe clears the fallback so a later launch can probe hardware acceleration again

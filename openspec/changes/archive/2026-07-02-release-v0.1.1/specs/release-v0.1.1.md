# Spec: release-v0.1.1

## release-documentation

- **WHEN** 用户打开仓库首页  
- **THEN** README SHALL provide download guidance, install notes, data storage paths, backup guidance, and a clear link or section for privacy policy

## license-present

- **WHEN** 维护者准备发布 `v0.1.1`  
- **THEN** the repository SHALL include a `LICENSE` file that defines the distribution terms for StickyNotes

## privacy-policy-present

- **WHEN** 用户查看隐私说明  
- **THEN** the project SHALL explain local note storage, product knowledge/memory storage, API Key handling, backup/export behavior, and what data is not uploaded by default

## release-workflow-tag

- **WHEN** tag `v0.1.1` is pushed  
- **THEN** GitHub Actions SHALL run test, lint, build, package, and upload release assets or fail with visible logs

## release-assets

- **WHEN** GitHub Release `v0.1.1` is published  
- **THEN** it SHALL include Windows downloadable assets, release notes, and checksum information

## code-signing-boundary

- **WHEN** signing secrets are available in CI  
- **THEN** the Windows package SHALL be signed without storing certificate material in the repository

## unsigned-package-disclosure

- **WHEN** signing secrets are unavailable  
- **THEN** the Release notes SHALL disclose that the package is unsigned and may trigger OS trust warnings

## update-check-release

- **WHEN** a user opens Settings and clicks "检查更新" from a packaged `0.1.1` build  
- **THEN** the app SHALL query the configured GitHub Release source and show a clear result or actionable error

## windows-install-smoke

- **WHEN** a user downloads and installs the Windows `v0.1.1` asset  
- **THEN** StickyNotes SHALL launch, create a note, auto-save content, restore after restart, and keep tray behavior consistent with README

## mac-validation-record

- **WHEN** the team evaluates Mac support for `v0.1.1`  
- **THEN** acceptance evidence SHALL record the device, macOS version, build asset, result, and any blocker before Mac is marked supported

## release-rollback

- **WHEN** a critical release issue is found after publishing  
- **THEN** maintainers SHALL be able to mark the Release as pre-release or withdrawn, update README guidance, and document the next corrective version

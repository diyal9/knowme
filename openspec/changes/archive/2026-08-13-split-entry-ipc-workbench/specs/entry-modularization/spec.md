# Spec: entry-modularization

## ADDED Requirements

### Requirement: Core IPC modules register via deps injection

Settings、open-external、sources 通道 MUST 由 `src/ipc/` 模块注册，main 仅注入依赖。

#### Scenario: get-settings still redacts

- **WHEN** 非设置窗同步 get-settings
- **THEN** apiKey 明文仍被 redact（行为与拆分前一致）

#### Scenario: open-external file path

- **WHEN** 打开 file: URL
- **THEN** 仍走 openPath，不走 openExternal(file)

### Requirement: Workbench provenance helper is shared module

货架来源标签逻辑 MUST 可在 `src/workbench/` 模块中复用。

#### Scenario: label mapping

- **WHEN** source 为 personal/forked/official/其它
- **THEN** 标签分别为 我的/我的/官方/共享

## Purpose

Defines visual and interaction parity of KnowMe React surfaces against git commit f6ad048 on feature/game-studio-work-partner, without restoring page-level HTML.

## ADDED Requirements

### Requirement: Baseline commit is the product oracle
The product MUST treat commit `f6ad048` (`feature/game-studio-work-partner`) as the sole UI and interaction oracle. Git `main` MUST NOT be used as a workbench baseline.

#### Scenario: Wrong baseline rejected
- **WHEN** a reviewer compares React UI to unrelated legacy note-app pages or an unapproved baseline
- **THEN** that comparison MUST be discarded in favor of `f6ad048` workspace, settings, memory, log-viewer, and capability-hub

### Requirement: Chrome, rail, and window chrome match baseline
The workspace shell MUST reproduce the baseline rail (文件、助理、工作台、专家库、管线、知识网、设置), titlebar brand mark, sidebar collapse, and z-index stacking of rail / sidebar / main / overlays.

#### Scenario: Rail destinations
- **WHEN** the user clicks each rail item
- **THEN** the same destination as `f6ad048` opens (助理列、工作台 surfaces、专家库 overlay、管线服务、知识网、设置窗)

### Requirement: Workbench surfaces match baseline IA
The workbench MUST expose surfaces 专家协作、工作流货架、管线服务、Studio 搭建、任务房间，with the same tab labels, search placement, and enter/leave transitions as `f6ad048`.

#### Scenario: Mode tabs
- **WHEN** the user is on workbench home
- **THEN** three tabs 专家协作 / 工作流 / 管线服务 are visible and switch the corresponding surface

### Requirement: Pixel and motion parity
Icons, type sizes, spacing, card radii, hover/active states, and overlay stacking MUST match baseline CSS tokens (`workbench-*.css`, `capability-hub.css`, workspace chrome). Independent note windows MUST remain unreachable.

#### Scenario: Overlay stacking
- **WHEN** capability hub, drawer, or modal is open
- **THEN** it sits above the workbench body with the same mask and close (Esc) behavior as baseline

### Requirement: Secondary windows match baseline tabs and chrome
Settings MUST keep seven tabs (内容源、AI 接口、助手模式、系统配置、连接器、我的记忆、关于). Memory and log-viewer windows MUST keep their baseline filters, stats, and actions. Attention toast MAY remain HTML.

#### Scenario: Settings tabs present
- **WHEN** the user opens 设置
- **THEN** all seven baseline tabs are reachable and save uses the same settings IPC as baseline

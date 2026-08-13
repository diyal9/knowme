## 1. Task launch state

- [x] 1.1 Add the centered launch hero, Composer mount and “开始使用” hierarchy to all non-workbench Agent empty states.
- [x] 1.2 Add reusable icon-first shortcut-card markup while preserving existing task IDs, prompts and preflight attributes.
- [x] 1.3 Implement safe reversible Composer docking based on empty Session state without losing draft, attachment, model or event state.
- [x] 1.4 Remove the decorative assistant icon above the default launch-state title.
- [x] 1.5 Match the launch-state send button to the neutral conversation-state icon button.
- [x] 1.6 Remove the “开始一个新任务” heading from the default launch state.
- [x] 1.7 Limit the top-bar “+” menu to the four built-in assistant modes and keep dynamic experts out of this menu.
- [x] 1.8 Add the missing material preflight rules so no built-in mode entry sends a content-dependent task with an empty composer.

## 2. Conversation state

- [x] 2.1 Style launch and conversation states responsively, including 2×2-to-single-column shortcut behavior and reduced-motion support.
- [x] 2.2 Restyle user messages as right-aligned content-width bubbles while preserving the assistant reading track and structured result layouts.

## 3. Verification

- [x] 3.1 Update Agent workspace tests for launch-state hierarchy, Composer docking, state switching and asymmetric role alignment.
- [x] 3.2 Run OpenSpec validation, unit tests and lint; record development self-test evidence.
- [x] 3.3 Run targeted UI/Electron smoke for initial and post-send states and save visual evidence.
- [x] 3.4 Add regression coverage for the four-mode “+” menu and run targeted tests and lint.
- [x] 3.5 Add coverage asserting every built-in mode entry has a prompt, a resolvable task id and a preflight rule.
- [x] 3.6 Run real Electron end-to-end smoke clicking each mode entry (menu, cards, preflight ask, material resume, steward IPC) and save evidence.

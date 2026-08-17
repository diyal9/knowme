## ADDED Requirements

### Requirement: Streaming markdown parse stays incremental

While an assistant message is streaming, KnowMe MUST avoid fully re-parsing the entire stable markdown prefix on every token when a cached prefix is still valid. KnowMe MUST flush a full parse when streaming ends. UI updates during streaming MAY be throttled.

#### Scenario: Stable prefix is reused

- **WHEN** streaming source grows but the stable prefix (ending at a fence-balanced `\n\n`) is unchanged
- **THEN** only the tail after that prefix is re-parsed and concatenated with cached prefix blocks

#### Scenario: Stream end uses full parse

- **WHEN** streaming becomes false
- **THEN** the view parses the full source without relying on a stale stream cache

### Requirement: Long chats virtualize older messages

The assistant chat log MUST render a bounded trailing window of messages by default and reveal older messages in pages. Message bubbles SHOULD use containment suitable for skipping off-screen rendering work.

#### Scenario: Reveal earlier page

- **WHEN** more messages exist than the current window and the user chooses to show earlier ones
- **THEN** the window grows by one page size rather than necessarily revealing the entire history at once

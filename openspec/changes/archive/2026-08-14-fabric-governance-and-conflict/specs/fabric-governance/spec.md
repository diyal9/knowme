## fabric-governance

### Requirement: SSOT ingest dedup

WHEN user ingests content similar to an existing concept with equal or lower authority  
AND ssotMode is `mark`  
THEN system SHALL NOT block ingest AND SHALL create alias/update governance proposal.

WHEN ssotMode is `block` AND equal/higher existing authority  
THEN ingest SHALL return error with ssot metadata.

### Requirement: Broken anchor detection

WHEN anchor extRef file is missing on disk  
THEN unified checkup SHALL emit broken_anchor issue with cleanup/relocate actions.

### Requirement: Stale anchor and reweave

WHEN external file syncHash differs from graph anchor  
THEN anchor SHALL be marked stale AND checkup SHALL list stale_anchor issue.

WHEN user triggers reweave queue  
THEN system SHALL enqueue weave proposal for kbId without blocking startup.

### Requirement: Unified checkup

WHEN user runs fabric-governance-checkup  
THEN report SHALL include overallHealth, kbHealth, categories, and actionable issues.

### Requirement: Conflict writeback

WHEN retrieval resolves contradicts on hits  
THEN graph SHALL persist contradicts edge if not already present.

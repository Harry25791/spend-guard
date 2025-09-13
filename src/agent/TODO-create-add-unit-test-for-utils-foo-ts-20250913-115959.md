# Add unit test for utils/foo.ts

Rationale: User-specified task via AGENT_TASK (workflow_dispatch input).

Acceptance Criteria:
- Given repo is installed, When running pnpm test:unit, Then tests pass
- Patch size stays within config.maxChangedLines

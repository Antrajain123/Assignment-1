# DayFlow Constitution

## Core Principles

### I. Simplicity and Maintainability
Implement the simplest solution that satisfies the documented requirements. Keep modules and
functions focused on a single responsibility, separate API, validation, and persistence concerns,
and reuse existing code rather than duplicating it. Add a dependency only when existing platform
capabilities and project code cannot reasonably meet a requirement; document its purpose.
Straightforward code keeps this small API understandable and maintainable.

### II. API and Data Contracts
Expose REST resources using consistent resource-oriented paths and HTTP methods. Accept and return
JSON with documented, predictable endpoint-specific success shapes and the appropriate HTTP status
codes. Validate every request before processing it. Errors MUST use a consistent JSON envelope,
`{"error":{"code":"...","message":"..."}}`, with a meaningful machine-readable code and safe,
actionable message; responses MUST NOT expose stack traces or internal details. Contract changes
MUST update their documentation and automated tests.

### III. Test-First Development
Every feature and behavior change MUST have automated tests written or updated before the change is
considered complete. Tests MUST cover successful operations, invalid input, and relevant boundary
cases; they MUST be repeatable and deterministic, without dependence on external services, wall-clock
timing, or uncontrolled shared state. A feature is complete only when its required tests pass.

### IV. Data Integrity
Task records MUST be persisted in the designated JSON file. Validate records and requested changes
before modifying persisted state; malformed input and invalid operations MUST leave existing data
unchanged. Validate persisted content before using it, and perform writes in a way that avoids
leaving a partially written task file. Task status values and allowed transitions MUST be defined
and enforced; reject an invalid transition without changing the task or persisted data. These rules
make file-based storage predictable and reduce accidental data loss.

### V. Security
Treat request data and persisted content as untrusted: validate it and apply context-appropriate
sanitization before use. File access MUST use the configured data location and MUST prevent
user-controlled paths, path traversal, and unsafe file operations. Do not return or log secrets or
sensitive information. Include security checks in the automated validation harness and test relevant
input and file-access boundaries.

### VI. Deterministic Harness Integrity (NON-NEGOTIABLE)
The automated validation harness MUST include linting, security checks, and automated tests.
Failures MUST preserve useful diagnostic evidence, including stdout, stderr, failed rules, and
expected-versus-actual results. The AI coding agent MAY repair application code in response to that
evidence, but MUST NOT weaken acceptance criteria, delete failing tests, reduce assertions, disable
security checks, or bypass validation to obtain a pass. After every repair, rerun the same validation
gates. The final result requires explicit human acceptance or rejection; passing checks alone are
not acceptance.

### VII. Traceability and Reproducibility
Map each requirement to explicit acceptance criteria and automated tests. Keep evidence of the
initial AI-generated implementation separate from evidence of the corrected final implementation.
Record harness execution results and repair history, including the validation outcome. Provide
reproducible setup, test, and execution instructions so another contributor can repeat the checks
and trace outcomes back to requirements.

## Technology Constraints

The runtime MUST be Node.js; application code MUST use JavaScript and Express.js; task storage MUST
use a JSON file; and automated tests MUST use the Node.js built-in test runner. Use only necessary
dependencies and do not replace these technologies without an approved constitution amendment.

## Development Workflow

Before implementation, make requirements traceable to acceptance criteria and tests. Validate every
change with the harness gates for linting, security, and automated tests, and retain their diagnostic
results. When repairing a failure, preserve the original criteria and rerun all the same gates.
Document setup and execution commands alongside the project. Completion requires recorded results
for all gates and explicit human acceptance or rejection of the final result.

## Governance

This constitution takes precedence over implementation plans, local conventions, and convenience.
No implementation decision may silently weaken the assignment's evaluation requirements.

Amendments MUST be proposed with their rationale, affected principles, compatibility impact, and
required updates to acceptance criteria, tests, and project guidance. A change takes effect only
after explicit human approval and documentation in the amended constitution. The version MUST follow
semantic versioning: MAJOR for backward-incompatible governance changes or removals, MINOR for new
principles or materially expanded requirements, and PATCH for non-semantic clarifications.
Contributors and reviewers MUST check changes for compliance with this constitution and report
conflicts before accepting implementation work. Reassess compliance at feature completion and
whenever an amendment is proposed.

**Version:** 1.0.0 | **Ratified:** 2026-11-05 | **Last Amended:** 2026-11-05

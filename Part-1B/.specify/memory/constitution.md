<!--
Sync Impact Report
Version change: unresolved template -> 1.0.0 (initial ratification)
Modified principles: unresolved template slots -> ten project principles; no prior
  project-specific principle titles existed.
Added sections: Technical Constraints; Verification and Acceptance.
Removed sections: none; unresolved template examples and placeholders were removed.
Follow-up TODOs: none.
-->

# Natural Language Reminder Agent Constitution

## Core Principles

### I. Specification-First Development
Requirements, acceptance criteria, and constraints MUST be documented and reviewed
before implementation begins. Material changes to scope or behavior MUST be reflected
in the specification before the corresponding implementation is changed. This keeps
the work measurable and prevents implementation decisions from silently replacing
user requirements.

### II. Simple Architecture
The application MUST use Node.js, Express, JavaScript ES modules, the Gemini API, and
Zod. Modules MUST remain focused, and dependencies or abstractions MUST be added only
when they solve a documented project need. The project is small and academic; its
architecture must remain understandable without infrastructure that does not serve
the requirements.

### III. Structured AI Output
Gemini MUST be asked for reminder data in a defined structured format conforming to
the project's reminder schema. All model output MUST be treated as untrusted and
validated against that schema before use. Schema conformance does not replace the
deterministic validation required by Principle IV.

### IV. Deterministic Validation
Application code MUST independently validate required fields, date and time formats,
timezone rules, and reminder invariants. These checks MUST produce the same result
for the same input and MUST NOT depend on the AI model's judgment. Supported formats,
timezone handling, and invariants MUST be explicit in the specification and tests.

### V. Safety and Reliability
Ambiguous requests MUST be clarified rather than completed by inventing reminder
details. Invalid model responses, Gemini/API failures, and missing configuration
MUST be handled explicitly and safely; they MUST NOT create or imply a valid reminder
when required information is unavailable. Errors MUST be visible to the caller in a
useful, non-misleading form.

### VI. Testability
The project MUST include unit tests for deterministic logic and integration tests
for relevant application boundaries. It MUST also maintain at least 15 meaningful
evaluation cases spanning normal, boundary, ambiguous, and invalid requests. Cases
MUST exercise observable behavior rather than merely restating implementation
details.

### VII. Evaluation Quality
Evaluation MUST cover schema correctness, deterministic properties and invariants,
and semantic quality of reminder interpretation. The initial evaluation evidence
MUST be preserved before implementation changes, and final evaluation evidence MUST
be preserved after implementation. Results and any known gaps MUST be reviewable
alongside the test cases.

### VIII. Security
API keys and other secrets MUST be provided through environment variables and MUST
never be committed to source control. User input MUST be validated and handled
safely before it is used by application logic or sent to external services. Error
messages and evaluation evidence MUST NOT expose secrets.

### IX. Maintainability
Code MUST use clear names, focused modules, and readable control flow. Failures MUST
be represented with meaningful error responses rather than silent defaults or
success-shaped fallbacks. Changes MUST follow existing project conventions and
avoid unrelated scope.

### X. Human Oversight
Project documentation MUST state the agent's limitations and any material evaluation
gaps. After reviewing the implementation and preserved evaluation evidence, a human
reviewer MUST record a final **ACCEPT** or **REJECT** decision. Automated tests or
model evaluation do not replace this decision.

## Technical Constraints

The technology choices in Principle II are the project stack and MUST be reflected
in implementation and project documentation. The specification MUST define the
reminder data schema, supported date/time and timezone behavior, and reminder
invariants before those behaviors are implemented. Additional infrastructure or
dependencies require a documented need and MUST NOT be introduced solely for
hypothetical future use.

## Verification and Acceptance

Completion evidence MUST include the relevant unit and integration test results, the
evaluation cases and their results, and preserved initial and final evaluation
evidence. Review MUST check the evidence against the documented acceptance criteria
and this constitution. The final human **ACCEPT** or **REJECT** decision and known
limitations MUST be recorded; a passing test suite alone is not acceptance.

## Governance

This constitution governs project specifications, implementation, tests, and
evaluation. Amendments MUST be made in this document, reviewed for consistency with
the project, and reflected in affected specifications and acceptance criteria.
Changes that add or materially expand principles or obligations increment the
minor version; backward-incompatible removals or redefinitions increment the major
version; wording-only clarifications increment the patch version. The ratification
date remains the original adoption date, and the last-amended date changes whenever
the constitution is amended. Each implementation review MUST assess compliance,
record justified deviations, and resolve or explicitly accept them before the final
human decision.

**Version**: 1.0.0 | **Ratified**: 2026-11-05 | **Last Amended**: 2026-11-05

# Tasks: DayFlow Task Management API

**Input**: Design documents from `/specs/001-task-management-api/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/openapi.yaml`, and `quickstart.md`

**Tests**: Required by the feature specification and project constitution. Write tests first and
confirm they fail for the intended missing behavior before implementing it.

**Organization**: Tasks are grouped by the three prioritized user stories in `spec.md`. Every task
has a concrete repository path and story tasks map to their acceptance criteria.

## Phase 1: Setup

**Purpose**: Establish the Node.js project, deterministic quality gates, and separate evidence locations.

- [X] T001 Initialize `package.json` and `package-lock.json` for Node.js ES modules with Express 5, ESLint, and scripts for start, tests, lint, syntax, security, and validation; add runtime data exclusions to `.gitignore`.
- [X] T002 [P] Configure ESLint for JavaScript ES modules in `eslint.config.js`.
- [X] T003 [P] Create the deterministic validation runner in `scripts/validate.js` to run lint, syntax, local security checks, and tests while preserving each gate's stdout, stderr, failure details, and exit code.
- [X] T004 [P] Create distinct initial and final evidence locations with `.gitkeep` files under `evidence/initial-generation/implementation/`, `evidence/initial-generation/validation/`, `evidence/final-generation/implementation/`, and `evidence/final-generation/validation/`.

---

## Phase 2: Foundational

**Purpose**: Build shared configuration, validation, persistence, and safe application/error foundations required by all stories.

**⚠️ CRITICAL**: Complete this phase before beginning user story implementation.

- [X] T005 [P] Add isolated temporary-store and deterministic ID/clock helpers in `test/helpers/temporary-store.js` and `test/helpers/deterministic-sources.js`.
- [X] T006 [P] Write failing shared validation tests in `test/unit/task-validation.test.js` for exact field constraints from `data-model.md`: title is trimmed and missing, non-string, empty, or whitespace-only values are rejected; description defaults to `""`, may be cleared with `""`, and rejects `null` or non-string values; priority is exactly `Low`, `Medium`, or `High`; status is exactly `Pending`, `InProgress`, or `Completed`; tags are non-empty after trimming, deduplicated case-insensitively, and retain the first spelling.
- [X] T007 Implement task request and persisted-record validation in `src/validation/task-validation.js` to pass `test/unit/task-validation.test.js`, rejecting unsupported fields before any state change.
- [X] T008 [P] Write failing JSON-store foundation tests in `test/unit/json-task-store.test.js` for missing-file initialization, valid task collection reads, serialized mutations, and preservation of the last valid file after write failure.
- [X] T009 Implement the single-process JSON store in `src/persistence/json-task-store.js`, validating the complete candidate collection and serializing mutations before same-directory temporary-file replacement.
- [X] T010 Implement trusted storage configuration and application/error foundations in `src/config.js`, `src/errors/api-error.js`, `src/app.js`, and `src/server.js`; use only the operator-configured `DAYFLOW_DATA_FILE` or default `data/tasks.json`, expose the standard safe JSON error envelope, and keep app construction separate from listener startup.

**Checkpoint**: Shared project setup, validation, storage, and application foundations are ready; no user story is complete yet.

---

## Phase 3: User Story 1 - Organize and Find Tasks (Priority: P1) 🎯 MVP

**Goal**: Create tasks and retrieve, filter, and deterministically sort the task collection.

**Independent Test**: Against an isolated empty JSON store, create default and custom tasks, reject
missing/empty/whitespace titles, list and retrieve tasks, filter tags case-insensitively, and verify
priority/time/ID ordering (AC-01 through AC-04, AC-07, AC-08).

### Tests for User Story 1

- [X] T011 [P] [US1] Write failing task-service tests in `test/unit/task-service.test.js` for create/list/detail, default status and priority, exact case-insensitive tag filtering, and sorting High/Medium/Low then `createdAt` ascending then `id` ascending (AC-01, AC-02, AC-04, AC-07, AC-08).
- [X] T012 [P] [US1] Write failing HTTP acceptance tests in `test/api/tasks-api.test.js` for `POST /tasks`, `GET /tasks`, `GET /tasks/{id}`, `GET /tasks?sort=priority`, and `GET /tasks?tag={tag}`, covering AC-01, AC-02, AC-03, AC-04, AC-07, and AC-08, their HTTP codes, OpenAPI response shapes, generated timestamps ending in `Z`, and rejection of offset-form timestamps by the OpenAPI schema.

### Implementation for User Story 1

- [X] T013 [US1] Implement task creation, list/detail retrieval, tag filtering, deterministic priority sorting, and injected ID/clock sources in `src/services/task-service.js`, satisfying `test/unit/task-service.test.js`.
- [X] T014 [US1] Implement and validate create/list/detail routes in `src/routes/tasks.js` and mount them in `src/app.js`; enforce the OpenAPI contract at `specs/001-task-management-api/contracts/openapi.yaml`, including default `Pending` status, default `Medium` priority, timestamps, and safe errors.
- [X] T015 [US1] Run `test/unit/task-service.test.js` and `test/api/tasks-api.test.js` against the completed create/list routes; verify all AC-01 through AC-04, AC-07, and AC-08 assertions pass, including deterministic sort tie breaks and no state change on rejected creation.

**Checkpoint**: User Story 1 works independently and passes its unit/API tests. This is the suggested MVP.

---

## Phase 4: User Story 2 - Maintain Task Details and Progress (Priority: P1)

**Goal**: Update and delete tasks, and apply only the three permitted status transitions.

**Independent Test**: Create a task through the API, submit valid and invalid updates, delete
existing and unknown IDs, exercise each allowed status transition and rejected transitions, and
verify that rejected operations preserve the full task and `updatedAt` (AC-05, AC-06, AC-09).

### Tests for User Story 2

- [X] T016 [P] [US2] Write failing task lifecycle tests in `test/unit/task-lifecycle.test.js` for partial update, title/priority/tag validation, delete, every allowed transition, and rejected transitions preserving task fields and `updatedAt` (AC-05, AC-06, AC-09).
- [X] T017 [US2] Extend `test/api/tasks-api.test.js` with failing HTTP acceptance tests for `PATCH /tasks/{id}`, `DELETE /tasks/{id}`, and `PATCH /tasks/{id}/status`, including `404`, `409`, exact status values, generated update timestamps ending in `Z`, and unchanged task/timestamp on rejection (AC-05, AC-06, AC-09, AC-12).

### Implementation for User Story 2

- [X] T018 [US2] Implement validated partial updates, deletion, and allowed status transitions in `src/services/task-service.js`; reject every other transition without changing data or `updatedAt`.
- [X] T019 [US2] Add update, delete, and dedicated status routes in `src/routes/tasks.js` and enforce request/response definitions in `specs/001-task-management-api/contracts/openapi.yaml`.
- [X] T020 [US2] Complete lifecycle assertions in `test/unit/task-lifecycle.test.js` and `test/api/tasks-api.test.js`, verifying all three permitted transitions and each rejected transition returns `409` with the original task and update timestamp unchanged (AC-05, AC-06, AC-09).

**Checkpoint**: User Story 2 passes on the running API without weakening User Story 1 behavior.

---

## Phase 5: User Story 3 - Keep Tasks Available and Handle Failures Safely (Priority: P2)

**Goal**: Preserve valid task data across restarts and fail safely on corrupt data or invalid requests.

**Independent Test**: Start against an isolated store, create/update tasks, recreate the app with that
store, verify persistence, and test malformed JSON, invalid stored records, malformed requests,
error envelopes, and safe failure behavior. Exercise request bodies of 1,048,575, 1,048,576, and
1,048,577 UTF-8 bytes to verify the size-limit boundary (AC-10 through AC-14).

### Tests for User Story 3

- [X] T021 [P] [US3] Write failing persistence tests in `test/api/persistence.test.js` that restart the app against the same temporary store and verify all latest task fields and timestamps ending in `Z` remain retrievable (AC-10).
- [X] T022 [P] [US3] Write failing corruption and security tests in `test/security/input-and-file-access.test.js` for malformed JSON and invalid stored records, including seeding a record with non-UTC timestamp `2026-11-05T10:00:00+05:30`, verifying startup fails closed and the original JSON file bytes remain unchanged; also test UTF-8-byte request-size boundaries at 1,048,575, 1,048,576, and 1,048,577 bytes, normal validation at/below the limit, HTTP 413 with `PAYLOAD_TOO_LARGE` for oversized bodies on every JSON-body operation, unsafe path attempts, and sanitized failures (AC-11, AC-12, AC-14).
- [X] T023 [P] [US3] Write failing API error-contract tests in `test/api/error-contract.test.js` for malformed request JSON, validation errors, unknown IDs, rejected status transitions, oversized-body errors, unexpected failures, required error codes, and absence of stack traces/internal details (AC-12, AC-14).

### Implementation for User Story 3

- [X] T024 [US3] Make startup in `src/server.js` fail closed on malformed JSON, invalid root shape, duplicate IDs, or invalid stored task records, including records with non-UTC offset timestamps, without changing the configured data file (AC-11).
- [X] T025 [US3] Complete safe parsing, a 1,048,576 UTF-8-byte (not character) JSON request-body limit, `413`/`PAYLOAD_TOO_LARGE` error mapping, validation error mapping, and redacted internal-error handling in `src/app.js`, `src/config.js`, `src/errors/api-error.js`, and `src/routes/tasks.js`; requests must never select the data-file path and bodies at/below the limit must proceed to normal validation (AC-12, AC-14).
- [X] T026 [US3] Complete restart, corruption, request-size boundary, and HTTP error tests in `test/api/persistence.test.js`, `test/security/input-and-file-access.test.js`, and `test/api/error-contract.test.js`; confirm timestamps end in `Z`, OpenAPI rejects offset-form timestamps, a stored record with timestamp `2026-11-05T10:00:00+05:30` causes startup to fail closed without changing original file bytes, the 1,048,575/1,048,576-byte bodies proceed to validation, 1,048,577-byte bodies on every JSON-body operation return the specified 413 JSON error without state change, and operation is repeatable without external services (AC-10, AC-11, AC-12, AC-13, and AC-14).

**Checkpoint**: All user stories pass independently against isolated data files; invalid or corrupt data is never silently discarded.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verify measurable targets, reproducibility, evidence preservation, and all required quality gates.

- [X] T027 [P] Add the 1,000-task list/filter/sort performance acceptance test in `test/api/performance.test.js` and verify SC-002's one-second local threshold without weakening it.
- [X] T028 [P] Update `quickstart.md` with the runnable setup and validation commands and the exact `evidence/initial-generation/` and `evidence/final-generation/` paths.
- [X] T029 Validate the OpenAPI contract in `specs/001-task-management-api/contracts/openapi.yaml` against actual HTTP request/response tests in `test/api/tasks-api.test.js` and `test/api/error-contract.test.js`, including every status code, JSON shape, error code, HTTP 413 size-limit response, and timestamp pattern that accepts `Z` but rejects offset forms.
- [X] T030 Run the complete `npm run validate` gates for lint, syntax, local security, and tests; record stdout, stderr, failed rule/test, expected versus actual results, tool versions, and exit codes under `evidence/initial-generation/validation/` before repair, preserving initial source/tests under `evidence/initial-generation/implementation/`.
- [X] T031 For each failure, provide its complete evidence to the coding agent for repair, preserve corrected source/tests under `evidence/final-generation/implementation/`, rerun the exact same gates without weakening requirements or disabling checks, retain the first-run record in `evidence/initial-generation/validation/` and the rerun in `evidence/final-generation/validation/`, then request explicit human `ACCEPT` or `REJECT` of the final result.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; complete before foundation.
- **Foundational (Phase 2)**: Depends on Setup; blocks all user stories.
- **User Stories (Phases 3-5)**: Depend on the Foundational phase.
- **Polish (Phase 6)**: Depends on all user stories; final evidence and human acceptance follow
  completion of all validation gates and any repairs.

### User Story Dependencies

- **User Story 1 (P1)**: Starts after Phase 2; no dependency on another story.
- **User Story 2 (P1)**: Starts after Phase 2; extends the task service and API test/route files
  created for US1, so execute after US1 to avoid same-file conflicts. It remains independently
  testable using its own lifecycle tests and API setup.
- **User Story 3 (P2)**: Starts after Phase 2 and the baseline API from US1; its restart, error, and
  security tests verify the shared service and store. It does not depend on US2's user-facing
  lifecycle features.
- **Recommended delivery order**: US1 → US2 → US3, matching priority and minimizing shared-file
  conflicts.

### Parallel Opportunities

- Setup tasks T002-T004 can run independently after T001 establishes the project.
- Within Phase 2, T005, T006, and T008 touch distinct test/helper files and can proceed in parallel;
  implementation follows its corresponding tests.
- In US1, T011 and T012 can be written in parallel because they use distinct files.
- In US2, T016 and T017 are separate unit/API test files and can be authored in parallel after US1.
- In US3, T021-T023 cover distinct API, security, and error-contract test files and can be authored
  in parallel.
- T027 and T028 touch separate performance-test and quickstart files; they can proceed independently
  after implementation stabilizes.
- Do not parallelize tasks that edit the same file or that require an unfinished task as a
  prerequisite.

## Parallel Examples

### User Story 1

```text
Task T011: Write service unit tests in test/unit/task-service.test.js
Task T012: Write API acceptance tests in test/api/tasks-api.test.js
```

### User Story 2

```text
Task T016: Write lifecycle unit tests in test/unit/task-lifecycle.test.js
Task T017: Write lifecycle HTTP tests in test/api/tasks-api.test.js
```

### User Story 3

```text
Task T021: Write persistence restart tests in test/api/persistence.test.js
Task T022: Write corruption/security tests in test/security/input-and-file-access.test.js
Task T023: Write error contract tests in test/api/error-contract.test.js
```

## Implementation Strategy

### MVP First (User Story 1)

1. Complete Setup and Foundational phases.
2. Complete US1 tests before implementation.
3. Implement and independently validate create, list/detail, tag filtering, and deterministic sort.
4. Stop at the US1 checkpoint; demo only after its tests and required gates pass.

### Incremental Delivery

1. Add US2 update/delete/status transitions and run its story tests plus regression tests.
2. Add US3 persistence restart, malformed-store protection, and safe error/security behavior.
3. Run all harness gates; retain generation-specific evidence and report exact outcomes.
4. Request explicit human `ACCEPT` or `REJECT`; a passing harness alone is not acceptance.

## Notes

- Every task uses the required checkbox, sequential ID, optional justified `[P]`, story label only
  for story phases, and an exact file path.
- Story tasks map to the acceptance criteria in `spec.md`; no feature requirement is removed or
  weakened.
- Do not create the tasks listed under future `tasks.md` as application files until their task is
  executed.

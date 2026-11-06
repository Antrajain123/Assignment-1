# Tasks: Natural Language Reminder API

**Input**: Design documents from `specs/001-natural-language-reminders/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/reminders.openapi.yaml`

**Tests**: Unit, integration, and evaluation tests are required by the specification and constitution.

**Organization**: Tasks are grouped by the three prioritized user stories. Complete
Setup and Foundational phases before story work.

## Phase 1: Setup

**Purpose**: Make the repository safe and prepare its runtime/dependency baseline.

- [X] T001 Replace the credential-like value in `.env.example` with safe placeholders for `GEMINI_API_KEY` and `DEFAULT_TIME_ZONE=Asia/Kolkata`; coordinate rotation/revocation of the exposed credential before any commit or deployment (account owner confirmed rotation/revocation).
- [X] T002 Declare Node.js `>=22` and add the justified `@js-temporal/polyfill` dependency in `package.json` and `package-lock.json`; verify compatibility with the installed `@google/genai` version.
- [X] T003 Confirm `.env` and `node_modules/` remain ignored by `.gitignore` and document safe local environment setup in `README.md`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement and verify shared configuration, schemas, deterministic rules,
and Express app infrastructure required by every story.

- [X] T004 [P] Implement configuration parsing in `src/config.js` so invalid/missing `GEMINI_API_KEY` or `DEFAULT_TIME_ZONE` is represented as an unavailable reminder configuration (without throwing during server startup), while `PORT` is validated separately for the listener; never log configuration values.
- [X] T005 [P] Add configuration unit tests in `tests/unit/config.test.js` proving missing/invalid Gemini key or default timezone produces an unavailable reminder configuration without preventing app startup, and valid `Asia/Kolkata`/listener port values are accepted.
- [X] T006 [P] Define strict request, model-interpretation, public-reminder, and error Zod schemas in `src/validation/reminder-schema.js`, including ready/clarification state invariants and exact fields from `data-model.md`.
- [X] T007 [P] Add schema unit tests in `tests/unit/reminder-schema.test.js` for required fields, extra keys, wrong types, nulls, ready/clarification consistency, and the `title`, `date`, `time`, `timezone`, and optional `description` constraints.
- [X] T008 [P] Implement stable error classes/status/code mappings from the plan in `src/errors.js`, ensuring public messages do not include stack traces, API keys, or raw provider output.
- [X] T009 Implement timezone and reminder invariants in `src/validation/reminder-rules.js`; enforce real `YYYY-MM-DD` dates, valid `HH:mm` local time, valid IANA zones, reject DST gaps/overlaps, and require the resolved instant to be strictly later than one supplied reference instant.
- [X] T010 Add deterministic unit tests in `tests/unit/reminder-rules.test.js` for leap/impossible dates, timezone validity/precedence, DST gap and overlap, and past/equal/future boundaries using fixed instants.
- [X] T011 Create an injectable Express application factory with bounded JSON parsing and centralized JSON error middleware in `src/app.js`; do not mount the reminder router in this foundational task.
- [X] T012 Add reusable ephemeral-server cleanup helpers in `tests/helpers/http-server.js` for HTTP integration tests without opening a fixed public port.

**Checkpoint**: Configuration, contracts, domain validation, and app infrastructure
are ready. No user story starts before this phase is complete.

---

## Phase 3: User Story 1 - Create a reminder from a clear request (Priority: P1) 🎯 MVP

**Goal**: Interpret one supported, unambiguous request and return a validated
reminder with the effective timezone and optional user-provided description.

**Independent Test**: With a fixed reference instant, valid configuration, and
controlled interpreter, POST a clear request and verify HTTP 200 and exact
schema-valid reminder fields; test an explicit timezone override and description.

### Tests for User Story 1

- [X] T013 [P] [US1] Add HTTP success-contract tests in `tests/integration/reminder-success.test.js` for `POST /reminders`, response schema, relative date, explicit timezone precedence, and optional description using the helper from `tests/helpers/http-server.js`.
- [X] T014 [P] [US1] Add Gemini adapter unit tests in `tests/unit/gemini.test.js` for structured JSON request configuration and valid, empty, blocked, or malformed provider responses using a controlled client.

### Implementation for User Story 1

- [X] T015 [P] [US1] Implement the server-side Gemini structured-output adapter in `src/services/gemini.js` using `@google/genai`, the configured API key, and the model schema from `src/validation/reminder-schema.js`.
- [X] T016 [US1] Implement `POST /reminders` success-path orchestration in `src/routes/reminders.js`; validate the request, capture one reference instant, resolve explicit/default timezone, validate model data and invariants, and return only `{ "reminder": ... }` on success.
- [X] T017 [US1] Mount the completed reminder router in `src/app.js` and start the service through dotenv-loaded `src/server.js`; keep the HTTP listener available when Gemini key or `DEFAULT_TIME_ZONE` is missing/invalid, and ensure the route returns the safe `503 configuration_error` envelope with no reminder before calling Gemini.
- [X] T018 [US1] Run the story's HTTP and Gemini adapter tests with `node --test tests/integration/reminder-success.test.js tests/unit/gemini.test.js` and fix failures in `src/routes/reminders.js` or `src/services/gemini.js`.

**Checkpoint**: A clear, valid request works independently and returns a reminder
that passes the schema and deterministic rules.

---

## Phase 4: User Story 2 - Clarify incomplete or ambiguous requests (Priority: P1)

**Goal**: Ask for missing or ambiguous information without inventing required
reminder details or returning a success-shaped reminder.

**Independent Test**: Submit missing-title/date/time, ambiguous-date/time, and
multiple-reminder requests using controlled interpreter outcomes; each must produce
the documented clarification/error envelope and contain no `reminder`.

### Tests for User Story 2

- [X] T019 [P] [US2] Add integration tests in `tests/integration/reminder-clarification.test.js` for missing title/date/time, ambiguous date/time, multiple reminders, and no reminder in all clarification responses.

### Implementation for User Story 2

- [X] T020 [US2] Implement clarification handling in `src/routes/reminders.js` for the `clarification` model status; return HTTP 422 with `needs_clarification`, concise questions, and no reminder object.
- [X] T021 [US2] Ensure `src/routes/reminders.js` returns clarification rather than guessing for unsupported multiple reminders and incomplete/ambiguous results; do not silently merge or truncate intents.
- [X] T022 [US2] Run `node --test tests/integration/reminder-clarification.test.js` and correct clarification behavior in `src/routes/reminders.js`.

**Checkpoint**: Incomplete or ambiguous requests cannot produce a reminder and
return a caller-actionable clarification.

---

## Phase 5: User Story 3 - Receive reliable errors and review quality (Priority: P2)

**Goal**: Normalize invalid input, invalid model/provider outcomes, and missing
configuration, and give reviewers reproducible evaluation evidence.

**Independent Test**: Exercise the documented error/status pairs with controlled
failures, run all 24 evaluation cases under fixed time/timezone settings, preserve
initial and final reports, and review limitations and repair evidence.

### Tests for User Story 3

- [X] T023 [P] [US3] Add API error integration tests in `tests/integration/reminder-errors.test.js` for malformed JSON/body, invalid or past reminder, missing/invalid Gemini key and default timezone, malformed model output, provider error/timeout, exact status/code pairs, and no reminder or secret leakage; verify the app starts/listens with missing or invalid Gemini configuration and each reminder request returns HTTP 503 `configuration_error`.
- [X] T024 [P] [US3] Add the 24 evaluation inputs and expected outcomes from `spec.md` to `tests/evaluation/cases.json`, preserving IDs E01-E24, fixed reference instant, case-specific timezone, and controlled provider-failure inputs.

### Implementation for User Story 3

- [X] T025 [US3] Normalize JSON parser and route failures into the specified safe status/code JSON envelope in `src/app.js` and `src/errors.js`; never expose provider payloads, prompts, keys, or stack traces.
- [X] T026 [US3] Implement a repeatable evaluation runner in `tests/evaluation/runner.js` that injects the reference clock, timezone, and fake provider and separately scores schema validity, deterministic invariants, and semantic fields.
- [X] T027 [US3] Add evaluation assertions in `tests/evaluation/evaluation.test.js` for all 24 cases in `tests/evaluation/cases.json`, including no-success-object assertions for every failure or clarification.
- [X] T028 [US3] Run the complete evaluation before making evaluation-driven repairs and preserve the report unchanged in `evaluation/initial-results.json`.
- [X] T029 [US3] Repair failures found by `evaluation/initial-results.json` in the relevant `src/` modules and record each change, rationale, and before/after case IDs in `evaluation/repair-evidence.md`.
- [X] T030 [US3] Rerun the same 24 cases and configuration after repairs and preserve the final report in `evaluation/final-results.json` without overwriting `evaluation/initial-results.json`.
- [X] T031 [US3] Run `node --test tests/integration/reminder-errors.test.js tests/evaluation/evaluation.test.js` and resolve remaining error/evaluation failures in the corresponding `src/` or `tests/evaluation/` files.

**Checkpoint**: Caller-visible errors are stable and safe; initial/final evidence
compares the same evaluation suite and records known gaps.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Complete documentation, verify the integrated project, and record
human acceptance evidence.

- [X] T032 [P] Document API request/response, stable error codes, configuration and unavailable-config runtime behavior, limitations, and `npm start`/`npm test` usage in `README.md`.
- [X] T033 [P] Keep `specs/001-natural-language-reminders/contracts/reminders.openapi.yaml` synchronized with implemented status/code behavior and the response schema.
- [X] T034 Run the complete `npm test` suite and the documented quickstart in `specs/001-natural-language-reminders/quickstart.md`; fix cross-story regressions in the affected source/test files.
- [X] T035 Review the implementation, tests, both evaluation reports, and limitations; record the human **ACCEPT** decision and known gaps in `evaluation/repair-evidence.md` (human project author decision recorded 2026-11-06).
- [X] T036 Verify all five items in `specs/001-natural-language-reminders/checklists/documentation.md` against `README.md` and `contracts/reminders.openapi.yaml`; run the listed test/evaluation commands and record each pass/fail, command, and result in `evaluation/documentation-checklist-results.md` without external reviewers.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001-T003; may be performed in parallel where files do not
  overlap. Credential rotation/revocation is a security prerequisite to committing
  or deploying.
- **Foundational (Phase 2)**: Depends on Setup. Configuration, schemas, errors,
  timezone rules, and the injectable app infrastructure block all stories.
- **User Story 1 (Phase 3)**: Depends on Foundational. Delivers the primary success
  path and is the recommended MVP.
- **User Story 2 (Phase 4)**: Depends on the shared model schema and the
  `POST /reminders` route from US1; extends that route with safe clarification.
- **User Story 3 (Phase 5)**: Depends on the API/error paths from US1 and US2 for
  integration evaluation; controlled cases can be prepared after Foundational.
- **Polish (Phase 6)**: Depends on all accepted story behavior and reports; T036 follows completed API documentation and runnable test/evaluation commands.

### User Story Dependencies

- **US1 (P1)**: Depends on T004-T012. No user-story dependencies.
- **US2 (P1)**: Depends on T004-T012 and the route/app from T016-T017.
- **US3 (P2)**: Depends on shared infrastructure T004-T012 and exercised routes from
  US1/US2; final reporting follows T028-T030 in order.

### Within Each User Story

- Write and run the story's tests before its implementation tasks.
- T015 (provider adapter) and T016 (route orchestration) can proceed independently
  after schemas exist; T017 mounts the completed route and starts the app.
- US2 clarification tests precede changes to the route from US1.
- For US3, define cases before runner assertions; preserve initial results before
  repairs, and final results only after repairs.

### Parallel Opportunities

- Setup: T001 and T002 touch separate files; T003 may overlap only after verifying
  no concurrent edit to `.gitignore` or `README.md`.
- Foundation: T004/T005, T006/T007, and T008 can be developed concurrently in
  separate files. T009/T010 form a dependency pair; T011/T012 can be parallel.
- US1: T013 and T014 are independent test files; T015 and T016 are separate modules
  after foundation, with integration in T017 after both.
- US2: T019 can be authored alongside unrelated US3 evaluation cases; route
  implementation follows its test.
- US3: T023 and T024 are independent; T026 and T027 have a runner-before-assertions
  dependency; T028, T029, and T030 must remain strictly sequential.
- Polish: T032 and T033 touch separate documentation files and can be parallel; T036 follows T032-T034.

## Parallel Example: User Story 1

```text
After T004-T012 complete:
Task: T013 tests/integration/reminder-success.test.js
Task: T014 tests/unit/gemini.test.js

After those tests are established:
Task: T015 src/services/gemini.js
Task: T016 src/routes/reminders.js

After T015 and T016:
Task: T017 src/app.js and src/server.js
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup and Foundational phases.
2. Complete US1 and verify clear requests, explicit/default timezone behavior,
   optional descriptions, and schema/invariants.
3. Stop and validate US1 independently before extending clarification and full
   evaluation behavior.

### Incremental Delivery

1. Setup + Foundational → shared runtime, validation, and app shell.
2. US1 → working valid-reminder API MVP.
3. US2 → safe clarification for incomplete/ambiguous inputs.
4. US3 → normalized errors, 24-case evaluation, preserved evidence, and reviewer
   decision.
5. Polish → documentation, integrated quickstart, and final human review.

## Notes

- [P] identifies tasks on separate files with no unmet prerequisite.
- [US1], [US2], and [US3] trace directly to the specification's user stories.
- The project is small; parallel labels identify safe independent work rather than
  implying that additional architecture or contributors are required.
- Never copy credentials from `.env` or `.env.example` into source, tests, logs,
  reports, or documentation.

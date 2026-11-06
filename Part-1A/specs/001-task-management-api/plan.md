# Implementation Plan: DayFlow Task Management API

**Branch**: `001-task-management-api` | **Date**: 2026-11-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-task-management-api/spec.md`

## Summary

Deliver the single-user task REST API defined in the feature specification using Node.js ES
modules, Express, and a local JSON file. Keep HTTP routing, task business rules, request validation,
and file persistence in separate, small modules. Fail closed on malformed or invalid stored data;
validate proposed changes before writing; serialize file mutations and replace data atomically.
Verify all acceptance criteria through deterministic Node.js built-in tests and a harness containing
lint, syntax, security, and API acceptance gates. Preserve initial and corrected implementation
evidence separately.

## Technical Context

**Language/Version**: JavaScript ES modules; supported Node.js LTS (Node.js 22 or newer)

**Primary Dependencies**: Express 5; ESLint for linting; no application or test runtime dependencies
  beyond Express and Node.js

**Storage**: Local JSON file, default `data/tasks.json`; optional operator-configured path via
  `DAYFLOW_DATA_FILE`, never from request data

**Testing**: Node.js built-in `node:test`, `node:assert/strict`, and built-in `fetch`; isolated
  temporary stores and deterministic injected clock/ID sources in tests

**Target Platform**: Local Node.js server on supported operating systems

**Project Type**: Single-project REST web service

**Performance Goals**: List, sort, and filter 1,000 tasks within one second in the local test
  environment (SC-002)

**Constraints**: No database, authentication, frontend, integrations, or external runtime services.
Use only necessary dependencies. One service process owns the JSON store. Preserve the existing
request/response shapes, HTTP codes, status values, and sorting behavior in the spec and contract.
JSON request bodies are limited to 1,048,576 UTF-8 bytes (not characters); bodies at or below the
limit proceed to normal validation and larger bodies return HTTP 413 with the standard JSON error
envelope and `PAYLOAD_TOO_LARGE` code. API-generated and persisted task timestamps use ISO 8601 UTC
representations ending in `Z`; offset-form timestamps do not satisfy the contract.
The security gate is local and repeatable: targeted validation and file-access security tests plus
static checks; no online vulnerability-audit service is part of the deterministic acceptance gate.

**Scale/Scope**: One user, task records in one JSON file, 1,000-task local performance fixture, 14
acceptance scenarios (AC-01 through AC-14)

## Constitution Check

| Principle | Plan compliance |
|-----------|-----------------|
| I. Simplicity and Maintainability | One Express service, small focused route/service/validation/persistence modules, and only Express plus the lint tool as dependencies. |
| II. API and Data Contracts | OpenAPI contract records resource paths, JSON shapes, validation errors, statuses, and HTTP codes; contract and API tests verify them. |
| III. Test-First Development | Write or update focused tests before implementation; cover success, invalid input, boundaries, and all 14 acceptance scenarios. |
| IV. Data Integrity | Validate incoming and persisted records, serialize mutations, use same-directory temporary-file replacement, and fail closed without rewriting malformed data. |
| V. Security | Bound and validate request bodies, prevent request-controlled file paths, return safe errors, and gate traversal/input/file behavior with dedicated security tests. |
| VI. Deterministic Harness Integrity (NON-NEGOTIABLE) | Required gates are lint, syntax check, security checks, and automated tests. Save complete diagnostics; never weaken criteria or bypass gates; rerun identical gates after repairs; require explicit human acceptance/rejection. |
| VII. Traceability and Reproducibility | Link requirements to acceptance criteria and tests; include runnable local instructions and separate `evidence/initial-generation/` and `evidence/final-generation/` snapshots and validation records. |

**Gate result**: PASS. No constitution conflicts or scope exceptions are planned. The user-requested
Node.js, Express, JSON file, and built-in test runner match the constitution's technology constraints.

## Project Structure

### Documentation (this feature)

```text
specs/001-task-management-api/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml
├── checklists/
│   └── requirements.md
└── tasks.md                         # created only by /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── app.js                            # Express app factory; no listener side effect
├── server.js                         # startup, store initialization, listener lifecycle
├── config.js                         # trusted environment configuration and paths
├── routes/
│   └── tasks.js                      # REST route wiring and response mapping
├── services/
│   └── task-service.js               # task operations, transitions, sorting, filtering
├── validation/
│   └── task-validation.js            # request and persisted-record validation
├── persistence/
│   └── json-task-store.js             # load, validate, queue mutations, atomic replacement
└── errors/
    └── api-error.js                  # safe typed errors and final JSON error middleware

data/
└── tasks.json                        # runtime data; excluded from source-control commits

test/
├── unit/
│   ├── task-service.test.js
│   ├── task-validation.test.js
│   ├── json-task-store.test.js
│   └── task-lifecycle.test.js
├── api/
│   ├── tasks-api.test.js
│   ├── persistence.test.js
│   ├── error-contract.test.js
│   └── performance.test.js
├── security/
│   └── input-and-file-access.test.js  # traversal, payload bounds, errors, corruption safety
└── helpers/
    ├── temporary-store.js
    └── deterministic-sources.js

evidence/
├── initial-generation/
│   ├── implementation/               # untouched first generated source and tests
│   └── validation/                   # initial stdout, stderr, rules, expected/actual, exit codes
└── final-generation/
    ├── implementation/               # corrected source and tests, kept separately
    └── validation/                   # final results from the same gates
```

**Structure Decision**: Use one Node.js web-service project with focused `src/` modules and
`test/` suites. The app factory is imported by API tests without binding a fixed port. Runtime JSON
data, temporary test stores, and evidence snapshots are kept separate from source and from each
other. `data/tasks.json` is created only when absent; invalid existing data is not replaced.

## Test and Harness Strategy

Use one documented `npm run validate` entry point to run, in order, ESLint, `node --check` over all
JavaScript files, local security checks, and `node --test`. Each gate must return a nonzero exit
code on failure and preserve stdout, stderr, failed rule/test names, expected-versus-actual results,
tool versions, and exit status under that run's evidence record. Do not mask a failed gate by
continuing with success status. The security gate consists of repeatable static checks and dedicated
security tests; it does not depend on network access.

The repair workflow is mandatory for every validation cycle:

1. Run all validation gates and record the complete results under the applicable generation's
   `validation/` directory.
2. Capture stdout, stderr, each failed rule or test, expected versus actual results, tool versions,
   and exit codes.
3. If any gate fails, provide that failure evidence to the coding agent for repair. Do not alter
   acceptance criteria or reduce test assertions to make a failure disappear.
4. After a repair, rerun the exact same gates with the same requirements; do not disable checks,
   skip gates, or weaken their criteria. Record this run and its diagnostics separately from the
   initial run.
5. Keep initial-generation and final-generation implementation and validation evidence separate.
   The final result requires an explicit human `ACCEPT` or `REJECT`; passing gates alone is not
   acceptance.

The Node test runner uses isolated temporary JSON files and deterministic ID/clock providers.
Production task IDs remain unique; timestamps use UTC ISO 8601 and successful mutations must advance
`updatedAt`; each timestamp must end in `Z`, and offset-form values must fail the OpenAPI contract.
Tests verify that behavior with controlled time rather than sleeps. API acceptance
tests send actual HTTP requests to the running app on an ephemeral loopback port and validate the
resulting responses against
`specs/001-task-management-api/contracts/openapi.yaml`: endpoint/method behavior, HTTP status codes,
JSON response shapes, and error codes. They always close the server and remove temporary files.
Request-size tests count the serialized request body's UTF-8 bytes (not characters), exercise
1,048,575, 1,048,576, and 1,048,577-byte bodies, and verify normal validation at or below the limit
versus the `413` JSON error contract above it.

| Acceptance criteria | Automated coverage |
|---------------------|--------------------|
| AC-01, AC-02, AC-03 | `test/api/tasks-api.test.js`: default/custom create, defaults, required-title rejection, response/no-write assertions, generated timestamps ending in `Z` |
| AC-04 | `test/api/tasks-api.test.js`: list and detail, including unknown ID |
| AC-05 | `test/api/tasks-api.test.js`, `test/unit/task-validation.test.js`: valid partial update, invalid update and unchanged full record/timestamp; generated update timestamp ends in `Z` |
| AC-06 | `test/api/tasks-api.test.js`: successful delete and unknown-ID response |
| AC-07 | `test/unit/task-service.test.js`, `test/api/tasks-api.test.js`: priority ordering, timestamp tie-break, task-ID tie-break |
| AC-08 | `test/unit/task-service.test.js`, `test/api/tasks-api.test.js`: exact case-insensitive filtering |
| AC-09 | `test/unit/task-service.test.js`, `test/api/tasks-api.test.js`: each allowed transition and rejected transitions returning 409 with unchanged record and `updatedAt`; generated timestamp ends in `Z` |
| AC-10 | `test/api/tasks-api.test.js`: stop/recreate app against same store and retrieve latest values and timestamps ending in `Z` |
| AC-11 | `test/unit/json-task-store.test.js`, `test/security/input-and-file-access.test.js`: malformed JSON and invalid records—including a stored `2026-11-05T10:00:00+05:30` timestamp—fail closed at startup and preserve original file bytes |
| AC-12 | `test/api/tasks-api.test.js`, `test/security/input-and-file-access.test.js`: status, error envelope/codes, malformed body, safe internal failure, and oversized-body error |
| AC-13 | `quickstart.md` run-through plus complete offline `npm run validate` on isolated fixture data |
| AC-14 | `test/security/input-and-file-access.test.js`, `test/api/error-contract.test.js`: 1,048,575/1,048,576-byte bodies proceed to validation; 1,048,577-byte body returns HTTP 413 and `PAYLOAD_TOO_LARGE` without state change |
| Timestamp contract (AC-01, AC-02, AC-05, AC-09, AC-10) | `test/api/tasks-api.test.js` and `test/api/persistence.test.js`: API-generated and persisted timestamps end in `Z`; `test/api/error-contract.test.js` validates OpenAPI rejects offset-form values |

The test paths above are planned deliverables, not files created by this planning phase.

## Complexity Tracking

No constitution violations are planned; no complexity exception is required.

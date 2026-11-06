# Implementation Plan: Natural Language Reminder API

**Branch**: `001-natural-language-reminders` | **Date**: 2026-11-05 | **Spec**: [spec.md](./spec.md)

**Input**: Approved feature specification and planning constraints supplied by the user.

## Summary

Build a small Express JSON API that interprets one reminder request using the
server-side Gemini SDK, validates the model response with Zod and independent
date/time invariants, then returns either one reminder or a safe clarification/error.
Keep routes, interpretation, validation, and evaluation in focused modules. Do not
persist reminders, deliver notifications, or create background jobs. Preserve the
initial evaluation before repairs and the final evaluation after repairs.

## Technical Context

**Language/Version**: JavaScript ES modules, Node.js 22 or later; verify the
installed `@google/genai` supported runtime when implementation begins.

**Primary Dependencies**: Existing Express 5, `@google/genai`, Zod, and dotenv
dependencies. Add `@js-temporal/polyfill` only for timezone-aware local-time
resolution and reject-on-DST-disambiguation; this narrowly scoped dependency avoids
hand-written timezone arithmetic.

**Storage**: None for reminders. Evaluation reports and repair evidence are
version-controlled project artifacts without secrets.

**Testing**: Existing `node --test tests` command; unit tests for parsing,
configuration, schema and temporal invariants; HTTP integration tests with an
injected fake interpreter; a 24-case evaluation suite with controlled provider
responses; reproducible API documentation checklist verification.

**Target Platform**: Node.js server with environment-variable configuration.

**Project Type**: Single-project web service.

**Performance Goals**: No throughput SLA is specified. The service must not add
unbounded retries or blocking work; record provider latency during evaluation and
return a bounded upstream error on provider failure.

**Constraints**: JSON-only API responses; one reminder per request; explicit valid
`DEFAULT_TIME_ZONE` required (example `.env.example` value: `Asia/Kolkata`); the
24 spec scenarios retain their fixed `America/New_York` evaluation context where
specified. Never expose API keys, raw provider output, or stack traces. No
notification delivery, persistence, or scheduling.

**Scale/Scope**: Small academic project; one request produces at most one reminder
or one clarification/error. No users, accounts, database, or background workers.

## Constitution Check

**Pre-design gate**

- **Specification-first**: PASS — approved specification, acceptance scenarios,
  evaluation cases, and constraints exist before implementation.
- **Simple architecture**: PASS — one Node.js/Express service with existing
  dependencies; only the date/time polyfill is proposed, justified by DST-safe
  validation.
- **Structured AI output**: PASS — Gemini structured JSON output is a generation
  constraint; Zod parsing remains mandatory before use.
- **Deterministic validation**: PASS — schema, calendar, timezone, DST, and
  past/current checks are independent of model judgement.
- **Safety and reliability**: PASS — ambiguity, invalid output, provider errors,
  and missing configuration have explicit non-success outcomes.
- **Testability and evaluation**: PASS — unit/integration tests and all 24
  specification cases are planned; evaluation measures schema, invariants, and
  semantic quality and preserves both reports.
- **Security**: PASS WITH REMEDIATION RISK — API keys are server-side environment
  variables only. The existing `.env.example` appears to contain a credential and
  must be replaced with placeholders and the credential rotated before any commit
  or use; never copy it into code or documentation.
- **Maintainability**: PASS — focused modules and stable error codes/responses.
- **Human oversight**: PASS — final implementation/evidence review records
  **ACCEPT** or **REJECT** and limitations.

No scope violations are identified. The proposed date/time polyfill is a documented
dependency trade-off, not an architectural expansion.

## Project Structure

### Documentation (this feature)

```text
specs/001-natural-language-reminders/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── reminders.openapi.yaml
├── checklists/
│   ├── requirements.md
│   └── documentation.md
└── tasks.md                         # Created by /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── app.js                           # Express app, middleware, routes, error mapping
├── server.js                        # dotenv/config startup and listen lifecycle
├── config.js                        # Validate API key, model, port, default timezone
├── routes/
│   └── reminders.js                 # POST /reminders request/response orchestration
├── services/
│   └── gemini.js                    # Gemini client and structured generation only
├── validation/
│   ├── reminder-schema.js           # Zod model and public response schemas
│   └── reminder-rules.js             # Date, timezone, DST, and future invariants
└── errors.js                         # Stable error types/codes and safe mapping

tests/
├── unit/
│   ├── config.test.js
│   ├── reminder-schema.test.js
│   └── reminder-rules.test.js
├── integration/
│   ├── reminder-success.test.js     # Valid reminder response contract
│   ├── reminder-clarification.test.js
│   └── reminder-errors.test.js      # Error mapping and unavailable configuration
├── helpers/
│   └── http-server.js                # Ephemeral test server lifecycle
└── evaluation/
    ├── cases.json                   # All 24 spec scenarios and expected outcomes
    ├── runner.js                    # Repeatable, clock/config/provider-controlled evaluation
    └── evaluation.test.js           # Schema, invariant, semantic assertions

evaluation/
├── initial-results.json             # Captured before repairs; never overwritten
├── final-results.json               # Captured after repairs
├── repair-evidence.md               # Repairs, rationale, and before/after evidence links
└── documentation-checklist-results.md # Reproducible SC-007 verification record

README.md                            # API, configuration, tests, evaluation, limitations
.env.example                         # Safe placeholder values only
```

**Structure Decision**: Use the existing single-project Node/ESM layout and test
command. Keep route orchestration in one route module and separate provider,
validation, configuration, and evaluation concerns without introducing controllers,
repositories, queues, or persistence layers.

## API Flow

1. Load environment configuration and validate the listener port at startup. The
   Express server MUST still start when `GEMINI_API_KEY` or `DEFAULT_TIME_ZONE` is
   missing or invalid; retain that validation state for the request path rather than
   silently substituting values. The example timezone is `Asia/Kolkata`; evaluation
   scenarios set their declared timezone explicitly.
2. Parse a bounded JSON request and validate the body shape (`request` is a
   non-empty string). Capture exactly one reference instant for this request.
3. Before calling Gemini, check whether required Gemini configuration and
   `DEFAULT_TIME_ZONE` are valid. If not, return HTTP 503 with the stable
   `configuration_error` envelope and no reminder.
4. Call Gemini server-side with the request, reference instant, effective default
   timezone, output instructions, and a structured response schema.
5. Parse the returned JSON as unknown data. Validate the full shape with Zod; do not
   use, log, or return unvalidated model data.
6. If the result indicates clarification, return the clarification error envelope.
   Otherwise derive the effective timezone (explicitly stated valid timezone wins;
   else configured default) and independently validate date/time and reminder
   invariants using a timezone-aware resolver with ambiguous/nonexistent DST times
   rejected.
7. If all checks pass and the resolved instant is strictly later than the captured
   reference instant, return HTTP 200 with `{ "reminder": ... }`. All other paths
   return a stable JSON error envelope and no `reminder`.

## Error Handling

| Condition | HTTP | Stable code | Response behavior |
|---|---:|---|---|
| Malformed JSON, missing or empty request | 400 | `invalid_request` | Safe client message; no reminder |
| Invalid date/time, past/current reminder | 422 | `invalid_reminder` | Safe validation message; no reminder |
| Missing or ambiguous details | 422 | `needs_clarification` | `error.message`, optional `error.questions`; no reminder |
| Missing/invalid API key or default timezone | 503 | `configuration_error` | Safe configuration message; no reminder |
| Invalid/malformed model result or provider failure | 502 | `interpretation_failed` | Sanitized message; no raw provider output or reminder |

Error middleware must also normalize JSON-parser errors. Do not return stack traces,
API keys, raw prompts, or provider response text. Log only sanitized error category
and request correlation details, never secrets or full user content.

## Testing Strategy

- **Unit**: configuration parsing and missing/invalid settings; strict Zod schema,
  required/extra fields and types; calendar validity, IANA timezone validity,
  explicit/default timezone precedence, past/current comparison, and DST gap/overlap
  rejection with fixed reference instants.
- **Integration**: start the Express app on an ephemeral local port, inject a fake
  Gemini interpreter, and verify success, clarification, malformed JSON, body
  validation, each stable error/status mapping, no reminder in failure responses,
  and no secret/provider detail leakage. In particular, start the app with missing
  or invalid Gemini configuration and/or default timezone, verify it listens, then
  verify reminder processing returns HTTP 503 `configuration_error`. No live Gemini
  dependency in routine tests.
- **Evaluation**: execute each of the 24 cases in `spec.md` against a fixed
  reference clock and case-defined timezone. Verify schema correctness,
  deterministic invariants, and semantic fields separately. Use controlled provider
  errors and malformed outputs for model-failure cases.
- **Evidence**: capture a complete initial report before repairing evaluation
  failures; preserve it unmodified. Document each repair and its evidence in
  `evaluation/repair-evidence.md`; then capture a final report using the same cases
  and configuration. Do not include API keys, secrets, or private provider payloads.

## Implementation Sequence

1. Resolve repository hygiene: rotate any credential found in the example
   environment file and replace it with safe placeholders; confirm `.env` remains
   ignored. Establish/document the Node.js runtime baseline.
2. Implement and unit-test configuration validation and strict request/model/public
   Zod schemas.
3. Implement independent date/time, timezone, DST, and strictly-future rules; test
   boundaries against fixed instants.
4. Implement the Gemini structured-output adapter and controlled provider interface;
   verify malformed, blocked, and failed provider outcomes are safely surfaced.
5. Add the Express route, JSON parser bounds, and centralized stable error mapping;
   run HTTP integration tests with the fake interpreter.
6. Implement the 24-case evaluation runner and capture the initial report before
   repairs. Preserve its file without overwriting.
7. Repair failures, document each repair and before/after evidence, rerun unit,
   integration, and evaluation suites, and save final results.
8. Complete API/run/evaluation documentation, document limitations, review
   constitution compliance and evidence, and record a human **ACCEPT** or **REJECT**.

## Technical Risks and Open Decisions

- **Credential in example configuration**: The checked `.env.example` appears to
  contain a credential. Treat it as compromised: rotate/revoke it, replace it with
  placeholders, and inspect any relevant repository history before publishing.
- **Gemini output quality**: Structured generation constrains syntax, not meaning.
  Model versions can differ; pin the configured model, preserve prompt/evaluation
  metadata without sensitive content, and keep semantic scores separate from
  deterministic pass/fail checks.
- **Timezone/DST semantics**: Relative phrases depend on the effective timezone and
  reference instant. Adopt a documented reject-and-clarify policy for ambiguous or
  nonexistent local times; confirm the selected Temporal polyfill version supports
  the target Node runtime.
- **Model schema limitations**: SDK response-schema support can differ from Zod
  features. Keep the provider schema to supported JSON Schema constructs and let
  Zod enforce the full application contract afterward.
- **Configuration policy**: The actual deployment default timezone is
  environment-specific. `Asia/Kolkata` is an example, not a universal fallback.
  Evaluation must inject its case-specific timezone; missing/invalid Gemini or
  timezone configuration must fail reminder requests with HTTP 503 while the
  Express server remains available.
- **No authentication or rate limiting**: The approved v1 scope does not specify
  caller identity or abuse controls. Keep the API key server-side; any public
  deployment requires an explicit security review and access/rate-limit decision.
- **Provider availability/cost**: Routine tests use a fake provider. Live acceptance
  evaluation may be quota- or network-dependent; record model identifier and safe
  run metadata, and do not silently treat unavailable runs as successful.

No remaining product-scope clarification blocks design. The deployment-time
timezone value, Gemini model identifier, and deployment access controls are
configuration/release decisions; use explicit configuration and do not invent
defaults.

## Complexity Tracking

No constitution violations. `@js-temporal/polyfill` is the sole proposed additional
dependency, justified by correct DST-aware resolution without custom timezone math.

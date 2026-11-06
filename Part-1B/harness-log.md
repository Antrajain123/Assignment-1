# Part-1B Harness Log

This log records implementation and verification facts from the project artifacts
and completed checks. It contains no credentials, environment-variable values, or
raw provider payloads.

## Implementation

- Built the Natural Language Reminder API with Node.js, Express, JavaScript ES
  modules, `@google/genai`, Zod, and deterministic date/timezone validation.
- Added configuration handling, `POST /reminders`, structured Gemini
  interpretation, safe error responses, unit/integration tests, and a
  controlled-fixture evaluation runner with 24 scenarios.
- Reminder configuration errors are deferred to request time: the listener can
  start with missing/invalid Gemini or timezone configuration, while reminder
  requests return HTTP 503 `configuration_error`.

## Failures and repairs

- The preserved initial evaluation report records E02 as a failure. Its explicit
  ISO date was mistakenly treated as an ambiguous numeric date. The route was
  repaired to exclude complete ISO dates from that ambiguity check.
- Initial evidence: 24/24 schema, 23/24 deterministic, and 12/13 scored semantic
  checks. The final preserved evaluation report records 24/24 schema, 24/24
  deterministic, and 13/13 scored semantic checks. Semantic checks are scored on
  13 of the 24 scenarios; all 24 scenarios receive schema and deterministic
  checks.
- A live reminder request initially returned HTTP 502 because Gemini returned a
  `time` value that failed the strict `HH:mm` interpretation schema. The prompt
  and Gemini response-schema description were clarified to require zero-padded
  24-hour `HH:mm` without AM/PM. Strict Zod and deterministic validation were
  retained, and focused regression tests were added for valid and invalid time
  formats.

## Verification

- A real, unmocked simple Gemini request to `gemini-3.6-flash` with the prompt
  “Reply with OK only.” succeeded.
- The subsequent real reminder API request using `gemini-3.6-flash` and
  `Asia/Kolkata` returned HTTP 200. It returned “Submit assignment” for
  `2026-11-07` at `10:00` in `Asia/Kolkata`; schema, deterministic, and
  request-specific semantic checks passed.
- Focused prompt/schema tests: `node --test tests/unit/gemini.test.js
  tests/unit/reminder-schema.test.js` — 7 passed, 0 failed.
- Complete validation: `npm run validate` — 27 passed, 0 failed.
- Evaluation: `node tests/evaluation/runner.js` — 24 scenarios; 24/24 schema,
  24/24 deterministic, and 13/13 scored semantic checks; no failed cases.
- The account owner confirmed rotation/revocation of the previously exposed key.
  The replacement key was verified with the successful real Gemini request above.
  No credential values are recorded here.
- Documentation checklist verification is recorded in
  `evaluation/documentation-checklist-results.md`; all five checks are marked
  complete based on README/OpenAPI consistency and the documented command
  results.

## Evaluation limitations

- The controlled evaluation contains 24 scenarios: schema and deterministic
  checks cover all 24, while 13 receive scored semantic evaluation.
- Clarification responses are covered, but clarification-question quality and
  completeness are not fully assessed.
- Fixtures do not measure live Gemini quality; only one real live Gemini reminder
  request has been verified.
- The API does not persist reminders, schedule background jobs, or deliver
  notifications.

## Human review status

### Final review — 2026-11-06

- **Decision**: ACCEPT.
- **Reviewer**: Human (project author).
- The implementation was reviewed against the specification and acceptance
  criteria.
- **Verification**: `npm run validate` passed, 28/28 tests.
- **Evaluation**: 24/24 schema, 24/24 deterministic, and 13/13 scored semantic
  checks passed.
- The initial E02 failure and its repair evidence were reviewed.
- Documented limitations were reviewed and accepted.
- Configuration consistency was checked, including the Gemini model fallback.
- T035 is complete. This entry records the human decision; the verification
  figures above are the results supplied by the reviewer.

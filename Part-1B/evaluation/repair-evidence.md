# Evaluation Repair Evidence

## Baseline

- Command: `node tests/evaluation/runner.js --initial`
- Result: exit 0; report preserved in `initial-results.json`.
- Schema: 24/24.
- Deterministic: 23/24.
- Scenarios: 24 total; semantic results were scored on 13 cases and 12/13 passed.
- Failed case: E02, an explicit ISO date (`2026-03-12`) was incorrectly classified
  as ambiguous because its month/day substring matched the numeric-date guard.

## Repair

- Changed `src/routes/reminders.js` to remove complete ISO dates from the request
  before checking for ambiguous numeric date formats.
- Updated `tests/evaluation/evaluation.test.js` to assert the runner's 13 scored
  semantic cases (12 was stale and did not reflect the cases with expected
  reminder details).
- Updated `contracts/reminders.openapi.yaml` to document the implemented HTTP 500
  `internal_error` response.
- Added API, setup, error, and evaluation instructions to `README.md`.
- Diagnosed the live reminder failure: Gemini returned content, but its `time`
  field failed the existing strict `HH:mm` interpretation schema.
- Clarified the prompt and Gemini schema description to require zero-padded
  24-hour `HH:mm` without AM/PM; retained strict Zod and deterministic validation.
- Added focused tests accepting canonical `HH:mm` and rejecting formats such as
  `10 AM`.

## Evaluation reports

The preserved `initial-results.json` is the baseline (24 scenarios; schema 24/24,
deterministic 23/24, and 12/13 scored semantic checks). The preserved
`final-results.json` records the repaired evaluation (24 scenarios; schema 24/24,
deterministic 24/24, and 13/13 scored semantic checks). E02 now returns the
expected reminder. These reports are historical fixture-evaluation evidence, not
live Gemini results.

## Subsequent verification

- `node tests/evaluation/runner.js` — exit 0; 24/24 schema, 24/24 deterministic,
  and 13/13 scored semantic checks. No failed cases. Semantic scoring applies to
  13 of the 24 scenarios; the other scenarios are checked for schema and
  deterministic behavior.
- `node --test tests/unit/gemini.test.js tests/unit/reminder-schema.test.js` —
  exit 0; 7 tests passed, 0 failed.
- `npm run validate` — exit 0; 27 tests passed, 0 failed.
- Live reminder request through the existing route using `gemini-3.6-flash` and
  `Asia/Kolkata` — HTTP 200; returned a reminder for “Submit assignment” at
  `10:00` on `2026-11-07`; schema, deterministic, and request-specific semantic
  checks passed. No credential or raw provider payload was recorded.
- A separate real `gemini-3.6-flash` diagnostic using the prompt “Reply with OK
  only.” succeeded. The account owner confirmed the previously exposed key was
  rotated/revoked; credentials are not included here.

## Evaluation limitations

- The controlled evaluation contains 24 scenarios. All 24 receive schema and
  deterministic checks; semantic results are scored on 13 of the scenarios.
- Clarification cases are checked for safe clarification behavior, but the
  quality and completeness of the questions are not fully assessed.
- Controlled fixtures do not measure live Gemini quality. Only one real live
  Gemini reminder request has been verified.
- The service does not persist reminders, schedule background jobs, or deliver
  notifications.

## Security follow-up

- The account owner confirmed rotation/revocation of the previously exposed key.
  The credential-like value was removed from `.env.example`; no key values are
  recorded in this evidence.

## Final human review — 2026-11-06

- **Decision**: ACCEPT.
- **Reviewer**: Human (project author).
- The implementation was reviewed against the specification and acceptance
  criteria.
- **Verification**: `npm run validate` passed (28/28 tests).
- **Evaluation**: 24/24 schema, 24/24 deterministic, and 13/13 scored semantic
  checks passed.
- The initial E02 failure and its repair evidence were reviewed.
- Documented limitations were reviewed and accepted.
- Configuration consistency was checked, including the Gemini model fallback.

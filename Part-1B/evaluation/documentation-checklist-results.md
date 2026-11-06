# Documentation Checklist Verification

- Date: 2026-11-06
- Source revision: working tree (no Git repository detected)
- Documents checked: `README.md` and
  `specs/001-natural-language-reminders/contracts/reminders.openapi.yaml`

| Checklist item | Result | Evidence |
|---|---|---|
| Request format | PASS | README documents `POST /reminders`, JSON content type, non-empty `request`, and example; OpenAPI `ReminderRequest` matches. |
| Successful response | PASS | README documents HTTP 200 and reminder fields with optional description; OpenAPI `ReminderSuccess` and `Reminder` match. |
| Error responses | PASS | README lists status/code pairs and error shape without a reminder; OpenAPI includes 400, 422, 502, 503, and 500 with matching error codes. |
| Setup | PASS | README documents Node.js, `npm ci`, environment variables, `Asia/Kolkata`, ignored `.env`, and startup with HTTP 503 behavior for unavailable Gemini/timezone configuration. |
| Tests and evaluation | PASS | README documents `npm test`, `node tests/evaluation/runner.js`, the 24-case schema/deterministic/semantic report, and initial/final report locations. |

## Command results

- `npm run validate` — exit 0; 27 tests passed, 0 failed.
- `node tests/evaluation/runner.js` — exit 0; 24 cases, schema 24/24,
  deterministic 24/24, and 13/13 scored semantic checks. Semantic checks are
  scored on 13 of the 24 scenarios.

Verification was performed against the working-tree documentation and generated
evaluation report. This documentation checklist did not require a live Gemini
call or external reviewers.

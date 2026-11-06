# Documentation Verification Checklist

**Purpose**: Reproducibly verify the API documentation against SC-007.
**Feature**: [spec.md](../spec.md)
**Documentation under review**: `README.md` and
[`contracts/reminders.openapi.yaml`](../contracts/reminders.openapi.yaml)
**Evidence record**: `evaluation/documentation-checklist-results.md`

Run this checklist after the API documentation and evaluation commands are
implemented. Mark an item `[x]` only when the named evidence is present and
consistent across the README and OpenAPI contract where applicable. All five items
must pass.

## Required Checks

- [x] **Request format**: `README.md` names `POST /reminders`, `Content-Type:
  application/json`, the required non-empty `request` string, and provides a valid
  request example. The example agrees with the OpenAPI request schema.
- [x] **Successful response**: `README.md` documents HTTP 200 and the complete
  success JSON shape, including `title`, `date`, `time`, `timezone`, and optional
  `description`. The example agrees with the OpenAPI response schema.
- [x] **Error responses**: `README.md` lists the stable error codes, HTTP status
  mappings, and JSON error shape; it states that error responses contain no
  `reminder`. The mappings agree with the OpenAPI responses.
- [x] **Setup**: `README.md` states the Node.js prerequisite, how to install
  dependencies, required `GEMINI_API_KEY` and `DEFAULT_TIME_ZONE`, the
  `Asia/Kolkata` example, safe `.env` handling, and that the server starts but
  reminder requests return HTTP 503 `configuration_error` when Gemini credentials
  or timezone configuration is missing/invalid.
- [x] **Tests and evaluation**: `README.md` documents `npm test` and
  `node tests/evaluation/runner.js`, explains that the evaluation covers all 24
  scenarios and reports schema, deterministic, and semantic results, and identifies
  where initial and final reports are preserved.

## Reproducible Verification Procedure

1. Read each cited README section and compare API fields/status codes with the
   OpenAPI contract.
2. Run `npm test` and record the exact command and exit status.
3. Run `node tests/evaluation/runner.js` with the documented fixed clock/timezone
   configuration and record the exact command and exit status. Do not overwrite
   initial results while performing documentation verification.
4. Record the date, source revision or `working tree`, each checklist item as PASS
   or FAIL with a short evidence pointer, and both command outcomes in
   `evaluation/documentation-checklist-results.md`. Do not include secrets or raw
   provider payloads.
5. SC-007 passes only when all five documentation checks pass and both documented
   commands complete successfully. No external reviewers or subjective ratings are
   part of this criterion.

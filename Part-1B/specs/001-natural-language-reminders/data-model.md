# Data Model: Natural Language Reminder API

The service is stateless: the entities below are request/response and evaluation
data, not persisted application records.

## Reminder Request

Represents one caller submission to `POST /reminders`.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `request` | string | Yes | Non-empty after trimming; one reminder intent only |

The caller expresses any explicit timezone in the natural-language request. If none
is present, use the validated `DEFAULT_TIME_ZONE` configuration; never infer a
timezone from server locale.

## Model Interpretation

Internal, untrusted model result. It is not returned directly.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `status` | enum | Yes | `ready` or `clarification` |
| `title` | string or null | Yes | Non-empty when status is `ready`; null when clarification is needed |
| `date` | string or null | Yes | `YYYY-MM-DD` when ready; null otherwise |
| `time` | string or null | Yes | `HH:mm` local 24-hour time when ready; null otherwise |
| `timezone` | string or null | Yes | Explicitly stated valid IANA zone when present; otherwise null so application can apply its configured default |
| `description` | string or null | Yes | Optional user-stated detail; null when absent |
| `questions` | string array | Yes | Empty when ready; one or more concise questions when clarification is needed |

Validation uses a strict Zod contract and status-specific invariants. Unknown keys,
wrong types, missing required keys, malformed JSON, or contradictory status/payload
combinations are rejected. The Gemini response schema should use simple constructs
supported by the installed SDK; Zod is authoritative.

## Reminder

Public success value, returned as `{ "reminder": Reminder }`.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `title` | string | Yes | Non-empty after trimming; no invented intent |
| `date` | string | Yes | Real Gregorian calendar date in `YYYY-MM-DD` |
| `time` | string | Yes | Valid local time in `HH:mm`, 24-hour format |
| `timezone` | string | Yes | Valid IANA timezone identifier; explicit request zone wins over configured default |
| `description` | string | No | Include only if supported by caller wording |

### Reminder Invariants

- Resolve local date/time with the effective timezone, not machine-local timezone.
- Reject impossible dates, invalid local times, unknown zones, and DST gaps or
  overlaps; do not silently adjust or select a repeated time.
- Resolve against one captured reference instant. The resolved instant MUST be
  strictly later than that reference instant.
- Return no reminder object unless every schema and deterministic check passes.
- Do not persist, schedule, or deliver reminders.

## Clarification

An error response for missing or ambiguous required information. Its stable error
code is `needs_clarification`; optional `questions` identify details the caller needs
to provide. It never contains a `reminder`.

## API Error

| Field | Type | Required | Rules |
|---|---|---:|---|
| `error.code` | string | Yes | Stable machine-readable code |
| `error.message` | string | Yes | Safe caller-facing message; no secrets, stack, or provider payload |
| `error.questions` | string array | No | Clarification prompts only |

Status/code mappings: `400 invalid_request`; `422 invalid_reminder` or
`needs_clarification`; `503 configuration_error`; `502 interpretation_failed`.
All error bodies are JSON and contain no `reminder`.

## Evaluation Case and Report

An evaluation case consists of a stable ID, category, request or controlled failure,
expected outcome, reference instant, and effective timezone. A report contains the
case results and separate aggregate measures for schema validity, deterministic
invariants, and semantic field matching. Initial results are captured before repairs
and never overwritten; final results use the same case set and configuration.

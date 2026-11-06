# Natural Language Reminder API

A small Express API that interprets one natural-language reminder request with
Gemini, validates the result with Zod and deterministic date/time rules, and
returns a JSON reminder. It does not store reminders, send notifications, or run
background jobs.

## Requirements and setup

- Node.js 22 or later and npm.
- A Gemini API key.
- A valid IANA timezone for `DEFAULT_TIME_ZONE` (example: `Asia/Kolkata`).

Install dependencies and create a local environment file:

```sh
npm ci
cp .env.example .env
```

Set `GEMINI_API_KEY` and `DEFAULT_TIME_ZONE` in `.env`; `PORT` defaults to `3000`
and `GEMINI_MODEL` is optional. `.env` is ignored by Git. Never commit or expose
API keys. The checked-in `.env.example` contains placeholders only.

The HTTP server starts when Gemini configuration or `DEFAULT_TIME_ZONE` is
missing/invalid, provided `PORT` is valid. In that case, reminder requests return
HTTP 503 with `configuration_error`; missing details are never invented.

## Run the server

```sh
npm start
```

## API

### `POST /reminders`

Send `Content-Type: application/json` with a non-empty `request` string:

```json
{
  "request": "Remind me to submit my assignment tomorrow at 10 AM."
}
```

A successful request returns HTTP 200:

```json
{
  "reminder": {
    "title": "Submit my assignment",
    "date": "YYYY-MM-DD",
    "time": "10:00",
    "timezone": "Asia/Kolkata",
    "description": "Optional"
  }
}
```

`description` is omitted when not provided. `date` uses `YYYY-MM-DD`; `time` is
local 24-hour `HH:mm`; `timezone` is an IANA timezone. An explicit timezone in the
request takes precedence over `DEFAULT_TIME_ZONE`. The resolved local time must
be valid, unambiguous in its timezone, and in the future.

Errors use this shape and never include a `reminder`:

```json
{
  "error": {
    "code": "needs_clarification",
    "message": "More information is needed to interpret this reminder.",
    "questions": ["What date should I use?"]
  }
}
```

| HTTP | Error code | Meaning |
|---|---|---|
| 400 | `invalid_request` | Invalid JSON or request body |
| 422 | `needs_clarification` | Required information is missing or ambiguous |
| 422 | `invalid_reminder` | Invalid date/time/timezone or reminder is not in the future |
| 502 | `interpretation_failed` | Gemini failed or returned unusable output |
| 503 | `configuration_error` | Gemini key or default timezone is unavailable |
| 500 | `internal_error` | Unexpected server error |

The complete contract is in
[`specs/001-natural-language-reminders/contracts/reminders.openapi.yaml`](./specs/001-natural-language-reminders/contracts/reminders.openapi.yaml).

## Tests and evaluation

Run unit, integration, and evaluation tests:

```sh
npm test
```

Run the evaluation report directly:

```sh
node tests/evaluation/runner.js
```

The runner evaluates all 24 fixed scenarios and reports schema correctness,
deterministic behavior, and semantic fixture matching. Evaluation uses controlled
provider fixtures; it does not measure live Gemini quality. Initial and final
reports are preserved in `evaluation/initial-results.json` and
`evaluation/final-results.json`; repair details are in
`evaluation/repair-evidence.md`.

## Limitations

This service interprets and validates only. It does not persist reminders, deliver
notifications, or schedule background work. Relative dates are interpreted using
the current request time and configured/explicit timezone.

The evaluation uses 24 controlled scenarios. All 24 receive schema and deterministic
checks; 13 receive scored semantic checks. Clarification-code behavior is covered,
but the quality and completeness of clarification questions are not fully assessed.
Evaluation fixtures do not measure live Gemini quality; only one real live Gemini
reminder request has been verified. A human reviewer must review the implementation
and evidence and record an ACCEPT or REJECT decision.
# Quickstart: Natural Language Reminder API

This guide covers installing, configuring, running, testing, and evaluating the
implemented API. The service interprets and validates reminders; it does not
persist reminders, send notifications, or schedule background work.

Run the commands below from the Part-1B project root.

## Prerequisites

- Node.js 22 or later and npm.
- A Gemini API key.
- A valid IANA timezone for `DEFAULT_TIME_ZONE`; `Asia/Kolkata` is the example
  configuration.

## Install and configure

Install the locked dependencies and create a local environment file:

```sh
npm ci
cp .env.example .env
```

Set `GEMINI_API_KEY` and `DEFAULT_TIME_ZONE` in `.env`. The API key belongs only in
this local environment file or a deployment secret store; never commit `.env`, put
the key in source/client code, or include it in reports. `.env` is ignored by Git.
The checked-in `.env.example` contains placeholders, not credentials.

`GEMINI_MODEL` optionally selects the Gemini model; when omitted, the application
uses `gemini-2.5-flash`. `PORT` defaults to `3000`. The server starts with a valid
port even if Gemini or timezone configuration is missing or invalid; reminder
requests then return HTTP 503 `configuration_error`.

## Start the API

```sh
npm start
```

Send a request to `POST /reminders`:

```sh
curl -sS -X POST http://localhost:3000/reminders \
  -H 'Content-Type: application/json' \
  -d '{"request":"Remind me to submit my assignment tomorrow at 10 AM."}'
```

A successful response has this shape; the date depends on request time and the
configured or explicitly requested timezone:

```json
{
  "reminder": {
    "title": "Submit my assignment",
    "date": "YYYY-MM-DD",
    "time": "10:00",
    "timezone": "Asia/Kolkata"
  }
}
```

For invalid input, ambiguity, invalid/past reminder details, missing
configuration, or provider failure, the API returns the documented error envelope
without a `reminder`. See
[reminders.openapi.yaml](./contracts/reminders.openapi.yaml).

## Run tests and evaluation

Run the complete automated test suite:

```sh
npm test
```

The equivalent package validation command is:

```sh
npm run validate
```

Unit and integration tests use controlled provider fixtures and do not call live
Gemini. Run the separate 24-scenario evaluation with:

```sh
node tests/evaluation/runner.js
```

It reports schema correctness and deterministic behavior for all 24 scenarios.
Semantic checks are scored only where a case has expected reminder details or an
expected clarification; the current evaluation has 13 scored semantic checks.
The runner uses a fixed reference instant and timezone and does not measure live
Gemini quality. It covers clarification response codes, but does not fully assess
the quality or completeness of clarification questions. Only one real live Gemini
reminder request has been verified. The API does not persist reminders, schedule
background jobs, or deliver notifications.

The initial and final evaluation reports are preserved in
`evaluation/initial-results.json` and `evaluation/final-results.json`.
`evaluation/repair-evidence.md` records the failure, repairs, and verification.

## Human review

Review the implementation, tests, evaluation reports, and limitations, then record
a human **ACCEPT** or **REJECT** decision in the repair evidence. Do not treat
passing automated checks as that decision.

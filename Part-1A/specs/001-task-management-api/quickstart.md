# Quickstart: DayFlow Task Management API

DayFlow is a local, single-user REST API backed by a JSON file. The implemented API supports task
creation, listing, detail retrieval, tag filtering, priority sorting, partial updates, deletion, and
the specified status transitions.

## Requirements

- Node.js 22 or newer and npm.
- Run commands from the project root.
- No database, authentication service, frontend, or external runtime service is required.

Check the installed runtime:

```sh
node --version
npm --version
```

## Install

Install the exact dependency versions recorded in the lockfile:

```sh
npm ci
```

## Configure and start

By default, the service stores tasks in `data/tasks.json` and listens on
`http://127.0.0.1:3000`.

To select another trusted local data file, set `DAYFLOW_DATA_FILE` in the environment before
starting the process. This path is operator configuration; requests cannot select the file.

```sh
DAYFLOW_DATA_FILE=/absolute/path/to/tasks.json npm start
```

If the variable is omitted, run:

```sh
npm start
```

Stop the service with `Ctrl+C`. Startup fails rather than serving requests when existing stored
JSON or task records are malformed or invalid.

## Use the API

Create a task:

```sh
curl -i -X POST http://127.0.0.1:3000/tasks \
  -H 'content-type: application/json' \
  -d '{"title":"Prepare notes"}'
```

Successful creation returns HTTP `201` with `{"data":<task>}`. Tasks default to `Pending` status,
`Medium` priority, an empty description, and no tags.

List tasks, filter by an exact case-insensitive tag, or request deterministic priority sorting:

```sh
curl -i 'http://127.0.0.1:3000/tasks'
curl -i 'http://127.0.0.1:3000/tasks?tag=WORK'
curl -i 'http://127.0.0.1:3000/tasks?sort=priority'
```

Priority sorting orders High, Medium, Low; ties are ordered by `createdAt` ascending and then task
ID ascending. Retrieve one task by replacing `<id>` with the ID returned by create/list:

```sh
curl -i 'http://127.0.0.1:3000/tasks/<id>'
```

Update permitted task fields, change status, or delete a task:

```sh
curl -i -X PATCH 'http://127.0.0.1:3000/tasks/<id>' \
  -H 'content-type: application/json' \
  -d '{"description":"Review and finish"}'
curl -i -X PATCH 'http://127.0.0.1:3000/tasks/<id>/status' \
  -H 'content-type: application/json' \
  -d '{"status":"InProgress"}'
curl -i -X DELETE 'http://127.0.0.1:3000/tasks/<id>'
```

Only `Pending` → `InProgress`, `InProgress` → `Completed`, and `Completed` → `InProgress` are
allowed. Invalid requests use HTTP `400`, unknown task IDs use `404`, and rejected status
transitions use `409`. Errors have the JSON shape
`{"error":{"code":"...","message":"..."}}`. The complete contract is in
[contracts/openapi.yaml](./contracts/openapi.yaml).

JSON request bodies are limited to 1,048,576 UTF-8 bytes. Bodies at or below the limit proceed to
normal validation; larger bodies receive HTTP `413` with `PAYLOAD_TOO_LARGE`.

## Run checks

Run the test suite, lint, or the package's syntax command individually:

```sh
npm test
npm run lint
npm run syntax
```

Run all deterministic validation gates in their configured order:

```sh
npm run validate
```

The harness runs lint, syntax checks, local security tests, and all Node.js tests. It returns a
failure status if any gate fails and records diagnostics under
`evidence/initial-generation/validation/`. Do not bypass a failing gate.

The tests use temporary JSON files and remove them after execution. They cover persistence across
app restarts, invalid stored-data handling, API contracts, and the 1,048,575-, 1,048,576-, and
1,048,577-byte request boundaries.

## Evidence locations

- Initial implementation and validation evidence: `evidence/initial-generation/`.
- Corrected implementation and rerun validation evidence: `evidence/final-generation/`.

Keep the two generations separate. Final acceptance requires a human `ACCEPT` or `REJECT` after
reviewing the recorded results.

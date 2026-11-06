# DayFlow validation harness

Run the canonical validation gates from the project root:

```sh
npm run validate
```

Or invoke the thin harness entry point:

```sh
node .harness/run-validation.js
```

Both entry points delegate to `scripts/validate.js`, which runs lint, syntax,
security, and automated tests in that order and saves timestamped diagnostics
under the selected evidence generation. No checks are duplicated or skipped.

The test command targets the live `test/` directory so preserved implementation
snapshots under `evidence/` are not rediscovered and executed as active tests.

import test from "node:test";
import assert from "node:assert/strict";

import { runEvaluation } from "./runner.js";

test("all 24 controlled evaluation scenarios satisfy schema and deterministic checks", async () => {
  const report = await runEvaluation();

  assert.equal(report.totalCases, 24);
  assert.equal(report.summary.schema.passed, 24);
  assert.equal(report.summary.deterministic.passed, 24);
  assert.equal(report.summary.semantic.total, 13);
  assert.equal(report.summary.semantic.passed, 13);
});

test("evaluation report identifies any failing cases", async () => {
  const report = await runEvaluation();

  assert.deepEqual(
    report.cases.filter(
      (result) =>
        !result.schemaCorrect ||
        !result.deterministicCorrect ||
        result.semanticCorrect === false,
    ),
    [],
  );
});

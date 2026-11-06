import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { createApp } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";
import { createReminderRouter } from "../../src/routes/reminders.js";
import { ReminderSchema, ErrorResponseSchema } from "../../src/validation/reminder-schema.js";
import { withHttpServer } from "../helpers/http-server.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "../..");
const fixedInstant = "2026-03-10T12:00:00Z";
const fixedTimeZone = "America/New_York";
const baseEnvironment = {
  GEMINI_API_KEY: "evaluation-only-placeholder",
  DEFAULT_TIME_ZONE: fixedTimeZone,
  PORT: "3000",
};

async function loadCases() {
  return JSON.parse(
    await readFile(path.join(here, "cases.json"), "utf8"),
  );
}

async function evaluateOne(testCase) {
  const config = loadConfig({
    ...baseEnvironment,
    ...testCase.configOverride,
  });
  const interpreter = {
    async interpret() {
      if (testCase.providerFailure) {
        const error = new Error("controlled provider failure");
        error.code = "interpretation_failed";
        throw error;
      }
      return testCase.interpretation;
    },
  };
  const router = createReminderRouter({
    config,
    interpreter,
    clock: () => new Date(fixedInstant),
  });
  const app = createApp({ config, reminderRouter: router });

  return withHttpServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/reminders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request: testCase.request }),
    });
    const body = await response.json();
    const responseSchemaValid =
      response.status === 200
        ? ReminderSchema.safeParse(body.reminder).success &&
          body.error === undefined
        : ErrorResponseSchema.safeParse(body).success &&
          body.reminder === undefined;
    const expectedCode = testCase.expected.code;
    const deterministicPassed =
      response.status === testCase.expected.status &&
      (expectedCode ? body.error?.code === expectedCode : true) &&
      (response.status !== 200 || body.reminder !== undefined) &&
      (response.status === 200 || body.reminder === undefined);
    const semanticPassed = testCase.expected.reminder
      ? Object.entries(testCase.expected.reminder).every(
          ([field, value]) => body.reminder?.[field] === value,
        )
      : expectedCode === "needs_clarification"
        ? body.error?.code === "needs_clarification"
        : null;

    return {
      id: testCase.id,
      category: testCase.category,
      actualStatus: response.status,
      actualCode: body.error?.code ?? null,
      schemaCorrect: responseSchemaValid,
      deterministicCorrect: deterministicPassed,
      semanticCorrect: semanticPassed,
    };
  });
}

export async function runEvaluation() {
  const cases = await loadCases();
  const results = [];

  for (const testCase of cases) {
    results.push(await evaluateOne(testCase));
  }

  const countPassed = (key) =>
    results.filter((result) => result[key] === true).length;
  const countScored = (key) =>
    results.filter((result) => result[key] !== null).length;

  return {
    evaluationMode: "controlled-provider-fixtures",
    referenceInstant: fixedInstant,
    defaultTimeZone: fixedTimeZone,
    totalCases: results.length,
    summary: {
      schema: { passed: countPassed("schemaCorrect"), total: results.length },
      deterministic: {
        passed: countPassed("deterministicCorrect"),
        total: results.length,
      },
      semantic: {
        passed: countPassed("semanticCorrect"),
        total: countScored("semanticCorrect"),
      },
    },
    cases: results,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await runEvaluation();
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  const targetArg = process.argv[2];

  if (targetArg === "--initial" || targetArg === "--final") {
    const name =
      targetArg === "--initial" ? "initial-results.json" : "final-results.json";
    const target = path.join(projectRoot, "evaluation", name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, serialized, { flag: "wx" });
    console.log(`Wrote ${path.relative(projectRoot, target)}`);
  } else {
    process.stdout.write(serialized);
  }
}

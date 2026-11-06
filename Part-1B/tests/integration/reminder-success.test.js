import test from "node:test";
import assert from "node:assert/strict";

import { createApp } from "../../src/app.js";
import { createReminderRouter } from "../../src/routes/reminders.js";
import { loadConfig } from "../../src/config.js";
import { withHttpServer } from "../helpers/http-server.js";

const config = loadConfig({
  GEMINI_API_KEY: "test-key",
  DEFAULT_TIME_ZONE: "America/New_York",
  PORT: "3000",
});

function createReadyInterpreter(extra = {}) {
  return {
    async interpret() {
      return {
        status: "ready",
        title: "Submit assignment",
        date: "2026-03-11",
        time: "10:00",
        timezone: null,
        description: null,
        questions: [],
        ...extra,
      };
    },
  };
}

test("POST /reminders returns one validated reminder for a clear request", async () => {
  const app = createApp({
    config,
    clock: () => new Date("2026-03-10T12:00:00Z"),
    reminderRouter: createReminderRouter({
      config,
      clock: () => new Date("2026-03-10T12:00:00Z"),
      interpreter: createReadyInterpreter(),
    }),
  });

  await withHttpServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/reminders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        request: "Remind me to submit my assignment tomorrow at 10 AM.",
      }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      reminder: {
        title: "Submit assignment",
        date: "2026-03-11",
        time: "10:00",
        timezone: "America/New_York",
      },
    });
  });
});

test("POST /reminders honors model-extracted timezone and stated description", async () => {
  const app = createApp({
    config,
    clock: () => new Date("2026-03-10T12:00:00Z"),
    reminderRouter: createReminderRouter({
      config,
      clock: () => new Date("2026-03-10T12:00:00Z"),
      interpreter: createReadyInterpreter({
        timezone: "Europe/London",
        description: "Bring the signed form.",
      }),
    }),
  });

  await withHttpServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/reminders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request: "Call the office tomorrow at 9 AM in London." }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      reminder: {
        title: "Submit assignment",
        date: "2026-03-11",
        time: "10:00",
        timezone: "Europe/London",
        description: "Bring the signed form.",
      },
    });
  });
});

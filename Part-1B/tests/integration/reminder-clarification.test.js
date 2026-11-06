import test from "node:test";
import assert from "node:assert/strict";

import { createApp } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";
import { createReminderRouter } from "../../src/routes/reminders.js";
import { withHttpServer } from "../helpers/http-server.js";

const config = loadConfig({
  GEMINI_API_KEY: "test-key",
  DEFAULT_TIME_ZONE: "America/New_York",
  PORT: "3000",
});

test("clarification response has questions and never contains a reminder", async () => {
  const app = createApp({
    config,
    reminderRouter: createReminderRouter({
      config,
      interpreter: {
        async interpret() {
          return {
            status: "clarification",
            title: null,
            date: null,
            time: null,
            timezone: null,
            description: null,
            questions: ["What date should I use?"],
          };
        },
      },
    }),
  });

  await withHttpServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/reminders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request: "Remind me to submit my assignment." }),
    });
    const body = await response.json();

    assert.equal(response.status, 422);
    assert.equal(body.error.code, "needs_clarification");
    assert.deepEqual(body.error.questions, ["What date should I use?"]);
    assert.equal("reminder" in body, false);
  });
});

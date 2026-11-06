import test from "node:test";
import assert from "node:assert/strict";

import { createApp } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";
import { createReminderRouter } from "../../src/routes/reminders.js";
import { createGeminiInterpreter } from "../../src/services/gemini.js";
import { withHttpServer } from "../helpers/http-server.js";

const env = {
  GEMINI_API_KEY: "test-key",
  DEFAULT_TIME_ZONE: "America/New_York",
  PORT: "3000",
};

function appFor(config, interpreter = { async interpret() { throw new Error("must not run"); } }) {
  return createApp({
    config,
    reminderRouter: createReminderRouter({ config, interpreter }),
  });
}

test("missing and invalid Gemini configuration still listens and returns 503", async () => {
  const configs = [
    loadConfig({ ...env, GEMINI_API_KEY: "" }),
    loadConfig({ ...env, DEFAULT_TIME_ZONE: "Mars/Olympus" }),
  ];

  for (const config of configs) {
    const app = appFor(config);
    await withHttpServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/reminders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ request: "Call Alex tomorrow at 10 AM." }),
      });
      const body = await response.json();

      assert.equal(response.status, 503);
      assert.equal(body.error.code, "configuration_error");
      assert.equal("reminder" in body, false);
    });
  }
});

test("configuration failure takes precedence over ambiguous requests", async () => {
  const config = loadConfig({ ...env, DEFAULT_TIME_ZONE: "" });
  const app = appFor(config);

  await withHttpServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/reminders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request: "Remind me on 03/04 at 9 AM." }),
    });
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.equal(body.error.code, "configuration_error");
    assert.equal("reminder" in body, false);
  });
});

test("invalid request, malformed JSON, and invalid model output use safe errors", async () => {
  const config = loadConfig(env);
  const app = appFor(config, {
    async interpret() {
      return { status: "ready", title: "incomplete" };
    },
  });

  await withHttpServer(app, async (baseUrl) => {
    const empty = await fetch(`${baseUrl}/reminders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request: " " }),
    });
    assert.equal(empty.status, 400);
    assert.equal((await empty.json()).error.code, "invalid_request");

    const malformed = await fetch(`${baseUrl}/reminders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).error.code, "invalid_request");

    const badModel = await fetch(`${baseUrl}/reminders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request: "Call Alex tomorrow at 10 AM." }),
    });
    const body = await badModel.json();
    assert.equal(badModel.status, 502);
    assert.equal(body.error.code, "interpretation_failed");
    assert.equal("reminder" in body, false);
  });
});

test("provider errors are sanitized", async () => {
  const config = loadConfig(env);
  const app = appFor(config, {
    async interpret() {
      const error = new Error("private provider response");
      error.code = "interpretation_failed";
      throw error;
    },
  });

  await withHttpServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/reminders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request: "Call Alex tomorrow at 10 AM." }),
    });
    const body = await response.json();

    assert.equal(response.status, 502);
    assert.equal(body.error.code, "interpretation_failed");
    assert.equal(JSON.stringify(body).includes("private provider response"), false);
  });
});

test("provider timeouts return a safe interpretation error", async () => {
  const config = loadConfig(env);
  const interpreter = createGeminiInterpreter({
    client: {
      models: {
        async generateContent() {
          const error = new Error("private timeout details");
          error.name = "AbortError";
          throw error;
        },
      },
    },
    model: "test-model",
  });
  const app = appFor(config, interpreter);

  await withHttpServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/reminders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ request: "Call Alex tomorrow at 10 AM." }),
    });
    const body = await response.json();

    assert.equal(response.status, 502);
    assert.equal(body.error.code, "interpretation_failed");
    assert.equal("reminder" in body, false);
    assert.equal(JSON.stringify(body).includes("private timeout details"), false);
  });
});

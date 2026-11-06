import test from "node:test";
import assert from "node:assert/strict";

import { createGeminiInterpreter } from "../../src/services/gemini.js";

const modelOutput = JSON.stringify({
  status: "ready",
  title: "Submit assignment",
  date: "2026-03-11",
  time: "10:00",
  timezone: null,
  description: null,
  questions: [],
});

test("Gemini adapter requests structured JSON with reference time and timezone", async () => {
  let call;
  const interpreter = createGeminiInterpreter({
    client: {
      models: {
        async generateContent(value) {
          call = value;
          return { text: modelOutput };
        },
      },
    },
    model: "test-model",
  });

  const result = await interpreter.interpret({
    request: "Remind me tomorrow at 10 AM.",
    referenceInstant: "2026-03-10T12:00:00Z",
    defaultTimeZone: "Asia/Kolkata",
  });

  assert.equal(result.status, "ready");
  assert.equal(call.model, "test-model");
  assert.equal(call.config.responseMimeType, "application/json");
  assert.equal(call.config.responseSchema.type, "OBJECT");
  assert.match(call.contents, /exactly/);
  assert.match(call.contents, /HH:mm 24-hour format with leading zeros/);
  assert.match(call.contents, /do not use AM\/PM/);
  assert.match(call.config.responseSchema.properties.time.description, /HH:mm 24-hour format with leading zeros/);
  assert.match(call.contents, /2026-03-10T12:00:00Z/);
  assert.match(call.contents, /Asia\/Kolkata/);
});

test("Gemini adapter maps provider and malformed-output failures to safe service errors", async () => {
  const providerFailure = createGeminiInterpreter({
    client: {
      models: {
        async generateContent() {
          throw new Error("sensitive provider details");
        },
      },
    },
    model: "test-model",
  });

  await assert.rejects(
    providerFailure.interpret({
      request: "Call Alex tomorrow at 10 AM.",
      referenceInstant: "2026-03-10T12:00:00Z",
      defaultTimeZone: "Asia/Kolkata",
    }),
    (error) =>
      error.code === "interpretation_failed" &&
      !error.message.includes("sensitive"),
  );

  const malformedOutput = createGeminiInterpreter({
    client: {
      models: {
        async generateContent() {
          return { text: "" };
        },
      },
    },
    model: "test-model",
  });

  await assert.rejects(
    malformedOutput.interpret({
      request: "Call Alex tomorrow at 10 AM.",
      referenceInstant: "2026-03-10T12:00:00Z",
      defaultTimeZone: "Asia/Kolkata",
    }),
    { code: "interpretation_failed" },
  );

  const blockedOutput = createGeminiInterpreter({
    client: {
      models: {
        async generateContent() {
          return { promptFeedback: { blockReason: "SAFETY" } };
        },
      },
    },
    model: "test-model",
  });

  await assert.rejects(
    blockedOutput.interpret({
      request: "Call Alex tomorrow at 10 AM.",
      referenceInstant: "2026-03-10T12:00:00Z",
      defaultTimeZone: "Asia/Kolkata",
    }),
    { code: "interpretation_failed" },
  );

  const malformedJson = createGeminiInterpreter({
    client: {
      models: {
        async generateContent() {
          return { text: "{not-json" };
        },
      },
    },
    model: "test-model",
  });

  await assert.rejects(
    malformedJson.interpret({
      request: "Call Alex tomorrow at 10 AM.",
      referenceInstant: "2026-03-10T12:00:00Z",
      defaultTimeZone: "Asia/Kolkata",
    }),
    { code: "interpretation_failed" },
  );

  const timeoutFailure = createGeminiInterpreter({
    client: {
      models: {
        async generateContent() {
          const error = new Error("request timed out");
          error.name = "AbortError";
          throw error;
        },
      },
    },
    model: "test-model",
  });

  await assert.rejects(
    timeoutFailure.interpret({
      request: "Call Alex tomorrow at 10 AM.",
      referenceInstant: "2026-03-10T12:00:00Z",
      defaultTimeZone: "Asia/Kolkata",
    }),
    { code: "interpretation_failed" },
  );
});

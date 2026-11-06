import test from "node:test";
import assert from "node:assert/strict";

import { loadConfig } from "../../src/config.js";

const validEnv = {
  GEMINI_API_KEY: "test-key",
  DEFAULT_TIME_ZONE: "Asia/Kolkata",
  GEMINI_MODEL: "gemini-test",
  PORT: "3000",
};

test("valid reminder configuration accepts the example timezone", () => {
  const config = loadConfig(validEnv);

  assert.equal(config.port, 3000);
  assert.equal(config.defaultTimeZone, "Asia/Kolkata");
  assert.equal(config.geminiApiKey, "test-key");
  assert.equal(config.reminderConfigurationError, null);
});

test("missing Gemini model uses the gemini-3.6-flash fallback", () => {
  const { GEMINI_MODEL, ...envWithoutModel } = validEnv;

  assert.equal(GEMINI_MODEL, "gemini-test");
  assert.equal(loadConfig(envWithoutModel).geminiModel, "gemini-3.6-flash");
});

test("missing Gemini key leaves listener configuration available but disables reminders", () => {
  const config = loadConfig({ ...validEnv, GEMINI_API_KEY: "" });

  assert.equal(config.port, 3000);
  assert.equal(config.reminderConfigurationError.code, "configuration_error");
  assert.equal(config.geminiApiKey, null);
});

test("missing or invalid timezone leaves listener configuration available but disables reminders", () => {
  for (const timezone of ["", "Mars/Olympus"]) {
    const config = loadConfig({ ...validEnv, DEFAULT_TIME_ZONE: timezone });

    assert.equal(config.port, 3000);
    assert.equal(config.reminderConfigurationError.code, "configuration_error");
    assert.equal(config.defaultTimeZone, null);
  }
});

test("invalid listener port is rejected independently", () => {
  assert.throws(
    () => loadConfig({ ...validEnv, PORT: "70000" }),
    { code: "invalid_listener_configuration" },
  );
});

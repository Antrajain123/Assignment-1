import test from "node:test";
import assert from "node:assert/strict";

import { validateReminder } from "../../src/validation/reminder-rules.js";

const referenceInstant = "2026-03-10T12:00:00Z";
const reminder = {
  title: "Meet Alex",
  date: "2026-03-11",
  time: "10:00",
  timezone: "America/New_York",
};

test("valid future local reminder resolves to a future instant", () => {
  const result = validateReminder(reminder, { referenceInstant });

  assert.equal(result.timezone, "America/New_York");
  assert.ok(result.instant > Date.parse(referenceInstant));
});

test("rejects impossible dates and invalid timezones", () => {
  assert.throws(
    () => validateReminder({ ...reminder, date: "2026-02-30" }, { referenceInstant }),
    { code: "invalid_reminder" },
  );
  assert.throws(
    () =>
      validateReminder(
        { ...reminder, timezone: "Mars/Olympus" },
        { referenceInstant },
      ),
    { code: "invalid_reminder" },
  );
});

test("rejects nonexistent and ambiguous daylight-saving local times", () => {
  assert.throws(
    () =>
      validateReminder(
        {
          ...reminder,
          date: "2026-03-08",
          time: "02:30",
        },
        { referenceInstant, timeZone: "America/New_York" },
      ),
    { code: "invalid_reminder" },
  );

  assert.throws(
    () =>
      validateReminder(
        {
          ...reminder,
          date: "2026-11-01",
          time: "01:30",
        },
        { referenceInstant, timeZone: "America/New_York" },
      ),
    { code: "invalid_reminder" },
  );
});

test("rejects reminders at or before reference instant", () => {
  for (const time of ["07:00", "08:00"]) {
    assert.throws(
      () =>
        validateReminder(
          { ...reminder, date: "2026-03-10", time },
          { referenceInstant },
        ),
      { code: "invalid_reminder" },
    );
  }
});

test("uses explicit timezone before configured default", () => {
  const result = validateReminder(
    { ...reminder, date: "2026-03-11", time: "10:00", timezone: "Europe/London" },
    { referenceInstant, timeZone: "Asia/Kolkata" },
  );

  assert.equal(result.timezone, "Europe/London");
});

test("uses configured default timezone when reminder has no explicit timezone", () => {
  const result = validateReminder(
    { ...reminder, timezone: null },
    { referenceInstant, timeZone: "Asia/Kolkata" },
  );

  assert.equal(result.timezone, "Asia/Kolkata");
});

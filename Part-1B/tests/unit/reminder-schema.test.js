import test from "node:test";
import assert from "node:assert/strict";

import {
  ReminderInterpretationSchema,
  ReminderRequestSchema,
  ReminderSchema,
} from "../../src/validation/reminder-schema.js";

const ready = {
  status: "ready",
  title: "Submit assignment",
  date: "2026-03-11",
  time: "10:00",
  timezone: null,
  description: null,
  questions: [],
};

test("request requires a non-empty trimmed request and rejects extra keys", () => {
  assert.equal(ReminderRequestSchema.safeParse({ request: "  " }).success, false);
  assert.equal(ReminderRequestSchema.safeParse({ request: "Call Alex" }).success, true);
  assert.equal(
    ReminderRequestSchema.safeParse({ request: "Call Alex", extra: true }).success,
    false,
  );
});

test("ready interpretation requires correct fields and rejects unknown fields", () => {
  assert.equal(ReminderInterpretationSchema.safeParse(ready).success, true);
  assert.equal(
    ReminderInterpretationSchema.safeParse({ ...ready, extra: true }).success,
    false,
  );
  assert.equal(
    ReminderInterpretationSchema.safeParse({ ...ready, title: 12 }).success,
    false,
  );
  assert.equal(
    ReminderInterpretationSchema.safeParse({ ...ready, questions: ["What date?"] })
      .success,
    false,
  );
});

test("reminder time schemas accept HH:mm and reject non-canonical formats", () => {
  for (const time of ["00:00", "09:05", "23:59"]) {
    assert.equal(
      ReminderInterpretationSchema.safeParse({ ...ready, time }).success,
      true,
      `interpretation should accept ${time}`,
    );
    assert.equal(
      ReminderSchema.safeParse({
        title: "Submit assignment",
        date: "2026-03-11",
        time,
        timezone: "Asia/Kolkata",
      }).success,
      true,
      `reminder should accept ${time}`,
    );
  }

  for (const time of ["10 AM", "9:05", "24:00", "25:75"]) {
    assert.equal(
      ReminderInterpretationSchema.safeParse({ ...ready, time }).success,
      false,
      `interpretation should reject ${time}`,
    );
    assert.equal(
      ReminderSchema.safeParse({
        title: "Submit assignment",
        date: "2026-03-11",
        time,
        timezone: "Asia/Kolkata",
      }).success,
      false,
      `reminder should reject ${time}`,
    );
  }
});

test("clarification interpretation requires questions and no invented reminder fields", () => {
  const clarification = {
    status: "clarification",
    title: null,
    date: null,
    time: null,
    timezone: null,
    description: null,
    questions: ["What date should I use?"],
  };

  assert.equal(ReminderInterpretationSchema.safeParse(clarification).success, true);
  assert.equal(
    ReminderInterpretationSchema.safeParse({
      ...clarification,
      questions: [],
    }).success,
    false,
  );
  assert.equal(
    ReminderInterpretationSchema.safeParse({
      ...clarification,
      title: "Invented title",
    }).success,
    false,
  );
});

test("public reminder validates required fields and optional description", () => {
  const reminder = {
    title: "Submit assignment",
    date: "2026-03-11",
    time: "10:00",
    timezone: "Asia/Kolkata",
  };

  assert.equal(ReminderSchema.safeParse(reminder).success, true);
  assert.equal(
    ReminderSchema.safeParse({ ...reminder, description: "Bring ID" }).success,
    true,
  );
  assert.equal(ReminderSchema.safeParse({ ...reminder, date: "yesterday" }).success, false);
  assert.equal(ReminderSchema.safeParse({ ...reminder, time: "25:75" }).success, false);
  assert.equal(ReminderSchema.safeParse({ ...reminder, title: "" }).success, false);
  assert.equal(
    ReminderSchema.safeParse({ ...reminder, unknown: "not allowed" }).success,
    false,
  );
});

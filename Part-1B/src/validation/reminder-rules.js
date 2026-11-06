import { Temporal } from "@js-temporal/polyfill";

import { invalidReminder } from "../errors.js";

function validTimeZone(value) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function validateReminder(reminder, { referenceInstant, timeZone }) {
  const effectiveTimeZone = reminder.timezone ?? timeZone;

  if (!effectiveTimeZone || !validTimeZone(effectiveTimeZone)) {
    throw invalidReminder("A valid reminder timezone is required.");
  }

  let localDateTime;
  let reference;
  try {
    const date = Temporal.PlainDate.from(reminder.date);
    const time = Temporal.PlainTime.from(reminder.time);
    if (date.toString() !== reminder.date || time.toString({ smallestUnit: "minute" }) !== reminder.time) {
      throw new RangeError("Non-canonical local date or time.");
    }

    localDateTime = Temporal.ZonedDateTime.from(
      {
        timeZone: effectiveTimeZone,
        year: date.year,
        month: date.month,
        day: date.day,
        hour: time.hour,
        minute: time.minute,
      },
      { disambiguation: "reject" },
    );
    reference = Temporal.Instant.from(referenceInstant);
  } catch {
    throw invalidReminder(
      "The date, time, or timezone is invalid or ambiguous.",
    );
  }

  const instant = localDateTime.toInstant();
  if (Temporal.Instant.compare(instant, reference) <= 0) {
    throw invalidReminder("The reminder time must be in the future.");
  }

  return {
    ...reminder,
    timezone: effectiveTimeZone,
    instant: instant.epochMilliseconds,
  };
}

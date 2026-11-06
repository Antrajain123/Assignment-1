import { Router } from "express";

import {
  configurationError,
  interpretationFailed,
  invalidRequest,
  needsClarification,
} from "../errors.js";
import {
  ReminderInterpretationSchema,
  ReminderRequestSchema,
  ReminderSchema,
} from "../validation/reminder-schema.js";
import { validateReminder } from "../validation/reminder-rules.js";

function deterministicClarification(request) {
  const withoutIsoDates = request.replace(/\b\d{4}-\d{2}-\d{2}\b/g, "");
  if (/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/.test(withoutIsoDates)) {
    return ["Please provide the date in an unambiguous format, such as YYYY-MM-DD."];
  }

  if (/\b(?:at|by)\s+(?:[1-9]|1[0-2])\b(?!\s*(?:am|pm)\b)(?!\s*:)/i.test(request)) {
    return ["Please specify AM/PM or provide the time in 24-hour format."];
  }

  if (
    /\b(?:and then|and)\s+(?:remind me to\s+)?(?:call|pay|email|submit|take|meet|send|visit|buy|finish|pick up)\b/i.test(
      request,
    )
  ) {
    return ["Please submit one reminder request at a time."];
  }

  return null;
}

export function createReminderRouter({ config, interpreter, clock = () => new Date() }) {
  const router = Router();

  router.post("/reminders", async (req, res, next) => {
    const requestResult = ReminderRequestSchema.safeParse(req.body);
    if (!requestResult.success) {
      next(invalidRequest());
      return;
    }

    if (config.reminderConfigurationError || !interpreter) {
      next(configurationError());
      return;
    }

    const questions = deterministicClarification(requestResult.data.request);
    if (questions) {
      next(needsClarification(questions));
      return;
    }

    const now = clock();
    const referenceInstant =
      now instanceof Date ? now.toISOString() : new Date(now).toISOString();

    let rawInterpretation;
    try {
      rawInterpretation = await interpreter.interpret({
        request: requestResult.data.request,
        referenceInstant,
        defaultTimeZone: config.defaultTimeZone,
      });
    } catch (error) {
      if (error?.code === "interpretation_failed") {
        next(interpretationFailed());
        return;
      }
      next(error);
      return;
    }

    const parsedInterpretation =
      ReminderInterpretationSchema.safeParse(rawInterpretation);
    if (!parsedInterpretation.success) {
      next(interpretationFailed());
      return;
    }

    const interpretation = parsedInterpretation.data;
    if (interpretation.status === "clarification") {
      next(needsClarification(interpretation.questions));
      return;
    }

    const validated = validateReminder(
      {
        title: interpretation.title,
        date: interpretation.date,
        time: interpretation.time,
        timezone: interpretation.timezone,
        ...(interpretation.description === null
          ? {}
          : { description: interpretation.description }),
      },
      {
        referenceInstant,
        timeZone: config.defaultTimeZone,
      },
    );

    const reminder = {
      title: validated.title,
      date: validated.date,
      time: validated.time,
      timezone: validated.timezone,
      ...(validated.description === undefined
        ? {}
        : { description: validated.description }),
    };

    const publicReminder = ReminderSchema.safeParse(reminder);
    if (!publicReminder.success) {
      next(interpretationFailed());
      return;
    }

    res.status(200).json({ reminder: publicReminder.data });
  });

  return router;
}

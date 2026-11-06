import { z } from "zod";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const ReminderRequestSchema = z
  .object({
    request: z.string().trim().min(1),
  })
  .strict();

const readyInterpretationSchema = z
  .object({
    status: z.literal("ready"),
    title: z.string().trim().min(1),
    date: z.string().regex(datePattern),
    time: z.string().regex(timePattern),
    timezone: z.string().trim().min(1).nullable(),
    description: z.string().nullable(),
    questions: z.array(z.string()).length(0),
  })
  .strict();

const clarificationInterpretationSchema = z
  .object({
    status: z.literal("clarification"),
    title: z.null(),
    date: z.null(),
    time: z.null(),
    timezone: z.string().trim().min(1).nullable(),
    description: z.null(),
    questions: z.array(z.string().trim().min(1)).min(1),
  })
  .strict();

export const ReminderInterpretationSchema = z.discriminatedUnion("status", [
  readyInterpretationSchema,
  clarificationInterpretationSchema,
]);

export const ReminderSchema = z
  .object({
    title: z.string().trim().min(1),
    date: z.string().regex(datePattern),
    time: z.string().regex(timePattern),
    timezone: z.string().trim().min(1),
    description: z.string().optional(),
  })
  .strict();

export const ErrorResponseSchema = z
  .object({
    error: z
      .object({
        code: z.enum([
          "invalid_request",
          "invalid_reminder",
          "needs_clarification",
          "configuration_error",
          "interpretation_failed",
          "internal_error",
        ]),
        message: z.string().min(1),
        questions: z.array(z.string()).optional(),
      })
      .strict(),
  })
  .strict();

export const GeminiResponseSchema = {
  type: "OBJECT",
  properties: {
    status: { type: "STRING", enum: ["ready", "clarification"] },
    title: { type: "STRING", nullable: true },
    date: { type: "STRING", nullable: true },
    time: {
      type: "STRING",
      nullable: true,
      description:
        "Local time exactly in HH:mm 24-hour format with leading zeros; no AM/PM (for example 09:05).",
    },
    timezone: { type: "STRING", nullable: true },
    description: { type: "STRING", nullable: true },
    questions: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: [
    "status",
    "title",
    "date",
    "time",
    "timezone",
    "description",
    "questions",
  ],
};

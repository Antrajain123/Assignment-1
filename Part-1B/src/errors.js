export class AppError extends Error {
  constructor(status, code, message, questions) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    if (questions) {
      this.questions = questions;
    }
  }
}

export const invalidRequest = (message = "Provide a valid reminder request.") =>
  new AppError(400, "invalid_request", message);

export const invalidReminder = (message = "Reminder details are invalid.") =>
  new AppError(422, "invalid_reminder", message);

export const needsClarification = (questions) =>
  new AppError(
    422,
    "needs_clarification",
    "More information is needed to interpret this reminder.",
    questions,
  );

export const configurationError = () =>
  new AppError(
    503,
    "configuration_error",
    "Reminder service configuration is unavailable.",
  );

export const interpretationFailed = () =>
  new AppError(
    502,
    "interpretation_failed",
    "The reminder could not be interpreted. Please try again.",
  );

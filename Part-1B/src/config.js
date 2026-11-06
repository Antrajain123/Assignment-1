function isValidTimeZone(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function isConfiguredApiKey(value) {
  return (
    typeof value === "string" &&
    value.trim() !== "" &&
    !value.trim().startsWith("replace_with_")
  );
}

export function loadConfig(env = process.env) {
  const rawPort = env.PORT ?? "3000";
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    const error = new Error("PORT must be an integer from 1 to 65535.");
    error.code = "invalid_listener_configuration";
    throw error;
  }

  const apiKey = isConfiguredApiKey(env.GEMINI_API_KEY)
    ? env.GEMINI_API_KEY.trim()
    : null;
  const defaultTimeZone = isValidTimeZone(env.DEFAULT_TIME_ZONE)
    ? env.DEFAULT_TIME_ZONE.trim()
    : null;
  const reasons = [];

  if (!apiKey) {
    reasons.push("Gemini API key is missing or invalid.");
  }
  if (!defaultTimeZone) {
    reasons.push("Default timezone is missing or invalid.");
  }

  return {
    port,
    geminiApiKey: apiKey,
    geminiModel: env.GEMINI_MODEL?.trim() || "gemini-3.6-flash",
    defaultTimeZone,
    reminderConfigurationError: reasons.length
      ? {
          code: "configuration_error",
          message: "Reminder service configuration is unavailable.",
        }
      : null,
  };
}

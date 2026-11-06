import { TaskValidationError } from "../validation/task-validation.js";

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function mapError(error) {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof TaskValidationError) {
    return new ApiError(400, "VALIDATION_ERROR", error.message);
  }
  if (error?.type === "entity.too.large") {
    return new ApiError(413, "PAYLOAD_TOO_LARGE", "JSON request body exceeds 1 MiB");
  }
  if (error?.type === "entity.parse.failed") {
    return new ApiError(400, "INVALID_JSON", "Request body must contain valid JSON");
  }

  return new ApiError(500, "INTERNAL_ERROR", "An unexpected error occurred");
}

export function errorHandler(error, _request, response, _next) {
  const apiError = mapError(error);
  if (apiError.status >= 500) {
    console.error("DayFlow request failed: INTERNAL_ERROR");
  }
  response.status(apiError.status).json({
    error: {
      code: apiError.code,
      message: apiError.message,
    },
  });
}

import express from "express";

import { AppError } from "./errors.js";

export function createApp({ config, reminderRouter } = {}) {
  const app = express();

  app.use(express.json({ limit: "10kb" }));

  if (reminderRouter) {
    app.use(reminderRouter);
  }

  app.use((req, res) => {
    res.status(404).json({
      error: {
        code: "invalid_request",
        message: "The requested endpoint does not exist.",
      },
    });
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    if (error instanceof AppError) {
      const body = {
        error: {
          code: error.code,
          message: error.message,
        },
      };
      if (error.questions) {
        body.error.questions = error.questions;
      }
      res.status(error.status).json(body);
      return;
    }

    if (error.type === "entity.parse.failed" || error.type === "entity.too.large") {
      res.status(400).json({
        error: {
          code: "invalid_request",
          message: "Request body must be valid JSON within the allowed size.",
        },
      });
      return;
    }

    console.error("Unhandled reminder request error.");
    res.status(500).json({
      error: {
        code: "internal_error",
        message: "The request could not be completed.",
      },
    });
  });

  return app;
}

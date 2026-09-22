import { AppError } from "../utils/errors.js";

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  const isDev = process.env.NODE_ENV !== "production";

  console.error(err);

  if (err instanceof AppError) {
    const body = {
      error: {
        code: err.code,
        message: err.message,
        ...(err.fields && { fields: err.fields }),
        ...(isDev && err.stack && { stack: err.stack }),
      },
    };
    return res.status(err.status).json(body);
  }

  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
      ...(isDev && { stack: err?.stack }),
    },
  });
};

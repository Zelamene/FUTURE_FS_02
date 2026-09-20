export class AppError extends Error {
  constructor(code, message, status, fields = undefined) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

export const unauthorized = (message = "Authentication required") =>
  new AppError("UNAUTHORIZED", message, 401);

export const invalidCredentials = () =>
  new AppError("INVALID_CREDENTIALS", "Invalid email or password", 401);

export const notFound = (message = "Resource not found") =>
  new AppError("NOT_FOUND", message, 404);

export const validationError = (fields) =>
  new AppError("VALIDATION_ERROR", "Invalid request body", 400, fields);

export const rateLimited = () =>
  new AppError("RATE_LIMITED", "Too many requests, please try again later", 429);

export const conflict = (code, message) =>
  new AppError(code, message, 409);

export const internalError = (message = "An unexpected error occurred") =>
  new AppError("INTERNAL_ERROR", message, 500);

export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const fields = {};
    for (const issue of result.error.issues) {
      fields[issue.path.join(".")] = issue.message;
    }
    return next(validationError(fields));
  }
  req.body = result.data;
  next();
};

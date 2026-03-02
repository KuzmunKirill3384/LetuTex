export class AppError extends Error {
  constructor(statusCode, detail) {
    super(detail);
    this.statusCode = statusCode;
    this.detail = detail;
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(detail = 'Not found') {
    super(404, detail);
  }
}

export class ForbiddenError extends AppError {
  constructor(detail = 'Forbidden') {
    super(403, detail);
  }
}

export class BadRequestError extends AppError {
  constructor(detail = 'Bad request') {
    super(400, detail);
  }
}

export class UnauthorizedError extends AppError {
  constructor(detail = 'Unauthorized') {
    super(401, detail);
  }
}

export class ConflictError extends AppError {
  constructor(detail = 'Conflict') {
    super(409, detail);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(detail = 'Service unavailable') {
    super(503, detail);
  }
}

export function errorMiddleware(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ detail: err.detail });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ detail: 'Invalid JSON' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ detail: 'Request body too large' });
  }
  console.error(`[${new Date().toISOString()}] Unhandled error:`, err);
  res.status(500).json({ detail: 'Internal server error' });
}

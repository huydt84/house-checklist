export class AppError extends Error {
  constructor(code, status = 400, details = {}) {
    super(code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
export function ensure(condition, code, status = 400, details = {}) {
  if (!condition) throw new AppError(code, status, details);
}

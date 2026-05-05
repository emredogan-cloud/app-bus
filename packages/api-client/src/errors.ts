export interface ProblemDetailsError {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  instance?: string;
  code?: string;
  [k: string]: unknown;
}

export class ApiError extends Error {
  constructor(
    public readonly problem: ProblemDetailsError,
    public readonly status: number,
  ) {
    super(problem.detail ?? problem.title ?? `API error ${status}`);
    this.name = 'ApiError';
  }
}

export class NetworkError extends Error {
  constructor(cause: unknown) {
    super(`network error: ${(cause as Error)?.message ?? String(cause)}`);
    this.name = 'NetworkError';
  }
}

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Global filter that converts thrown exceptions into RFC 7807 Problem Details.
 * Application-level errors typically throw NestJS HttpException subclasses with
 * a structured payload like { code, detail }; we surface that as { type, title, status, code, detail }.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly log = new Logger(ProblemDetailsFilter.name);

  constructor(private readonly publicApiUrl: string) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'internal_error';
    let title = 'Internal Server Error';
    let detail: string | undefined;
    let extra: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      title = HttpStatus[status] ?? title;
      if (typeof resp === 'string') {
        detail = resp;
      } else if (resp && typeof resp === 'object') {
        const r = resp as Record<string, unknown>;
        code = (r.code as string) ?? code;
        detail = (r.detail as string) ?? (r.message as string) ?? undefined;
        extra = Object.fromEntries(
          Object.entries(r).filter(([k]) => !['statusCode', 'message', 'error'].includes(k)),
        );
      }
    } else if (exception instanceof Error) {
      detail = exception.message;
      this.log.error(`unhandled error: ${exception.message}`, exception.stack);
    }

    res
      .status(status)
      .type('application/problem+json')
      .json({
        type: `${this.publicApiUrl}/problems/${code}`,
        title,
        status,
        detail,
        instance: req.originalUrl,
        ...extra,
      });
  }
}

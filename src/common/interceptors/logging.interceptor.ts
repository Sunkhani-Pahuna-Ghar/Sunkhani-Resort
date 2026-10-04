import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { Request, Response } from "express";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const { method, originalUrl, body, query } = req;
    const start = Date.now();

    this.logger.debug(
      `→ ${method} ${originalUrl}` +
        (Object.keys(query).length ? ` query=${JSON.stringify(query)}` : "") +
        (body && Object.keys(body).length
          ? ` body=${JSON.stringify(body)}`
          : ""),
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          this.logger.log(
            `← ${method} ${originalUrl} ${res.statusCode} +${ms}ms`,
          );
        },
        error: (err) => {
          const ms = Date.now() - start;
          const status = err?.status ?? 500;
          this.logger.warn(
            `← ${method} ${originalUrl} ${status} +${ms}ms — ${err?.message}`,
          );
        },
      }),
    );
  }
}

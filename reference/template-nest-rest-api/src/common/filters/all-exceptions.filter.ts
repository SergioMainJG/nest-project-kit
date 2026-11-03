import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";

import { Catch, HttpException, HttpStatus, Logger } from "@nestjs/common";

export interface ErrorResponseBody {
  correlationId: string;
  error: string;
  message: string | string[];
  path: string;
  statusCode: number;
  timestamp: string;
}

const SERVER_ERROR_THRESHOLD: number = HttpStatus.INTERNAL_SERVER_ERROR;

const toReasonPhrase = (status: number): string | undefined =>
  (HttpStatus[status] as string | undefined)
    ?.toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const toBody = (exception: unknown): Pick<ErrorResponseBody, "error" | "message"> => {
  if (!(exception instanceof HttpException)) {
    return { error: "Internal Server Error", message: "Internal server error" };
  }

  const reason = toReasonPhrase(exception.getStatus()) ?? exception.name;
  const response = exception.getResponse();
  if (typeof response === "string") {
    return { error: reason, message: response };
  }

  const { error, message } = response as { error?: string; message?: string | string[] };
  return { error: error ?? reason, message: message ?? exception.message };
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();

    const statusCode: number =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    if (statusCode >= SERVER_ERROR_THRESHOLD) {
      this.logger.error(
        { correlationId: request.id, message: `${request.method} ${request.url}` },
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorResponseBody = {
      ...toBody(exception),
      correlationId: request.id,
      path: request.url,
      statusCode,
      timestamp: new Date().toISOString(),
    };

    void reply.status(statusCode).send(body);
  }
}

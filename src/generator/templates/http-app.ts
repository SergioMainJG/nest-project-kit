/** `publicFrom` is where `@Public()` comes from when a global auth guard exists. */
export const appController = (
  publicFrom?: string,
  path = "",
): string => `import { Controller, Get } from "@nestjs/common";
${publicFrom === undefined ? "" : `import { Public } from "${publicFrom}";\n`}
import { AppService } from "./app.service.js";

export interface AppStatus {
  name: string;
  status: "ok";
}
${publicFrom === undefined ? "" : "\n@Public()"}
@Controller(${path === "" ? "" : `"${path}"`})
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getStatus(): AppStatus {
    return this.appService.getStatus();
  }
}
`;

export const appService = `import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { AppStatus } from "./app.controller.js";
import type { Envs } from "./config/envs.schema.js";

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService<Envs, true>) {}

  getStatus(): AppStatus {
    return { name: this.configService.get("APP_NAME", { infer: true }), status: "ok" };
  }
}
`;

export const appServiceSpec = `import { ConfigService } from "@nestjs/config";

import { AppService } from "./app.service.js";

describe("AppService", () => {
  it("reports the configured application name", () => {
    const config = new ConfigService({ APP_NAME: "orders" });
    const service = new AppService(config as never);

    expect(service.getStatus()).toEqual({ name: "orders", status: "ok" });
  });
});
`;

export const allExceptionsFilter = `import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";

import { Catch, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { randomUUID } from "node:crypto";

export interface ErrorResponseBody {
  correlationId: string;
  error: string;
  message: string | string[];
  path: string;
  statusCode: number;
  timestamp: string;
}

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  id?: string;
  method?: string;
}

export const CORRELATION_ID_HEADER = "x-correlation-id";

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

const correlationIdOf = (request: RequestLike): string => {
  const header = request.headers?.[CORRELATION_ID_HEADER];
  return request.id ?? (typeof header === "string" ? header : randomUUID());
};

/**
 * Every HTTP error leaves as { statusCode, error, message, path, timestamp, correlationId }.
 * It uses the HttpAdapterHost, so it works with any HTTP adapter.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): unknown {
    if (host.getType() !== "http") {
      return exception;
    }
    const { httpAdapter } = this.adapterHost;
    const http = host.switchToHttp();
    const request = http.getRequest<RequestLike>();
    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const path = String(httpAdapter.getRequestUrl(request));

    if (statusCode >= 500) {
      this.logger.error(
        \`\${request.method ?? "?"} \${path}\`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorResponseBody = {
      ...toBody(exception),
      correlationId: correlationIdOf(request),
      path,
      statusCode,
      timestamp: new Date().toISOString(),
    };
    httpAdapter.reply(http.getResponse(), body, statusCode);
    return undefined;
  }
}
`;

export const allExceptionsFilterSpec = `import type { ArgumentsHost } from "@nestjs/common";

import { BadRequestException, Logger, NotFoundException } from "@nestjs/common";

import { AllExceptionsFilter } from "./all-exceptions.filter.js";

beforeAll(() => {
  // Server errors are logged on purpose; keep the test output clean.
  vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
});

const createHost = (request: object) => {
  const reply = vi.fn();
  const adapterHost = {
    httpAdapter: { getRequestUrl: () => "/orders/1", reply },
  };
  const host = {
    getType: () => "http",
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}) }),
  } as unknown as ArgumentsHost;
  return { filter: new AllExceptionsFilter(adapterHost as never), host, reply };
};

describe("AllExceptionsFilter", () => {
  it("keeps the status and message of HTTP exceptions", () => {
    const { filter, host, reply } = createHost({ id: "req-1", method: "GET" });

    filter.catch(new NotFoundException("Order not found"), host);

    expect(reply).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        correlationId: "req-1",
        error: "Not Found",
        message: "Order not found",
        path: "/orders/1",
        statusCode: 404,
      }),
      404,
    );
  });

  it("reuses the incoming correlation id header", () => {
    const { filter, host, reply } = createHost({ headers: { "x-correlation-id": "abc" } });

    filter.catch(new BadRequestException(["email must be an email"]), host);

    expect(reply.mock.calls[0]?.[1]).toMatchObject({
      correlationId: "abc",
      message: ["email must be an email"],
    });
  });

  it("hides the details of unexpected errors", () => {
    const { filter, host, reply } = createHost({});

    filter.catch(new Error("connection refused"), host);

    expect(reply.mock.calls[0]?.[1]).toMatchObject({
      message: "Internal server error",
      statusCode: 500,
    });
  });
});
`;

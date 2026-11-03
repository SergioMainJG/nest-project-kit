import type { ArgumentsHost } from "@nestjs/common";

import { BadRequestException, HttpException, Logger, NotFoundException } from "@nestjs/common";

import { AllExceptionsFilter } from "./all-exceptions.filter.js";

const createHost = () => {
  const reply = {
    send: vi.fn<(body: unknown) => void>(),
    status: vi.fn<(code: number) => unknown>(),
  };
  reply.status.mockReturnValue(reply);
  const request = { id: "trace-1", method: "GET", url: "/things" };
  const host = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => reply }),
  } as unknown as ArgumentsHost;
  return { host, reply };
};

describe("AllExceptionsFilter", () => {
  const filter = new AllExceptionsFilter();
  const logError = vi.spyOn(Logger.prototype, "error").mockReturnValue();

  beforeEach(() => {
    logError.mockClear();
  });

  it("keeps the status and message of an HttpException", () => {
    const { host, reply } = createHost();

    filter.catch(new NotFoundException("Thing not found"), host);

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({
      correlationId: "trace-1",
      error: "Not Found",
      message: "Thing not found",
      path: "/things",
      statusCode: 404,
      timestamp: expect.any(String),
    });
    expect(logError).not.toHaveBeenCalled();
  });

  it("keeps validation messages as a list", () => {
    const { host, reply } = createHost();

    filter.catch(new BadRequestException(["email must be an email", "password too short"]), host);

    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: ["email must be an email", "password too short"] }),
    );
  });

  it("handles an HttpException built from a plain string", () => {
    const { host, reply } = createHost();

    filter.catch(new HttpException("I'm a teapot", 418), host);

    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: "I Am A Teapot", message: "I'm a teapot", statusCode: 418 }),
    );
  });

  it("hides unexpected errors behind a generic 500 and logs them", () => {
    const { host, reply } = createHost();

    filter.catch(new Error("password=hunter2 leaked in a driver error"), host);

    expect(reply.status).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Internal Server Error", message: "Internal server error" }),
    );
    expect(logError).toHaveBeenCalledOnce();
  });
});

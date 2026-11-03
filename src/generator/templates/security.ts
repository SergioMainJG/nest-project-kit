export const fastifyCsrf = `import type { NestFastifyApplication } from "@nestjs/platform-fastify";

import fastifyCookie from "@fastify/cookie";
import fastifyCsrf from "@fastify/csrf-protection";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Double-submit CSRF protection for cookie-authenticated requests (OWASP CSRF Cheat Sheet).
 * Requests with a bearer token are not vulnerable to CSRF and skip the check.
 * Clients fetch a token from GET /csrf-token and send it back in the x-csrf-token header.
 */
export const setupCsrf = async (app: NestFastifyApplication, secret: string): Promise<void> => {
  await app.register(fastifyCookie, { secret });
  await app.register(fastifyCsrf, {
    cookieOpts: { httpOnly: true, path: "/", sameSite: "strict", signed: true },
  });
  const fastify = app.getHttpAdapter().getInstance();
  fastify.get("/csrf-token", (_request, reply) => ({ token: reply.generateCsrf() }));
  fastify.addHook("onRequest", (request, reply, done) => {
    if (SAFE_METHODS.has(request.method) || request.headers.authorization?.startsWith("Bearer ")) {
      done();
      return;
    }
    fastify.csrfProtection(request, reply, done);
  });
};
`;

export const expressCsrf = `import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Express } from "express";

import cookieParser from "cookie-parser";
import { doubleCsrf } from "csrf-csrf";

/**
 * Double-submit CSRF protection for cookie-authenticated requests (OWASP CSRF Cheat Sheet).
 * Requests with a bearer token are not vulnerable to CSRF and skip the check.
 * Clients fetch a token from GET /csrf-token and send it back in the x-csrf-token header.
 */
export const setupCsrf = (app: NestExpressApplication, secret: string): void => {
  const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
    cookieName: "csrf",
    cookieOptions: { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production" },
    getSecret: () => secret,
    getSessionIdentifier: (request) => request.ip ?? "",
    skipCsrfProtection: (request) => request.headers.authorization?.startsWith("Bearer ") === true,
  });
  app.use(cookieParser(secret));
  const server: Express = app.getHttpAdapter().getInstance();
  server.get("/csrf-token", (request, response) => {
    response.json({ token: generateCsrfToken(request, response) });
  });
  app.use(doubleCsrfProtection);
};
`;

/** Portable security headers for adapters without a helmet plugin (node, bun). */
export const securityHeadersInterceptor = `import type { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";
import type { Observable } from "rxjs";

import { Injectable } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";

/** The baseline of the OWASP Secure Headers Project, as helmet sets them. */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "Content-Security-Policy": "default-src 'self'; frame-ancestors 'none'; object-src 'none'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

@Injectable()
export class SecurityHeadersInterceptor implements NestInterceptor {
  constructor(private readonly adapterHost: HttpAdapterHost) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() === "http") {
      const response: unknown = context.switchToHttp().getResponse();
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
        this.adapterHost.httpAdapter.setHeader(response, name, value);
      }
    }
    return next.handle();
  }
}
`;

/** CSP that still lets the Scalar UI load its assets. */
export const scalarFriendlyCsp = `{
      contentSecurityPolicy: {
        directives: {
          connectSrc: ["'self'"],
          defaultSrc: ["'self'"],
          fontSrc: ["'self'", "data:", "cdn.jsdelivr.net"],
          imgSrc: ["'self'", "data:", "cdn.jsdelivr.net"],
          scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          workerSrc: ["'self'", "blob:"],
        },
      },
    }`;

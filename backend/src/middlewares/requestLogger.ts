import { randomUUID } from "node:crypto";
import { pinoHttp } from "pino-http";
import { logger } from "../config/logger.js";

// A request id the caller may send, such as the web app's id for the page
// request that made the call. Anything else gets a new id.
const REQUEST_ID = /^[A-Za-z0-9._-]{8,100}$/;

// Logs one line per request when the answer is sent: method, path, status
// and time taken, with the request id. Server errors are logged as errors.
// The id is sent back in X-Request-Id, and req.log is a logger whose lines
// all carry it. Headers, bodies and query strings are never logged.
export const requestLogger = pinoHttp({
  logger,
  genReqId(req, res) {
    const incoming = req.headers["x-request-id"];
    const id =
      typeof incoming === "string" && REQUEST_ID.test(incoming)
        ? incoming
        : randomUUID();
    res.setHeader("X-Request-Id", id);
    return id;
  },
  customProps: (req) => ({ requestId: req.id }),
  customLogLevel: (_req, res, error) =>
    error || res.statusCode >= 500 ? "error" : "info",
  customSuccessMessage: (req, res, time) =>
    `${req.method} ${pathOf(req)} ${res.statusCode} ${Math.round(time)} ms`,
  customErrorMessage: (req, res) =>
    `${req.method} ${pathOf(req)} ${res.statusCode} failed`,

  // Not worth a line each: the documentation's own files, and the health
  // check Docker makes every 30 seconds (a failed one logs an error itself)
  autoLogging: {
    ignore: (req) => {
      const url = req.url ?? "";
      return url.startsWith("/api/docs") || url.startsWith("/api/health");
    },
  },
  // The request and response objects themselves are not logged
  serializers: {
    req: () => undefined,
    res: () => undefined,
  },
});

// The full path without the query string. Express shortens req.url inside
// a router; originalUrl keeps the whole one.
function pathOf(req: {
  url?: string | undefined;
  originalUrl?: string | undefined;
}): string {
  return (req.originalUrl ?? req.url ?? "").split("?")[0] ?? "";
}

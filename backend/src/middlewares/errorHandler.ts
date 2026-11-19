import type { NextFunction, Request, Response } from "express";

// Messages for the client errors that reach this handler, which come from
// reading the request body (express.json)
const CLIENT_ERRORS: Record<number, string> = {
  400: "Request body is not valid JSON",
  413: "Request body is too large",
  415: "Unsupported request body encoding",
};

// The 4xx status an error carries, if any (body-parser sets one)
function clientStatus(error: unknown): number | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number" &&
    error.status >= 400 &&
    error.status < 500
  ) {
    return error.status;
  }
  return null;
}

// Last middleware: turns errors no route handled into JSON responses
// instead of Express's HTML error page.
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // The answer has already started; only Express can end it now
  if (res.headersSent) {
    next(error);
    return;
  }

  const status = clientStatus(error);
  if (status !== null) {
    res.status(status).json({ error: CLIENT_ERRORS[status] ?? "Bad request" });
    return;
  }

  req.log.error({ err: error }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
}

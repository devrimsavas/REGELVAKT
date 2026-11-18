import type { NextFunction, Request, Response } from "express";

// Last middleware: turns unexpected errors into JSON responses.
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  // A request body that is not valid JSON
  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({ error: "Request body is not valid JSON" });
    return;
  }

  console.error(error);
  res.status(500).json({ error: "Internal server error" });
}

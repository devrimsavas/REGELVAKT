import "server-only";
import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { headers as requestHeaders } from "next/headers";

// Calls the Regelvakt API from the Next.js server. The browser never talks
// to the API directly: the API is not reachable from the internet, and its
// address is a server-only setting.
function apiUrl(): string {
  return process.env.API_URL || "http://localhost:3000";
}

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | {
      ok: false;
      // 0 when the API could not be reached at all
      status: number;
      error: string;
      // With 400: every problem the API found in the input
      details?: string[];
      // With 429: how long until the API accepts the request again
      retryAfterSeconds?: number;
    };

// The address of the visitor's browser, sent on to the API, which limits
// requests per address. Without it every visitor would look like the web
// app's server and share one limit. CLIENT_IP_HEADER names the header the
// address is in (cf-connecting-ip behind Cloudflare); by default the
// first address in X-Forwarded-For.
async function clientAddress(): Promise<string | null> {
  try {
    const name = process.env.CLIENT_IP_HEADER || "x-forwarded-for";
    const value = (await requestHeaders()).get(name)?.split(",")[0]?.trim();
    return value && isIP(value) ? value : null;
  } catch {
    // Called outside a request: there are no headers to read
    return null;
  }
}

export interface ApiOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
}

function fieldOf(data: unknown, name: string): unknown {
  return data && typeof data === "object" && name in data
    ? (data as Record<string, unknown>)[name]
    : undefined;
}

// Sends a request to the API and returns its response as it is, or null
// when the API could not be reached. Failures are logged with the request
// id, which the API logs too.
export async function apiRequest(
  path: string,
  { method = "GET", body }: ApiOptions = {},
  accept = "application/json",
): Promise<Response | null> {
  const headers: Record<string, string> = { Accept: accept };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const address = await clientAddress();
  if (address) headers["X-Forwarded-For"] = address;
  const requestId = randomUUID();
  headers["X-Request-Id"] = requestId;
  // The path without its query string: tokens are never logged
  const call = `${method} ${path.split("?")[0]}`;

  let response: Response;
  try {
    response = await fetch(`${apiUrl()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch (error) {
    console.error(
      `API call failed: ${call} could not reach the API at ${apiUrl()} (request ${requestId})`,
      error instanceof Error && error.cause ? error.cause : error,
    );
    return null;
  }
  if (response.status >= 500) {
    console.error(
      `API call failed: ${call} answered ${response.status} (request ${requestId})`,
    );
  }
  return response;
}

// Calls the API and reads its JSON answer
export async function apiFetch<T>(
  path: string,
  options: ApiOptions = {},
): Promise<ApiResult<T>> {
  const response = await apiRequest(path, options);
  if (!response) {
    return { ok: false, status: 0, error: "The API could not be reached" };
  }

  const data: unknown =
    response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    const error = fieldOf(data, "error");
    const details = fieldOf(data, "details");
    const retryAfterSeconds = fieldOf(data, "retryAfterSeconds");
    return {
      ok: false,
      status: response.status,
      error: typeof error === "string" ? error : response.statusText,
      ...(Array.isArray(details)
        ? { details: details.filter((d) => typeof d === "string") }
        : {}),
      ...(typeof retryAfterSeconds === "number" ? { retryAfterSeconds } : {}),
    };
  }
  return { ok: true, status: response.status, data: data as T };
}

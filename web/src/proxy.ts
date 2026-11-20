import { type NextRequest, NextResponse } from "next/server";
import { counterOrigin } from "@/lib/analytics";

// Runs before every page request and gives the page its content security
// policy: which sources the browser may load scripts, styles, images and
// so on from. Scripts need a nonce, a random value made for each request,
// which Next.js puts on its own script tags; a script slipped into the
// page without it does not run. Styles allow inline style attributes,
// which the design system uses. The page view counter, when one is set
// (GOATCOUNTER_URL), may receive counts.
export function contentSecurityPolicy(
  nonce: string,
  development: boolean,
  counter: string | null = null,
): string {
  const toCounter = counter ? ` ${counter}` : "";
  return [
    "default-src 'self'",
    // React's development tools need eval; never in production
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${toCounter}`,
    "font-src 'self'",
    `connect-src 'self'${toCounter}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const policy = contentSecurityPolicy(
    nonce,
    process.env.NODE_ENV === "development",
    counterOrigin(),
  );
  // Next.js reads the nonce from the request's policy header
  const headers = new Headers(request.headers);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

export const config = {
  // Pages only: not Next.js's own files, static files or the health check
  matcher: ["/((?!_next/|health|favicon.ico|.*\\.[a-z0-9]+$).*)"],
};

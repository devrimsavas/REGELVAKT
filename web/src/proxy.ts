import { type NextRequest, NextResponse } from "next/server";

// Runs before every page request and gives the page its content security
// policy: which sources the browser may load scripts, styles, images and
// so on from. Scripts need a nonce, a random value made for each request,
// which Next.js puts on its own script tags; a script slipped into the
// page without it does not run. Styles allow inline style attributes,
// which the design system uses.
export function contentSecurityPolicy(
  nonce: string,
  development: boolean,
): string {
  return [
    "default-src 'self'",
    // React's development tools need eval; never in production
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
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

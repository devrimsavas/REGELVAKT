import { describe, expect, it } from "vitest";
import { contentSecurityPolicy } from "@/proxy";

describe("the content security policy", () => {
  it("lets only the page's own scripts run, with the nonce", () => {
    const policy = contentSecurityPolicy("abc123", false);
    expect(policy).toContain(
      "script-src 'self' 'nonce-abc123' 'strict-dynamic'",
    );
    expect(policy).not.toContain("unsafe-eval");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("form-action 'self'");
  });

  it("allows eval for React's tools only in development", () => {
    expect(contentSecurityPolicy("abc123", true)).toContain("'unsafe-eval'");
  });

  it("lets the page view counter receive counts only when one is set", () => {
    const without = contentSecurityPolicy("abc123", false);
    expect(without).toContain("connect-src 'self';");
    expect(without).toContain("img-src 'self' data: blob:;");

    const counter = "https://regelvakt.goatcounter.com";
    const policy = contentSecurityPolicy("abc123", false, counter);
    expect(policy).toContain(`connect-src 'self' ${counter}`);
    expect(policy).toContain(`img-src 'self' data: blob: ${counter}`);
    // The counter's script runs with the nonce, never from a listed host
    expect(policy).toContain(
      "script-src 'self' 'nonce-abc123' 'strict-dynamic';",
    );
  });
});

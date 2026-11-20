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
});

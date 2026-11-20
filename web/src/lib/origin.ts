import "server-only";
import { headers } from "next/headers";

// The web app's own public address, as the browser reached it: behind a
// Cloudflare tunnel or a reverse proxy, X-Forwarded-Host and
// X-Forwarded-Proto tell it; otherwise the Host header
export async function publicOrigin(): Promise<string> {
  const incoming = await headers();
  const host =
    incoming.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    incoming.get("host") ||
    "localhost:3001";
  const proto =
    incoming.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

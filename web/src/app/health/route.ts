// GET /health: whether the web app's server answers, for Docker's health
// check. It does not call the API: the API has its own health check, and
// the web app should report healthy while it waits for the API to start.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" });
}

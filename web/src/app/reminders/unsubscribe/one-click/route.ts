import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";

// The List-Unsubscribe address in every reminder email (RFC 8058). Mail
// programs with an "unsubscribe" button send a POST here, which stops the
// reminders at once.
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const result = await apiFetch("/api/subscriptions/unsubscribe", {
    method: "POST",
    body: { token },
  });
  // A token that is wrong or already used: nothing left to stop
  if (result.ok || result.status === 400 || result.status === 404) {
    return new Response(null, { status: 200 });
  }
  return new Response(null, { status: 503 });
}

// Opening the address in a browser must not unsubscribe (mail filters open
// links too): it shows the page where the reminders can be stopped
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  redirect(`/reminders/manage?token=${encodeURIComponent(token)}`);
}

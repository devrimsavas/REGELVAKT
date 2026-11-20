import { apiRequest } from "@/lib/api";

// GET /calendar/:id.ics: the calendar calendar apps subscribe to. The API
// is not reachable from the internet, so the web app passes the request
// on and sends the calendar back as it is.
const FILE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.ics$/i;

export async function GET(
  request: Request,
  { params }: RouteContext<"/calendar/[file]">,
) {
  const { file } = await params;
  const id = FILE.exec(file)?.[1];
  if (!id) return new Response("Not found", { status: 404 });

  const query = new URL(request.url).searchParams;
  const lang = query.get("lang") === "en" ? "en" : "nb";
  // ?download=1: saved as a file instead of shown or subscribed to
  const download = query.get("download") === "1";
  const response = await apiRequest(
    `/api/assessments/${id}/calendar.ics?lang=${lang}`,
    {},
    "text/calendar",
  );
  if (!response) return new Response("Unavailable", { status: 503 });
  if (!response.ok) {
    // A deleted page's calendar is gone; anything else is worth another try
    return new Response(null, {
      status: response.status === 404 ? 404 : response.status === 429 ? 429 : 503,
    });
  }

  return new Response(await response.text(), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": (
        response.headers.get("Content-Disposition") ??
        'inline; filename="regelvakt.ics"'
      ).replace(/^inline/, download ? "attachment" : "inline"),
      // Calendar apps fetch it again; nothing in between should keep a copy
      "Cache-Control": "no-store",
    },
  });
}

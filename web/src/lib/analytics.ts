// GoatCounter counts page views without cookies or personal data. It is
// on only when GOATCOUNTER_URL is set (the counter's /count address), so
// development and tests count nothing unless they set it.
export const COUNTER_SCRIPT = "https://gc.zgo.at/count.js";

export function counterUrl(
  value: string | undefined = process.env.GOATCOUNTER_URL,
): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

// Where the browser sends the counts, for the content security policy
export function counterOrigin(
  value: string | undefined = process.env.GOATCOUNTER_URL,
): string | null {
  const url = counterUrl(value);
  return url ? new URL(url).origin : null;
}

const ORG_NUMBER = /(^|\/)\d{9}(?=\/|$)/g;
const ID = /(^|\/)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi;

// The path as it is counted. Never the query string, which holds the
// tokens of the reminder links. An assessment's id is replaced, since the
// address is the only key to the page; so is the organization number,
// since which business someone looks at is their business.
export function countedPath(pathname: string): string {
  return pathname.replace(ID, "$1:id").replace(ORG_NUMBER, "$1:org");
}

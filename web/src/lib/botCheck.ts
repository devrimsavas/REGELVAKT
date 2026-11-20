// Two invisible checks against bots on forms that send email, instead of a
// question people must answer (which bots solve anyway, and which stands
// in the way of people using screen readers):
// - a field people never see (a "honeypot"): bots fill in every field
// - the time since the form was shown: people need more than two seconds
export const HONEYPOT_FIELD = "website";
export const STARTED_FIELD = "startedAt";
export const MIN_FILL_MS = 2000;

export function looksLikeBot(formData: FormData, now = Date.now()): boolean {
  if (String(formData.get(HONEYPOT_FIELD) ?? "") !== "") return true;
  // Set by the page's script; without JavaScript there is no time to check
  const started = Number(formData.get(STARTED_FIELD));
  return Number.isFinite(started) && started > 0 && now - started < MIN_FILL_MS;
}

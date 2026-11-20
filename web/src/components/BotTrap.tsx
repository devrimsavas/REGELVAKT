"use client";

import { useEffect, useRef } from "react";
import { HONEYPOT_FIELD, STARTED_FIELD } from "@/lib/botCheck";

// The hidden fields of the bot check (lib/botCheck.ts), for inside a form.
// The field is hidden from screen readers and the keyboard too, so only
// bots fill it in.
export function BotTrap() {
  // The time is written into the field after the page has loaded, so the
  // server's and the browser's first render are the same
  const started = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (started.current) started.current.value = String(Date.now());
  }, []);

  return (
    <>
      <div className="visually-hidden" aria-hidden="true">
        <label>
          Website
          <input
            type="text"
            name={HONEYPOT_FIELD}
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </label>
      </div>
      <input type="hidden" name={STARTED_FIELD} ref={started} defaultValue="" />
    </>
  );
}

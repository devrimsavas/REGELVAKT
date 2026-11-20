"use client";

import { Button } from "@digdir/designsystemet-react";
import { CheckmarkIcon, FilesIcon } from "@navikt/aksel-icons";
import { useState } from "react";

// Copies `text`, or without it the address of the page it is on (without
// its query string)
export function CopyButton({
  label,
  copiedLabel,
  text,
}: {
  label: string;
  copiedLabel: string;
  text?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const { origin, pathname } = window.location;
    try {
      await navigator.clipboard.writeText(text ?? origin + pathname);
      setCopied(true);
    } catch {
      // No clipboard (an old browser, or not allowed): the text can still
      // be selected and copied by hand
    }
  }

  return (
    <>
      <Button variant="secondary" data-size="sm" onClick={copy}>
        {copied ? <CheckmarkIcon aria-hidden /> : <FilesIcon aria-hidden />}
        {copied ? copiedLabel : label}
      </Button>
      {/* Read out by screen readers when it has been copied */}
      <span className="visually-hidden" aria-live="polite">
        {copied ? copiedLabel : ""}
      </span>
    </>
  );
}

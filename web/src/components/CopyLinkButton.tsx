"use client";

import { Button } from "@digdir/designsystemet-react";
import { CheckmarkIcon, FilesIcon } from "@navikt/aksel-icons";
import { useState } from "react";

// Copies the address of the page it is on, without its query string
export function CopyLinkButton({
  label,
  copiedLabel,
}: {
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const { origin, pathname } = window.location;
    try {
      await navigator.clipboard.writeText(origin + pathname);
      setCopied(true);
    } catch {
      // No clipboard (an old browser, or not allowed): the address bar
      // still has the link
    }
  }

  return (
    <>
      <Button variant="secondary" data-size="sm" onClick={copy}>
        {copied ? <CheckmarkIcon aria-hidden /> : <FilesIcon aria-hidden />}
        {copied ? copiedLabel : label}
      </Button>
      {/* Read out by screen readers when the link has been copied */}
      <span className="visually-hidden" aria-live="polite">
        {copied ? copiedLabel : ""}
      </span>
    </>
  );
}

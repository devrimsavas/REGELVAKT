"use client";

import { RobotSmileIcon } from "@navikt/aksel-icons";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// A link in the header that tells screen readers and the eye which page
// the user is on. "robot" marks the assistant, which people look for.
export function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon?: "robot";
  children: ReactNode;
}) {
  const current = usePathname() === href;
  return (
    <NextLink href={href} aria-current={current ? "page" : undefined}>
      {icon === "robot" && <RobotSmileIcon aria-hidden />}
      {children}
    </NextLink>
  );
}

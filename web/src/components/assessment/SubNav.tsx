"use client";

import { RobotSmileIcon } from "@navikt/aksel-icons";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import styles from "./SubNav.module.css";

// The pages for one business, as tabs. Each is a page of its own with its
// own address, so it can be shared and the back button works.
export function SubNav({
  label,
  items,
}: {
  label: string;
  items: { href: string; text: string; icon?: "robot" }[];
}) {
  const pathname = usePathname();
  const list = useRef<HTMLUListElement>(null);

  // On a narrow screen the tab of the page may be scrolled out of sight
  useEffect(() => {
    list.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);

  return (
    <nav aria-label={label} className={styles.nav}>
      <ul className={styles.list} ref={list}>
        {items.map((item) => (
          <li key={item.href}>
            <NextLink
              href={item.href}
              className={styles.link}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              {item.icon === "robot" && <RobotSmileIcon aria-hidden />}
              {item.text}
            </NextLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

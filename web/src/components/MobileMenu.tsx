"use client";

import {
  Button,
  Dropdown,
  DropdownButton,
  DropdownItem,
  DropdownList,
} from "@digdir/designsystemet-react";
import { MenuHamburgerIcon, RobotSmileIcon } from "@navikt/aksel-icons";
import NextLink from "next/link";
import styles from "./SiteHeader.module.css";

// The header's links on small screens, behind a menu button
export function MobileMenu({
  label,
  links,
}: {
  label: string;
  links: { href: string; text: string; icon?: "robot" }[];
}) {
  return (
    <div className={styles.mobileMenu}>
      <Button variant="tertiary" popoverTarget="site-menu" aria-label={label}>
        <MenuHamburgerIcon aria-hidden />
        <span className={styles.menuText}>{label}</span>
      </Button>
      <Dropdown id="site-menu" placement="bottom-end">
        <DropdownList>
          {links.map((link) => (
            <DropdownItem key={link.href}>
              <DropdownButton asChild>
                <NextLink
                  href={link.href}
                  // The page changes without a reload, so the menu is
                  // closed by hand
                  onClick={() =>
                    document.getElementById("site-menu")?.hidePopover()
                  }
                >
                  {link.icon === "robot" && <RobotSmileIcon aria-hidden />}
                  {link.text}
                </NextLink>
              </DropdownButton>
            </DropdownItem>
          ))}
        </DropdownList>
      </Dropdown>
    </div>
  );
}

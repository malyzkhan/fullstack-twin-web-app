"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  ["profile", "Profile"],
  ["preferences", "Discovery"],
  ["privacy", "Privacy"],
  ["security", "Security"],
  ["notifications", "Notifications"],
  ["account", "Account"],
] as const;

export function SettingsNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Account settings" className="settings-nav">
      {sections.map(([slug, label]) => {
        const href = `/settings/${slug}`;
        const active = pathname === href;
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={active ? "settings-nav-link active" : "settings-nav-link"}
            href={href}
            key={slug}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

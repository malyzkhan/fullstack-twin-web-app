"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "./sign-out-button";

const navigation = [
  { label: "Home", href: "/home" },
  { label: "Discover", href: "/discover" },
  { label: "Chats", href: "/chats" },
  { label: "Articles", href: "/home#articles" },
  { label: "Notes", href: "/home#notes" },
];

export function HomeNavbar({ name }: { name: string }) {
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setProfileOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <header className="home-navbar">
      <Link aria-label="Twin home" className="wordmark" href="/home">
        twin<span>.</span>
      </Link>

      <nav aria-label="Main navigation" className="home-nav-links">
        {navigation.map(({ label, href }) => {
          const active =
            pathname === href ||
            (href !== "/home" && pathname.startsWith(`${href}/`));
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={active ? "home-nav-link home-nav-link-active" : "home-nav-link"}
              href={href}
              key={label}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="home-nav-actions">
        <button
          aria-label="Notifications"
          className="nav-icon-button"
          title="Notifications"
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
          </svg>
        </button>

        <div className="profile-menu-wrap" ref={menuRef}>
          <button
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            aria-label="Open profile menu"
            className="profile-menu-trigger"
            onClick={() => setProfileOpen((open) => !open)}
            type="button"
          >
            <span aria-hidden="true" className="profile-avatar">
              {initials || "T"}
            </span>
            <svg aria-hidden="true" className="profile-chevron" viewBox="0 0 16 16">
              <path d="m4 6 4 4 4-4" />
            </svg>
          </button>

          {profileOpen ? (
            <div aria-label="Profile menu" className="profile-menu" role="menu">
              <Link
                className="profile-menu-item"
                href="/profile"
                onClick={() => setProfileOpen(false)}
                role="menuitem"
              >
                My profile
              </Link>
              <Link
                className="profile-menu-item"
                href="/settings"
                onClick={() => setProfileOpen(false)}
                role="menuitem"
              >
                Account Setting
              </Link>
              <div className="profile-menu-divider" />
              <SignOutButton menuItem />
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

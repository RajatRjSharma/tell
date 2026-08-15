"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BrandMark } from "@/components/BrandMark";

export type SiteHeaderUser = {
  email: string;
  username: string;
};

export type SiteHeaderActive = "outlook" | "methodology" | "system";

type SiteHeaderProps = {
  sectionLabel: string;
  active: SiteHeaderActive;
  user?: SiteHeaderUser | null;
  leadingActions?: ReactNode;
};

const NAV_ITEMS: {
  id: SiteHeaderActive;
  href: string;
  label: string;
  testId: string;
}[] = [
  { id: "outlook", href: "/", label: "Outlook", testId: "nav-outlook" },
  {
    id: "methodology",
    href: "/methodology",
    label: "Method",
    testId: "nav-methodology",
  },
  { id: "system", href: "/system", label: "System", testId: "nav-system" },
];

/** Shared product header: brand, page links, and auth controls. */
export function SiteHeader({
  sectionLabel,
  active,
  user = null,
  leadingActions,
}: SiteHeaderProps) {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState(user);
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
    } finally {
      setSessionUser(null);
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--page)_92%,transparent)] backdrop-blur-xl">
      <div className="site-header-inner mx-auto flex h-16 max-w-[1480px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="site-header-brand group flex items-center gap-3 focus-visible:outline-none"
          aria-label="Tell home"
        >
          <BrandMark className="group-hover:-translate-y-0.5" />
          <span className="text-[15px] font-semibold tracking-[-0.02em]">
            Tell
          </span>
          <span className="hidden h-4 w-px bg-[var(--line-strong)] lg:block" />
          <span className="site-header-section hidden min-w-0 truncate text-xs text-[var(--muted)] lg:block">
            {sectionLabel}
          </span>
        </Link>

        <div
          data-testid="auth-nav"
          className="site-header-nav flex items-center gap-2 text-sm"
        >
          {leadingActions}
          <div className="site-header-menu" data-open={menuOpen}>
            <button
              type="button"
              className="button-secondary site-header-menu-trigger"
              data-testid="mobile-menu-trigger"
              aria-expanded={menuOpen}
              aria-controls="site-header-menu-content"
              onClick={() => setMenuOpen((current) => !current)}
            >
              Menu
            </button>
            <div
              id="site-header-menu-content"
              className="site-header-menu-content"
            >
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  data-testid={item.testId}
                  aria-current={active === item.id ? "page" : undefined}
                  className={`nav-link ${
                    active === item.id ? "nav-link-active" : ""
                  }`}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              {sessionUser ? (
                <>
                  <span
                    data-testid="user-email"
                    className="site-header-user max-w-48 truncate text-xs text-[var(--muted)]"
                    title={sessionUser.email}
                  >
                    @{sessionUser.username}
                  </span>
                  <button
                    data-testid="logout-button"
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      void logout();
                    }}
                    className="button-secondary"
                    disabled={loggingOut}
                  >
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    data-testid="nav-signin"
                    href="/login"
                    className="button-secondary"
                    onClick={() => setMenuOpen(false)}
                  >
                    Sign in
                  </Link>
                  <Link
                    data-testid="nav-register"
                    href="/register"
                    className="button-primary"
                    onClick={() => setMenuOpen(false)}
                  >
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

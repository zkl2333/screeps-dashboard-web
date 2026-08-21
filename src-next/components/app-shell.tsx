"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "../lib/i18n/use-i18n";
import { useAdminAuthStore } from "../stores/admin-auth-store";
import { useAuthStore } from "../stores/auth-store";
import { AppNav } from "./app-nav";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { t } = useI18n();
  const session = useAuthStore((state) => state.session);
  const clearSession = useAuthStore((state) => state.clearSession);
  const setAuthenticated = useAdminAuthStore((state) => state.setAuthenticated);
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    function handleWindowResize() {
      if (window.innerWidth > 980) setMobileNavOpen(false);
    }
    handleWindowResize();
    window.addEventListener("resize", handleWindowResize, { passive: true });
    return () => window.removeEventListener("resize", handleWindowResize);
  }, []);

  async function handleSignOut() {
    setMobileNavOpen(false);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } catch {
      // Ignore logout transport errors and still clear local state.
    }
    setAuthenticated(false);
    clearSession();
    router.replace("/login");
  }

  function closeMobileNav() {
    setMobileNavOpen(false);
  }

  function toggleMobileNav() {
    setMobileNavOpen((current) => !current);
  }

  return (
    <div className={mobileNavOpen ? "app-shell mobile-nav-open" : "app-shell"}>
      <header className="app-topbar">
        <button
          className="nav-drawer-toggle topbar-no-drag"
          type="button"
          aria-label={t("nav.aria")}
          aria-controls="mobile-nav-drawer"
          aria-expanded={mobileNavOpen}
          onClick={toggleMobileNav}
        >
          <span className="nav-drawer-toggle-bars" aria-hidden="true"><span /><span /><span /></span>
        </button>
        <div className="topbar-brand">
          <p className="brand-title">{t("app.brandTitle")}</p>
          <p className="brand-subtitle">{t("app.brandSubtitle")}</p>
        </div>
        <div className="topbar-right topbar-no-drag">
          <div className="session-meta">
            <strong>{session?.username ?? t("app.guestLabel")}</strong>
            <span>{session?.baseUrl ?? t("app.guestModeHint")}</span>
          </div>
          <button className="ghost-button topbar-action topbar-no-drag" onClick={handleSignOut}>
            {t("app.signOut")}
          </button>
        </div>
      </header>

      <button aria-label={t("nav.aria")} className="mobile-nav-backdrop" onClick={closeMobileNav} tabIndex={mobileNavOpen ? 0 : -1} type="button" />
      <div className="shell-body">
        <aside className="shell-nav" id="mobile-nav-drawer"><AppNav onNavigate={closeMobileNav} /></aside>
        <main className="shell-content">{children}</main>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminLoginPanel } from "../../components/admin-login-panel";
import { LoginPanel } from "../../components/login-panel";
import { RouteTransition } from "../../components/route-transition";
import { useAuthHydration } from "../../components/auth-guard";
import { useI18n } from "../../lib/i18n/use-i18n";
import { useAdminAuthStore } from "../../stores/admin-auth-store";
import { useAuthStore } from "../../stores/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const hasHydrated = useAuthHydration();
  const { t } = useI18n();
  const adminAuthenticated = useAdminAuthStore((state) => state.authenticated);
  const setAdminAuthenticated = useAdminAuthStore((state) => state.setAuthenticated);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(adminAuthenticated === null);
  const [showRedirectTransition, setShowRedirectTransition] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/session", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    })
      .then((response) => {
        if (cancelled) {
          return;
        }
        setAdminAuthenticated(response.ok);
        setIsCheckingAdmin(false);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setAdminAuthenticated(false);
        setIsCheckingAdmin(false);
      });

    return () => {
      cancelled = true;
    };
  }, [setAdminAuthenticated]);

  useEffect(() => {
    if (isCheckingAdmin || !adminAuthenticated || !hasHydrated || !session) {
      return;
    }
    router.replace(session.token.trim() ? "/user" : "/rooms");
  }, [adminAuthenticated, hasHydrated, isCheckingAdmin, router, session]);

  useEffect(() => {
    if (!session) {
      setShowRedirectTransition(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setShowRedirectTransition(true), 180);
    return () => window.clearTimeout(timer);
  }, [session]);

  if (isCheckingAdmin) {
    return <main className="page-center"><RouteTransition label={t("common.loadingSession")} message={t("auth.loading")} /></main>;
  }

  if (!adminAuthenticated) {
    return (
      <div className="auth-shell">
        <header className="app-topbar">
          <div className="topbar-brand">
            <p className="brand-title">{t("app.brandTitle")}</p>
            <p className="brand-subtitle">{t("app.brandSubtitle")}</p>
          </div>
        </header>
        <main className="page-center auth-shell-main"><AdminLoginPanel /></main>
      </div>
    );
  }

  if (!hasHydrated) {
    return <main className="page-center"><RouteTransition label={t("common.loadingSession")} message={t("auth.loading")} /></main>;
  }

  if (session) {
    if (!showRedirectTransition) return null;
    return <main className="page-center"><RouteTransition label={t("common.redirecting")} message={t("common.redirectingDashboard")} /></main>;
  }

  return (
    <div className="auth-shell">
      <header className="app-topbar">
        <div className="topbar-brand">
          <p className="brand-title">{t("app.brandTitle")}</p>
          <p className="brand-subtitle">{t("app.brandSubtitle")}</p>
        </div>
      </header>
      <main className="page-center auth-shell-main"><LoginPanel /></main>
    </div>
  );
}

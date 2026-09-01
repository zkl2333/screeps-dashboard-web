"use client";

import {useEffect} from "react";
import {useRouter} from "next/navigation";
import {RouteTransition} from "../../components/route-transition";
import {LoginPanel} from "../../components/login-panel";
import {useAuthHydration} from "../../components/auth-guard";
import {useAuthStore} from "../../stores/auth-store";
import {useI18n} from "../../lib/i18n/use-i18n";

export default function LoginPage() {
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const clearSession = useAuthStore((state) => state.clearSession);
  const hasHydrated = useAuthHydration();
  const {t} = useI18n();

  useEffect(() => {
    if (hasHydrated && session) router.replace("/user");
  }, [hasHydrated, router, session]);

  useEffect(() => {
    // Remove credentials persisted by versions that supported browser-managed accounts.
    window.localStorage.removeItem("screeps-dashboard-auth");
    window.localStorage.removeItem("screeps-dashboard-settings");
    clearSession();
  }, [clearSession]);

  if (!hasHydrated || session) {
    return <main className="page-center"><RouteTransition label={t("common.loadingSession")} message={t("auth.loading")} /></main>;
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

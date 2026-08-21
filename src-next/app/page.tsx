"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RouteTransition } from "../components/route-transition";
import { useI18n } from "../lib/i18n/use-i18n";
import { useAdminAuthStore } from "../stores/admin-auth-store";

export default function HomePage() {
  const router = useRouter();
  const { t } = useI18n();
  const setAuthenticated = useAdminAuthStore((state) => state.setAuthenticated);

  useEffect(() => {
    void router.prefetch("/user");
    void router.prefetch("/rooms");
    void router.prefetch("/login");
    void fetch("/api/auth/session", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    })
      .then((response) => {
        setAuthenticated(response.ok);
        router.replace(response.ok ? "/user" : "/login");
      })
      .catch(() => {
        setAuthenticated(false);
        router.replace("/login");
      });
  }, [router, setAuthenticated]);

  return (
    <main className="page-center">
      <RouteTransition label={t("common.redirecting")} message={t("home.redirecting")} />
    </main>
  );
}

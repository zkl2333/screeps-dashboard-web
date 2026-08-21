"use client";

import { type ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "../lib/i18n/use-i18n";
import { useAdminAuthStore } from "../stores/admin-auth-store";
import { useAuthStore } from "../stores/auth-store";
import { RouteTransition } from "./route-transition";

interface AuthGuardProps {
  children: ReactNode;
  redirectTo?: string;
}

type AuthPersistApi = {
  hasHydrated: () => boolean;
  onHydrate: (fn: () => void) => () => void;
  onFinishHydration: (fn: () => void) => () => void;
};

function getAuthPersistApi(): AuthPersistApi | undefined {
  const maybePersist = (useAuthStore as typeof useAuthStore & { persist?: AuthPersistApi }).persist;
  return maybePersist;
}

export function useAuthHydration(): boolean {
  const [hasHydrated, setHasHydrated] = useState(() => {
    const persistApi = getAuthPersistApi();
    return persistApi ? persistApi.hasHydrated() : true;
  });

  useEffect(() => {
    const persistApi = getAuthPersistApi();
    if (!persistApi) {
      return undefined;
    }

    const unsubscribeHydrate = persistApi.onHydrate(() => {
      setHasHydrated(false);
    });
    const unsubscribeFinish = persistApi.onFinishHydration(() => {
      setHasHydrated(true);
    });

    return () => {
      unsubscribeHydrate();
      unsubscribeFinish();
    };
  }, []);

  return hasHydrated;
}

export function AuthGuard({ children, redirectTo = "/login" }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const session = useAuthStore((state) => state.session);
  const adminAuthenticated = useAdminAuthStore((state) => state.authenticated);
  const setAdminAuthenticated = useAdminAuthStore((state) => state.setAuthenticated);
  const hasHydrated = useAuthHydration();
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(adminAuthenticated === null);

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
        if (!response.ok && pathname !== redirectTo) {
          router.replace(redirectTo);
        }
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setAdminAuthenticated(false);
        setIsCheckingAdmin(false);
        if (pathname !== redirectTo) {
          router.replace(redirectTo);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, redirectTo, router, setAdminAuthenticated]);

  useEffect(() => {
    if (isCheckingAdmin || !adminAuthenticated || !hasHydrated) {
      return;
    }
    if (!session && pathname !== redirectTo) {
      router.replace(redirectTo);
    }
  }, [adminAuthenticated, hasHydrated, isCheckingAdmin, pathname, redirectTo, router, session]);

  if (isCheckingAdmin || !hasHydrated || adminAuthenticated === null) {
    return (
      <main className="auth-loading">
        <RouteTransition label={t("common.loadingSession")} message={t("auth.loading")} />
      </main>
    );
  }

  if (!adminAuthenticated || !session) {
    return (
      <main className="auth-loading">
        <RouteTransition label={t("common.redirecting")} message={t("auth.redirectingToLogin")} />
      </main>
    );
  }

  return <>{children}</>;
}

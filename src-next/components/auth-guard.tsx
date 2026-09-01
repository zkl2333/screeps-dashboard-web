"use client";

import {type ReactNode, useEffect} from "react";
import {usePathname, useRouter} from "next/navigation";
import {useAuthStore} from "../stores/auth-store";
import {useI18n} from "../lib/i18n/use-i18n";
import {RouteTransition} from "./route-transition";

interface AuthGuardProps {
  children: ReactNode;
  redirectTo?: string;
}

export function useAuthHydration(): boolean {
  return true;
}

export function AuthGuard({children, redirectTo = "/login"}: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const {t} = useI18n();
  const session = useAuthStore((state) => state.session);

  useEffect(() => {
    if (!session && pathname !== redirectTo) router.replace(redirectTo);
  }, [pathname, redirectTo, router, session]);

  if (!session) {
    return <main className="auth-loading"><RouteTransition label={t("common.redirecting")} message={t("auth.redirectingToLogin")} /></main>;
  }
  return <>{children}</>;
}

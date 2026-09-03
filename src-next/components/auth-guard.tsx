"use client";

import {type ReactNode, useEffect, useState} from "react";
import {useAuthStore} from "../stores/auth-store";
import {useI18n} from "../lib/i18n/use-i18n";
import {RouteTransition} from "./route-transition";
import {
  buildOptimisticEndpointMap,
  extractUserId,
  extractUsername,
  probeSupportedEndpoints,
} from "../lib/screeps/endpoints";
import {normalizeBaseUrl} from "../lib/screeps/request";

interface PublicConfig {
  baseUrl: string;
  username: string;
  configured: boolean;
  realtimePath: string;
}

let bootstrapPromise: Promise<void> | null = null;

async function bootstrapSession(): Promise<void> {
  const response = await fetch("/api/config", {headers: {Accept: "application/json"}});
  const payload = await response.json() as PublicConfig | {error?: string};
  if (!response.ok || !("baseUrl" in payload) || !payload.configured) {
    throw new Error("error" in payload ? payload.error ?? "Configuration unavailable" : "Configuration unavailable");
  }

  const baseUrl = normalizeBaseUrl(payload.baseUrl);
  const username = payload.username.trim() || "Configured account";
  const {setSession} = useAuthStore.getState();
  setSession({
    baseUrl,
    token: "",
    username,
    endpointMap: buildOptimisticEndpointMap(),
    verifiedAt: new Date().toISOString(),
    probes: [],
  });

  void probeSupportedEndpoints(baseUrl, "", payload.username || undefined)
    .then((summary) => {
      const current = useAuthStore.getState().session;
      if (!current || current.baseUrl !== baseUrl) return;
      setSession({
        ...current,
        username: extractUsername(summary.profileSample, username),
        userId: extractUserId(summary.profileSample),
        endpointMap: summary.endpointMap,
        verifiedAt: summary.verifiedAt,
        probes: summary.probes,
      });
    })
    .catch(() => {
      // Keep optimistic defaults when the upstream is temporarily unavailable.
    });
}

function ensureSession(): Promise<void> {
  bootstrapPromise ??= bootstrapSession().catch((error: unknown) => {
    bootstrapPromise = null;
    throw error;
  });
  return bootstrapPromise;
}

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({children}: AuthGuardProps) {
  const {t} = useI18n();
  const session = useAuthStore((state) => state.session);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (session) return;
    let cancelled = false;
    let retryTimer: number | undefined;
    const attempt = () => {
      ensureSession().catch((error: unknown) => {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : t("common.unknownError"));
        retryTimer = window.setTimeout(attempt, 5_000);
      });
    };
    attempt();
    return () => {
      cancelled = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [session, t]);

  if (!session) {
    return (
      <main className="page-center">
        <RouteTransition label={t("common.loadingSession")} message={t("auth.loading")} />
        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
      </main>
    );
  }
  return <>{children}</>;
}

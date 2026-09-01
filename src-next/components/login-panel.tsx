"use client";

import {useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import {useI18n} from "../lib/i18n/use-i18n";
import {
  buildOptimisticEndpointMap,
  extractUserId,
  extractUsername,
  probeSupportedEndpoints,
} from "../lib/screeps/endpoints";
import {normalizeBaseUrl} from "../lib/screeps/request";
import {useAuthStore} from "../stores/auth-store";

type PublicConfig = {
  baseUrl: string;
  username: string;
  configured: boolean;
  realtimePath: string;
};

export function LoginPanel() {
  const {t} = useI18n();
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/config", {headers: {Accept: "application/json"}})
      .then(async (response) => {
        const payload = await response.json() as PublicConfig | {error?: string};
        if (!response.ok || !("baseUrl" in payload) || !payload.configured) {
          throw new Error("error" in payload ? payload.error ?? "Configuration unavailable" : "Configuration unavailable");
        }
        if (!cancelled) {
          setConfig(payload);
          setIsLoading(false);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : t("common.unknownError"));
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  async function openDashboard() {
    if (!config) return;
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const baseUrl = normalizeBaseUrl(config.baseUrl);
      const username = config.username.trim() || "Configured account";
      const initialSession = {
        baseUrl,
        token: "",
        username,
        endpointMap: buildOptimisticEndpointMap(),
        verifiedAt: new Date().toISOString(),
        probes: [],
      };
      setSession(initialSession);
      router.replace("/user");
      void probeSupportedEndpoints(baseUrl, "", config.username || undefined)
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
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("common.unknownError"));
      setIsLoading(false);
    }
  }

  return (
    <section className="panel login-panel">
      <h1 className="page-title">{t("login.title")}</h1>
      <p className="page-subtitle">{t("login.subtitle")}</p>
      {isLoading && !config ? <p className="hint-text">{t("common.loading")}</p> : null}
      {config ? (
        <div className="card">
          <h2>{config.username || t("app.guestLabel")}</h2>
          <p className="hint-text">{config.baseUrl}</p>
          <p className="hint-text">{t("login.configuredHint")}</p>
          <button className="primary-button" disabled={isLoading} onClick={() => void openDashboard()} type="button">
            {isLoading ? t("login.submitting") : t("login.submit")}
          </button>
        </div>
      ) : null}
      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
    </section>
  );
}

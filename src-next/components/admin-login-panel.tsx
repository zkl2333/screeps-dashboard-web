"use client";

import { type FormEvent, useState } from "react";
import { useI18n } from "../lib/i18n/use-i18n";
import { useAdminAuthStore } from "../stores/admin-auth-store";

export function AdminLoginPanel() {
  const { t } = useI18n();
  const setAuthenticated = useAdminAuthStore((state) => state.setAuthenticated);
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });
      const payload = (await response.json()) as { authenticated?: boolean; error?: string };

      if (!response.ok || !payload.authenticated) {
        if (response.status === 503) {
          throw new Error(t("admin.notConfigured"));
        }
        throw new Error(t("admin.invalidPassword"));
      }

      setAuthenticated(true);
      setPassword("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t("common.unknownError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="panel login-panel">
      <h1 className="page-title">{t("admin.title")}</h1>
      <p className="page-subtitle">{t("admin.subtitle")}</p>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="field">
          <span>{t("admin.passwordLabel")}</span>
          <input
            autoComplete="current-password"
            onChange={(event) => setPassword(event.currentTarget.value)}
            required
            type="password"
            value={password}
          />
        </label>
        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
        <button className="primary-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? t("admin.submitting") : t("admin.submit")}
        </button>
      </form>
    </section>
  );
}

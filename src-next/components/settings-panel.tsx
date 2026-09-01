"use client";

import {useEffect, useState} from "react";
import type {Locale} from "../lib/i18n/dict";
import {useI18n} from "../lib/i18n/use-i18n";
import {getAppVersion, getRuntimeLabel, type RuntimeLabel} from "../lib/runtime/app-version";
import {useSettingsStore, type ConsoleSendMode, type MapRendererMode} from "../stores/settings-store";

const AVAILABLE_LOCALES: Locale[] = ["zh-CN", "en-US"];
const MAP_RENDERER_MODES: readonly MapRendererMode[] = ["official", "optimized"];
const CONSOLE_SEND_MODES: readonly ConsoleSendMode[] = ["enter", "ctrlEnter"];

export function SettingsPanel() {
  const {locale, setLocale, t} = useI18n();
  const mapRendererMode = useSettingsStore((state) => state.mapRendererMode);
  const consoleSendMode = useSettingsStore((state) => state.consoleSendMode);
  const setMapRendererMode = useSettingsStore((state) => state.setMapRendererMode);
  const setConsoleSendMode = useSettingsStore((state) => state.setConsoleSendMode);
  const [appVersion, setAppVersion] = useState("unknown");
  const [runtimeLabel, setRuntimeLabel] = useState<RuntimeLabel>("Web");

  const runtimeLabelText = runtimeLabel === "Desktop" ? t("settings.runtimeDesktop") : t("settings.runtimeWeb");
  const versionLabel = appVersion === "unknown" ? t("common.notAvailable") : `v${appVersion}`;

  useEffect(() => {
    let cancelled = false;
    setRuntimeLabel(getRuntimeLabel());
    void getAppVersion().then((version) => {
      if (!cancelled) setAppVersion(version);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="panel settings-panel">
      <h1 className="page-title">{t("settings.title")}</h1>
      <p className="page-subtitle">{t("settings.subtitle")}</p>

      <div className="settings-grid">
        <article className="card">
          <h2>{t("settings.languageLabel")}</h2>
          <p className="hint-text">{t("settings.languageHint")}</p>
          <div className="language-grid">
            {AVAILABLE_LOCALES.map((option) => (
              <button key={option} className={locale === option ? "language-option active" : "language-option"} onClick={() => setLocale(option)} type="button">
                {option === "zh-CN" ? t("settings.langZh") : t("settings.langEn")}
              </button>
            ))}
          </div>
        </article>

        <article className="card">
          <h2>{t("settings.mapRendererTitle")}</h2>
          <p className="hint-text">{t("settings.mapRendererHint")}</p>
          <div className="language-grid">
            {MAP_RENDERER_MODES.map((mode) => (
              <button key={mode} className={mode === mapRendererMode ? "language-option active" : "language-option"} onClick={() => setMapRendererMode(mode)} type="button">
                {mode === "official" ? t("settings.mapRendererOfficial") : t("settings.mapRendererOptimized")}
              </button>
            ))}
          </div>
        </article>

        <article className="card">
          <h2>{t("settings.consoleTitle")}</h2>
          <p className="hint-text">{t("settings.consoleSendMode")}</p>
          <div className="language-grid">
            {CONSOLE_SEND_MODES.map((mode) => (
              <button key={mode} className={mode === consoleSendMode ? "language-option active" : "language-option"} onClick={() => setConsoleSendMode(mode)} type="button">
                {mode === "enter" ? t("settings.consoleSendModeEnter") : t("settings.consoleSendModeCtrlEnter")}
              </button>
            ))}
          </div>
        </article>

        <article className="card settings-card-span-full">
          <h2>{t("settings.instanceTitle")}</h2>
          <p className="hint-text">{t("settings.instanceHint")}</p>
          <p className="hint-text">{t("settings.instanceSecretHint")}</p>
        </article>
      </div>

      <footer className="settings-footer">
        <span className="settings-footer-label">{t("settings.versionLabel")}</span>
        <span className="settings-footer-value">{versionLabel} | {runtimeLabelText}</span>
      </footer>
    </section>
  );
}

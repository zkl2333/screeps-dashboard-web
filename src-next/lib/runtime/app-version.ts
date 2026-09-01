"use client";

export type RuntimeLabel = "Desktop" | "Web";

type VersionPayload = {
  version?: unknown;
};

let appVersionPromise: Promise<string> | null = null;

async function readVersionFromStaticFile(): Promise<string | null> {
  try {
    const response = await fetch("/version.json", { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as VersionPayload;
    if (typeof payload.version === "string" && payload.version.trim()) {
      return payload.version.trim();
    }
  } catch {
    // Ignore and use fallback.
  }

  return null;
}

export function getRuntimeLabel(): RuntimeLabel {
  return "Web";
}

export async function getAppVersion(): Promise<string> {
  if (appVersionPromise) {
    return appVersionPromise;
  }

  appVersionPromise = (async () => {
    const staticVersion = await readVersionFromStaticFile();
    return staticVersion ?? "unknown";
  })();

  return appVersionPromise;
}

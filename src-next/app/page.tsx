"use client";

import {useEffect} from "react";
import {useRouter} from "next/navigation";
import {RouteTransition} from "../components/route-transition";
import {useI18n} from "../lib/i18n/use-i18n";

export default function HomePage() {
  const router = useRouter();
  const {t} = useI18n();
  useEffect(() => {
    router.replace("/user");
  }, [router]);
  return <main className="page-center"><RouteTransition label={t("common.redirecting")} message={t("home.redirecting")} /></main>;
}

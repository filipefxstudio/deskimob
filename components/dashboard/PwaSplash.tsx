"use client";

import { useEffect, useState } from "react";

import { DESKIMOB_PWA_ICON_PATHS } from "@/lib/site/deskimob-pwa";
import { cn } from "@/lib/utils";

const SPLASH_KEY = "deskimob_pwa_splash_seen";

/**
 * Splash minimalista ao abrir o PWA instalado — gradiente laranja + símbolo oficial.
 */
export function PwaSplash() {
  const [visible, setVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone);

    if (!isStandalone) {
      return;
    }

    try {
      if (sessionStorage.getItem(SPLASH_KEY) === "1") {
        return;
      }
      sessionStorage.setItem(SPLASH_KEY, "1");
    } catch {
      // sessionStorage indisponível
    }

    setVisible(true);
    const fadeTimer = window.setTimeout(() => setFadeOut(true), 600);
    const hideTimer = window.setTimeout(() => setVisible(false), 900);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-[200] flex flex-col items-center justify-center transition-opacity duration-300 ease-out",
        fadeOut ? "pointer-events-none opacity-0" : "opacity-100",
      )}
      style={{
        background: "linear-gradient(165deg, #E07A52 0%, #C85D32 45%, #B0532C 100%)",
      }}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={DESKIMOB_PWA_ICON_PATHS.appleTouchIcon}
        alt=""
        className="size-24 object-contain drop-shadow-sm"
        width={96}
        height={96}
      />
    </div>
  );
}

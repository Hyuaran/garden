"use client";

import { useEffect } from "react";

/** Garden の明暗（右上の切り替え・なければパソコンの設定）を資料（iframe の中）へ伝える。資料は :root[data-theme] で色が変わる */
export function applyGardenTheme(doc: Document | null | undefined) {
  if (!doc?.documentElement) return;
  const theme = document.documentElement.dataset.theme;
  const dark = theme === "dark" || (theme !== "light" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  doc.documentElement.dataset.theme = dark ? "dark" : "light";
}

/** 開いている間に明暗を切り替えたときも、資料の色を合わせ直す */
export function useGardenThemeSync(getDoc: () => Document | null | undefined) {
  useEffect(() => {
    const sync = () => applyGardenTheme(getDoc());
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener?.("change", sync);
    return () => { observer.disconnect(); media?.removeEventListener?.("change", sync); };
  }, [getDoc]);
}

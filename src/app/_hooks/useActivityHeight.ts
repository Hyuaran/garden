"use client";

/**
 * useActivityHeight — Activity Panel 高さ自動調整フック (Garden v2.8a)
 *
 * 仕様:
 *   - prototype の adjustActivityHeight() を React Hook 化
 *   - top + bottom 固定 + JS 実測で panel の bottom (CSS) を補正
 *   - viewport <1400px ではモバイル想定で bottom 解除 (style.bottom = "")
 *   - ResizeObserver で window resize / panel ref の変化に追従
 *
 * 使い方:
 *   const panelRef = useRef<HTMLDivElement>(null);
 *   useActivityHeight(panelRef, 64, 24);
 *   <div ref={panelRef} className="activity-panel">…</div>
 *
 * 引数:
 *   panelRef    - 高さ調整する panel の ref
 *   topbarH     - Topbar の高さ (px) -- 現バージョンは未使用、将来拡張用
 *   bottomGap   - viewport 下端からの空白 (px、最小値)
 *   anchorRef   - (optional) 揃える対象の ref。未指定は document.querySelector('.orb-grid') で fallback
 */

import { useEffect, type RefObject } from "react";

const DESKTOP_BREAKPOINT_PX = 1400;

export type UseActivityHeightOptions = {
  /** anchor となる要素 (orb-grid 等)、未指定は ".orb-grid" を querySelector */
  anchorRef?: RefObject<HTMLElement | null>;
};

export function useActivityHeight(
  panelRef: RefObject<HTMLElement | null>,
  topbarH: number = 64,
  bottomGap: number = 0,
  options: UseActivityHeightOptions = {},
): void {
  // topbarH は将来拡張用、現バージョンは未使用 (lint 抑制)
  void topbarH;

  useEffect(() => {
    if (typeof window === "undefined") return;

    function adjust() {
      const panel = panelRef.current;
      if (!panel) return;

      // モバイル想定 viewport では bottom 補正解除
      if (window.innerWidth < DESKTOP_BREAKPOINT_PX) {
        panel.style.bottom = "";
        return;
      }

      const anchor =
        options.anchorRef?.current ??
        document.querySelector<HTMLElement>(".orb-grid");
      if (!anchor) return;

      const anchorRect = anchor.getBoundingClientRect();
      const viewportH = window.innerHeight;
      const targetBottom = viewportH - anchorRect.bottom;

      panel.style.bottom = `${Math.max(bottomGap, targetBottom)}px`;
    }

    // 初回計測
    adjust();

    // resize 追従
    window.addEventListener("resize", adjust);
    window.addEventListener("load", adjust);

    // ResizeObserver で panel / anchor のサイズ変化にも追従
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => adjust());
      const panel = panelRef.current;
      if (panel) observer.observe(panel);
      const anchor =
        options.anchorRef?.current ??
        document.querySelector<HTMLElement>(".orb-grid");
      if (anchor) observer.observe(anchor);
    }

    return () => {
      window.removeEventListener("resize", adjust);
      window.removeEventListener("load", adjust);
      if (observer) observer.disconnect();
    };
  }, [panelRef, bottomGap, options.anchorRef]);
}

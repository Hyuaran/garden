"use client";

/**
 * useBackgroundCarousel — Garden v2.8a 背景カルーセル状態管理フック
 *
 * 仕様:
 *   - mode "manual" : index 操作のみ受付 (click hint 等で next/prev 呼び出し)
 *   - mode "auto"   : 8 秒ごとに next() 自動発火
 *   - prefers-reduced-motion: reduce で auto を強制 OFF
 *   - SSR safe: 全 effect で typeof window チェック
 *   - ATMOSPHERES_V28 (light 5 + night 1) を対象、循環は呼び出し側で範囲を渡す想定
 *     → 戻り値の index は 0..count-1
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type CarouselMode = "manual" | "auto";

const AUTO_INTERVAL_MS = 8000;

export type UseBackgroundCarouselOptions = {
  /** 切替対象数 (default: 5、light atmospheres) */
  count?: number;
  /** 初期 index (default: 0) */
  initialIndex?: number;
  /** モード (default: "manual") */
  mode?: CarouselMode;
};

export type UseBackgroundCarouselReturn = {
  index: number;
  set: (i: number) => void;
  next: () => void;
  prev: () => void;
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

export function useBackgroundCarousel(
  options: UseBackgroundCarouselOptions = {},
): UseBackgroundCarouselReturn {
  const { count = 5, initialIndex = 0, mode = "manual" } = options;

  const [index, setIndex] = useState<number>(() => {
    if (count <= 0) return 0;
    return ((initialIndex % count) + count) % count;
  });

  // 最新 count を ref で保持 (auto interval 内で参照)
  const countRef = useRef(count);
  useEffect(() => {
    countRef.current = count;
  }, [count]);

  const set = useCallback(
    (i: number) => {
      const c = countRef.current;
      if (c <= 0) return;
      setIndex(((i % c) + c) % c);
    },
    [],
  );

  const next = useCallback(() => {
    setIndex((prev) => {
      const c = countRef.current;
      if (c <= 0) return 0;
      return (prev + 1) % c;
    });
  }, []);

  const prev = useCallback(() => {
    setIndex((p) => {
      const c = countRef.current;
      if (c <= 0) return 0;
      return (p - 1 + c) % c;
    });
  }, []);

  // auto モード: 8 秒ごとに next()
  useEffect(() => {
    if (mode !== "auto") return;
    if (typeof window === "undefined") return;
    if (prefersReducedMotion()) return;
    if (count <= 1) return;

    const timer = window.setInterval(() => {
      setIndex((p) => {
        const c = countRef.current;
        if (c <= 0) return 0;
        return (p + 1) % c;
      });
    }, AUTO_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [mode, count]);

  return { index, set, next, prev };
}

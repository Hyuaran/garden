"use client";

/**
 * 盆栽 / 大樹ビュー — 6 atmospheres カルーセル背景
 *
 * dispatch v3 仕様:
 *   - auto モード: 8 秒ごとに次へ自動切替（fade 800ms）
 *   - manual モード: 矢印キー / 1-6 / Space で切替
 *   - A キー: auto / manual トグル
 *   - prefers-reduced-motion: auto 無効化（manual のみ動作）
 *
 * 既存 BackgroundLayer の置換。layer 分離は維持（zIndex 0、aria-hidden）。
 */

import { useEffect, useState } from "react";
import {
  ATMOSPHERES,
  ATMOSPHERE_COUNT,
  AUTO_INTERVAL_MS,
  FADE_TRANSITION_MS,
  type AtmosphereId,
} from "./_lib/atmospheres";

export type CarouselMode = "auto" | "manual";

type Props = {
  /** 初期 atmosphere index（URL クエリで指定可） */
  initialIndex?: AtmosphereId;
  /** 初期モード（5/5 デモは manual で開始、A キーで auto に） */
  initialMode?: CarouselMode;
};

export function BackgroundCarousel({ initialIndex = 0, initialMode = "manual" }: Props) {
  const [index, setIndex] = useState<AtmosphereId>(initialIndex);
  const [mode, setMode] = useState<CarouselMode>(initialMode);

  // auto cycling — prefers-reduced-motion で無効化
  useEffect(() => {
    if (mode !== "auto") return;
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduceMotion) return;

    const id = window.setInterval(() => {
      setIndex((i) => ((i + 1) % ATMOSPHERE_COUNT) as AtmosphereId);
    }, AUTO_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [mode]);

  // keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 入力フィールド内では無視
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setIndex((i) => ((i + 1) % ATMOSPHERE_COUNT) as AtmosphereId);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIndex((i) => ((i - 1 + ATMOSPHERE_COUNT) % ATMOSPHERE_COUNT) as AtmosphereId);
      } else if (e.key >= "1" && e.key <= "6") {
        const n = Number.parseInt(e.key, 10) - 1;
        if (n >= 0 && n < ATMOSPHERE_COUNT) setIndex(n as AtmosphereId);
      } else if (e.key === "a" || e.key === "A") {
        setMode((m) => (m === "auto" ? "manual" : "auto"));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div
      aria-hidden
      data-testid="background-carousel"
      data-atmosphere-index={index}
      data-atmosphere-mode={mode}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
      }}
    >
      {ATMOSPHERES.map((atm, i) => (
        <div
          key={atm.id}
          data-atmosphere-key={atm.key}
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${atm.imagePath})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: i === index ? 1 : 0,
            transition: `opacity ${FADE_TRANSITION_MS}ms ease-in-out`,
          }}
        />
      ))}
    </div>
  );
}

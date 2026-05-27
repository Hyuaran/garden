"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { signOutUnified } from "../../_lib/auth-unified";
import {
  getSoundEnabled,
  playPon,
  setSoundEnabled,
  unlockAudio,
} from "../../_lib/sound/playSound";
import OrbGrid from "./OrbGrid";

type Props = {
  role?: string | null;
  visibleModules?: readonly string[];
};

export default function GardenHomeClient({ visibleModules }: Props = {}) {
  const [soundEnabled, setSoundEnabledState] = useState(false);

  useEffect(() => {
    // Sync persisted sound preference after hydration; localStorage is client-only.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSoundEnabledState(getSoundEnabled());
  }, []);

  useEffect(() => {
    document.body.classList.add("home-concept-active");
    return () => document.body.classList.remove("home-concept-active");
  }, []);

  const playSoftSound = useCallback(
    (volume = 0.08) => {
      if (soundEnabled) playPon(volume);
    },
    [soundEnabled],
  );

  const handleSoundToggle = useCallback(() => {
    unlockAudio();
    const next = !soundEnabled;
    setSoundEnabled(next);
    setSoundEnabledState(next);
    if (next) playPon(0.1);
  }, [soundEnabled]);

  const handleOrbHover = useCallback(() => {
    playSoftSound(0.08);
  }, [playSoftSound]);

  const handleOrbClick = useCallback(() => {
    unlockAudio();
    playSoftSound(0.13);
  }, [playSoftSound]);

  const handleMenuClick = useCallback(() => {
    unlockAudio();
    playSoftSound(0.08);
  }, [playSoftSound]);

  const handleLogout = useCallback(async () => {
    unlockAudio();
    playSoftSound(0.08);
    await signOutUnified();
    window.location.href = "/login";
  }, [playSoftSound]);

  return (
    <main className="home-concept" data-home-mode="concept-orbit">
      <div className="home-concept-bg" aria-hidden="true" />

      <div className="home-concept-scene">
        <header className="home-concept-brand">
          <Link href="/" className="home-concept-brand-link" aria-label="Garden Series home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/themes/garden-shell/images/home/logo-garden-series.png"
              alt="Garden Series"
            />
          </Link>
        </header>

        <nav className="home-concept-menu" aria-label="Garden home menu">
          <button className="home-concept-menu-item" type="button" onClick={handleMenuClick}>
            <svg className="home-concept-menu-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6v-5a6 6 0 1 0-12 0v5l-2 2v1h16v-1l-2-2z" />
            </svg>
            <span>お知らせ</span>
          </button>
          <button
            className="home-concept-menu-item"
            type="button"
            aria-pressed={soundEnabled}
            onClick={handleSoundToggle}
          >
            <svg className="home-concept-menu-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 9v6h4l5 4V5L8 9H4zm12.5 1.2a3 3 0 0 1 0 3.6M18.8 7.8a6 6 0 0 1 0 8.4" />
            </svg>
            <span>{soundEnabled ? "音 ON" : "音 OFF"}</span>
          </button>
          <button
            className="home-concept-menu-item home-concept-menu-logout"
            type="button"
            onClick={handleLogout}
          >
            <svg className="home-concept-menu-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M16 17l5-5-5-5M21 12H9M12 19H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h7" />
            </svg>
            <span>ログアウト</span>
          </button>
        </nav>

        <OrbGrid
          visibleModules={visibleModules}
          onOrbHover={handleOrbHover}
          onOrbClick={handleOrbClick}
        />

        <div className="home-concept-footer-brand">
          <span className="home-concept-footer-mark" aria-hidden="true" />
          <span>ヒュアラングループ</span>
        </div>
        <nav className="home-concept-footer-links" aria-label="Footer links">
          <a href="/about">サービスについて</a>
          <a href="/help">サポート</a>
          <a href="/company">会社情報</a>
          <a href="/privacy">プライバシーポリシー</a>
        </nav>
      </div>
    </main>
  );
}

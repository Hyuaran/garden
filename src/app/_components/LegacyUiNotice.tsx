"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import styles from "./LegacyUiNotice.module.css";

type LegacyUiNoticeProps = {
  badgeLabel: string;
  toastTitle?: string;
  toastBody?: string;
  durationMs?: number;
};

export default function LegacyUiNotice({
  badgeLabel,
  toastTitle,
  toastBody,
  durationMs = 5200,
}: LegacyUiNoticeProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const title = toastTitle ?? badgeLabel;

  useEffect(() => {
    showTimerRef.current = setTimeout(() => {
      setMounted(true);
      setVisible(true);
      timerRef.current = setTimeout(() => setVisible(false), durationMs);
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setVisible(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [durationMs]);

  return (
    <>
      <span className={styles.badge}>{badgeLabel}</span>
      {mounted &&
        createPortal(
          <div
            className={`${styles.toast} ${visible ? styles.toastVisible : ""}`}
            role="status"
            aria-live="polite"
            aria-hidden={!visible}
          >
            <div>
              <p className={styles.toastTitle}>{title}</p>
              {toastBody && <p className={styles.toastBody}>{toastBody}</p>}
            </div>
            <button
              className={styles.close}
              type="button"
              aria-label="通知を閉じる"
              onClick={() => setVisible(false)}
            >
              ×
            </button>
          </div>,
          document.body,
        )}
    </>
  );
}

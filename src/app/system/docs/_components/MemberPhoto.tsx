"use client";

import { useEffect, useState } from "react";
import styles from "../docs.module.css";

export default function MemberPhoto({ name, src }: { name: string; src?: string }) {
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [expanded]);
  if (!src || failed) {
    return <span className={styles.initial} role="img" aria-label={`${name}のイニシャル`}>{Array.from(name.trim())[0]}</span>;
  }
  // 非公開Storageの期限付きURLを直接表示。公開画像の最適化キャッシュを経由させない。
  return <>
    <button className={styles.memberPhotoButton} type="button" onClick={() => setExpanded(true)} aria-label={`${name}の写真を拡大表示`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.memberPhoto} src={src} alt={`${name}の写真`} width={160} height={160} loading="eager" referrerPolicy="no-referrer" onError={() => { setExpanded(false); setFailed(true); }} />
    </button>
    {expanded && <div className={styles.memberPhotoOverlay} role="dialog" aria-modal="true" aria-label={`${name}の写真を拡大表示`} onClick={() => setExpanded(false)}>
      <div className={styles.memberPhotoDialog} onClick={event => event.stopPropagation()}>
        <button className={styles.memberPhotoClose} type="button" onClick={() => setExpanded(false)} aria-label="拡大写真を閉じる">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.memberPhotoLarge} src={src} alt={`${name}の写真`} loading="eager" referrerPolicy="no-referrer" onError={() => { setExpanded(false); setFailed(true); }} />
        <p className={styles.memberPhotoName}>{name}</p>
      </div>
    </div>}
  </>;
}

"use client";

import { useState } from "react";
import styles from "../docs.module.css";

export default function MemberPhoto({ name, src }: { name: string; src?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <span className={styles.initial} role="img" aria-label={`${name}のイニシャル`}>{Array.from(name.trim())[0]}</span>;
  }
  // 非公開Storageの期限付きURLを直接表示。公開画像の最適化キャッシュを経由させない。
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={styles.memberPhoto} src={src} alt={`${name}の写真`} width={160} height={160} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

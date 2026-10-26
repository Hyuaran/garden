"use client";

import { useCallback, useEffect, useState } from "react";
import Modal from "@/app/system/_components/Modal/Modal";
import type { MonthlyDigest } from "../../_types/monthly-digest";
import { DigestPageRenderer } from "./DigestPageRenderer";

type Props = { digest: MonthlyDigest; startIndex?: number; onClose: () => void };

export function ProjectionViewer({ digest, startIndex = 0, onClose }: Props) {
  const total = digest.pages.length;
  const [index, setIndex] = useState(Math.min(startIndex, Math.max(0, total - 1)));
  const next = useCallback(() => setIndex(i => Math.min(i + 1, total - 1)), [total]);
  const prev = useCallback(() => setIndex(i => Math.max(i - 1, 0)), []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === " ") { event.preventDefault(); next(); }
      if (event.key === "ArrowLeft") { event.preventDefault(); prev(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  return <Modal title="月次ダイジェスト" onClose={onClose} actions={<>
    <button type="button" data-modal-action="secondary" onClick={onClose}>閉じる</button>
    {total > 0 && <>
      <button type="button" onClick={prev} disabled={index === 0}>前へ</button>
      <button type="button" data-modal-action="secondary" onClick={next} disabled={index >= total - 1}>次へ</button>
    </>}
  </>}>
    {total === 0 ? <p>ページがありません</p> : <>
      <p>{index + 1} / {total}</p>
      <DigestPageRenderer page={digest.pages[index]} digest={digest} projection />
    </>}
  </Modal>;
}

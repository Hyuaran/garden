"use client";

import { useEffect, useState } from "react";
import Modal from "@/app/system/_components/Modal/Modal";
import { ActionButton, ActionRow, ResultMessage } from "@/app/system/forms/_components/form-kit";
import { CLARITY_MASK } from "@/app/_lib/clarity-mask";
import type { loadCaseDetail } from "./actions";
import { DETAIL_CUSTOMER_FIELDS, DETAIL_ORDER_FIELDS, type CaseDetail, type CasePhoto, type CaseRow, type DetailField } from "./cases";
import styles from "./case-dialog.module.css";

function Details({ detail, fields }: { detail: CaseDetail; fields: readonly (readonly [DetailField, string])[] }) {
  return (
    <dl className={styles.values}>
      {fields.map(([field, label]) => {
        const value = detail[field];
        let display = value ?? "—";
        if (field === "billing_amount" && value !== null) display = `${Number(value).toLocaleString("ja-JP")} 円`;
        if (field === "address" && detail.postal_code) display = `〒${detail.postal_code} ${value ?? ""}`;
        return (
          <div key={field}>
            <dt>{label}</dt>
            <dd className={field === "billing_amount" ? styles.amount : undefined}>{display}</dd>
          </div>
        );
      })}
    </dl>
  );
}

async function jpegBlob(photo: CasePhoto) {
  const response = await fetch(photo.url);
  if (!response.ok) throw new Error("画像の取得に失敗しました。");
  const blob = await response.blob();
  if (photo.jpeg) return blob;

  // 既存の PNG などは端末で JPEG に変換して保存する。
  const image = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("画像の変換に失敗しました。");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(result => result ? resolve(result) : reject(new Error("画像の変換に失敗しました。")), "image/jpeg", 0.95);
    });
  } finally {
    image.close();
  }
}

function Photos({ photos }: { photos: CasePhoto[] }) {
  const [index, setIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const photo = index === null ? undefined : photos[index];

  function show(position: number | null) {
    setError("");
    setIndex(position);
  }

  async function save(image: CasePhoto) {
    setSaving(true);
    setError("");
    try {
      const url = URL.createObjectURL(await jpegBlob(image));
      const link = document.createElement("a");
      link.href = url;
      link.download = image.filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      setError("画像を保存できませんでした。画像が開けるか確認してください。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <h3>写メ（{photos.length} 枚）</h3>
      <ResultMessage>{error}</ResultMessage>
      {photo && index !== null ? (
        <>
          <ActionRow>
            <ActionButton onClick={() => show(null)}>一覧に戻る</ActionButton>
            <ActionButton disabled={index === 0} onClick={() => show(index - 1)}>前の画像</ActionButton>
            <span aria-live="polite">{index + 1} / {photos.length}</span>
            <ActionButton disabled={index === photos.length - 1} onClick={() => show(index + 1)}>次の画像</ActionButton>
            <ActionButton disabled={saving} onClick={() => void save(photo)}>画像を保存</ActionButton>
          </ActionRow>
          {/* 非公開の原寸画像を署名 URL から直接表示する。 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={photo.filename} className={styles.largePhoto} src={photo.url} alt={`写メ ${index + 1}`} loading="lazy"
            onError={() => setError("画像を表示できませんでした。")} />
        </>
      ) : (
        <div className={styles.thumbnails}>
          {photos.map((item, position) => (
            <ActionButton key={item.filename} aria-label={`写メ ${position + 1} を拡大`}
              onClick={() => show(position)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt="" loading="lazy" />
            </ActionButton>
          ))}
        </div>
      )}
    </section>
  );
}

export default function CaseDialog({ row, read, onClose }: {
  row: CaseRow; read: ReturnType<typeof loadCaseDetail>; onClose: () => void;
}) {
  const [result, setResult] = useState<Awaited<ReturnType<typeof loadCaseDetail>> | null>(null);
  useEffect(() => {
    let closed = false;
    void read.then(data => { if (!closed) setResult(data); });
    return () => { closed = true; };
  }, [read]);

  const title = [row.kanri_no ?? row.kanri_no_raw, row.customer_name].filter(Boolean).join(" ");
  return (
    <Modal size="lg" title={title || "案件詳細"} onClose={onClose} className="clarity-mask">
      <div {...CLARITY_MASK}>
        {!result ? <p role="status">読み込み中…</p> : "error" in result ? <ResultMessage>{result.error}</ResultMessage> : (
          <>
            <div className={styles.detailColumns}>
              <Details detail={result.detail} fields={DETAIL_ORDER_FIELDS} />
              <Details detail={result.detail} fields={DETAIL_CUSTOMER_FIELDS} />
            </div>
            {result.photoError ? <ResultMessage>{result.photoError}</ResultMessage> : <Photos photos={result.photos} />}
            <section>
              <h3>備考</h3>
              <p className={styles.note}>{result.detail.note ?? "—"}</p>
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}

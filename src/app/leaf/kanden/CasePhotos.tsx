"use client";

import { useState, type ReactNode } from "react";
import Modal from "@/app/system/_components/Modal/Modal";
import { ActionButton, ActionRow, ResultMessage, TextField } from "@/app/system/forms/_components/form-kit";
import { verifyKandenPhotoPassword } from "./photo-password-actions";
import type { CasePhoto } from "./cases";
import styles from "./case-dialog.module.css";

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

export default function CasePhotos<T extends CasePhoto>({ photos, entry = false, emptyText = "写メはありません。", photoControls }: {
  photos: T[]; entry?: boolean; emptyText?: string; photoControls?: (photo: T, position: number) => ReactNode;
}) {
  const [shownUrl, setShownUrl] = useState<string | null>(entry ? photos[0]?.url ?? null : null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const position = photos.findIndex(item => item.url === shownUrl);
  const index = position >= 0 ? position : entry && shownUrl && photos.length ? 0 : null;
  const photo = index === null ? undefined : photos[index];
  const [unlocked, setUnlocked] = useState(false);
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [checking, setChecking] = useState(false);

  function startSave(image: CasePhoto) {
    if (!unlocked && (window.innerWidth < 768 || navigator.maxTouchPoints > 0 ||
        window.matchMedia?.("(any-pointer: coarse)").matches)) {
      setPassword("");
      setPasswordError("");
      setPasswordDialog(true);
      return;
    }
    void save(image);
  }

  async function unlock(image: CasePhoto) {
    setChecking(true);
    setPasswordError("");
    try {
      const result = await (entry ? verifyKandenPhotoPassword(password, true) : verifyKandenPhotoPassword(password));
      if (result.error) setPasswordError(result.error);
      else {
        setUnlocked(true);
        setPasswordDialog(false);
        setPassword("");
        await save(image);
      }
    } catch {
      setPasswordError("パスワードを確認できませんでした。もう一度お試しください。");
    } finally {
      setChecking(false);
    }
  }

  function show(position: number | null) {
    setError("");
    setZoom(1);
    setRotation(0);
    setShownUrl(position === null ? null : photos[position]?.url ?? null);
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

  // 非公開の原寸画像を署名 URL から直接表示する。
  // eslint-disable-next-line @next/next/no-img-element
  const preview = photo && index !== null && <img key={photo.filename} className={styles.largePhoto}
    src={photo.url} alt={`写メ ${index + 1}`} loading="lazy"
    style={entry ? { transform: `rotate(${rotation}deg)`, maxHeight: `${65 * zoom}vh` } : undefined}
    onError={() => setError("画像を表示できませんでした。")} />;

  return (
    <section className={entry ? styles.entryPhotos : undefined}>
      {entry ? <header className={styles.imageToolbar}>
        <h2>申込書プレビュー</h2>
        <div className={styles.zoomGroup}>
          <ActionButton aria-label="縮小" disabled={!photo || zoom <= 0.5} onClick={() => setZoom(zoom - 0.25)}>−</ActionButton>
          <span aria-live="polite">{Math.round(zoom * 100)}%</span>
          <ActionButton aria-label="拡大" disabled={!photo || zoom >= 3} onClick={() => setZoom(zoom + 0.25)}>＋</ActionButton>
          <ActionButton aria-label="100%に戻す" disabled={!photo} onClick={() => setZoom(1)}>100%</ActionButton>
        </div>
      </header> : <h3>写メ（{photos.length} 枚）</h3>}
      <ResultMessage>{error}</ResultMessage>
      {photo && index !== null ? (
        <>
          <ActionRow>
            <ActionButton onClick={() => show(null)}>一覧に戻る</ActionButton>
            <ActionButton disabled={index === 0} onClick={() => show(index - 1)}>前の画像</ActionButton>
            <span aria-live="polite">{index + 1} / {photos.length}</span>
            <ActionButton disabled={index === photos.length - 1} onClick={() => show(index + 1)}>次の画像</ActionButton>
            <ActionButton disabled={saving} onClick={() => startSave(photo)}>画像を保存</ActionButton>
            {entry && <ActionButton onClick={() => setRotation((rotation + 90) % 360)}>90度回転</ActionButton>}
            {photoControls?.(photo, index)}
          </ActionRow>
          {entry ? <div className={styles.photoViewport}>
            <div style={{ inlineSize: `${zoom * 100}%` }}>{preview}</div>
          </div> : preview}
        </>
      ) : entry && !photos.length ? <p className={styles.photoEmpty}>{emptyText}</p> : (
        <div className={styles.thumbnails}>
          {photos.map((item, position) => <div key={item.filename} className={styles.thumbnail}>
            <ActionButton key={item.filename} aria-label={`写メ ${position + 1} を拡大`}
              onClick={() => show(position)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt="" loading="lazy" />
            </ActionButton>
            {photoControls?.(item, position)}
          </div>)}
        </div>
      )}
      {passwordDialog && photo && <Modal title="画像保存のパスワード" size="sm"
        onClose={() => setPasswordDialog(false)} dismissible={!checking}>
        <ResultMessage>{passwordError}</ResultMessage>
        <form onSubmit={event => { event.preventDefault(); void unlock(photo); }}>
          <TextField type="password" aria-label="画像保存のパスワード" value={password}
            onChange={event => setPassword(event.target.value)} autoComplete="off" disabled={checking} />
          <ActionRow>
            <ActionButton onClick={() => setPasswordDialog(false)} disabled={checking}>戻る</ActionButton>
            <ActionButton type="submit" disabled={checking || !password}>確認して保存</ActionButton>
          </ActionRow>
        </form>
      </Modal>}
    </section>
  );
}

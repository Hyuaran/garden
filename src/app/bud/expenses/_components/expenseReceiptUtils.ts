/**
 * 経費レシートの保存先まわりの共有ヘルパー（承認待ち/完了待ち 両パネルで使用）
 *
 * 保存の役割分担（Phase 7 以降）:
 *   storage_path   … Supabase Storage のパス（レビュー画面の画像表示用の正）
 *   drive_file_id  … Google Drive のファイルID（申請者向けミラー）
 * 旧データは drive_file_id に Storage パス（EMP- 始まり）が入っていたため、
 * SQL バックフィル前でも表示できるようフォールバックする。
 */

export type ReceiptPathRow = { storage_path?: string | null; drive_file_id?: string | null };

/** レビュー表示用の Supabase Storage パスを解決（無ければ null） */
export function resolveReceiptStoragePath(row: ReceiptPathRow): string | null {
  if (row.storage_path) return row.storage_path;
  if (row.drive_file_id && row.drive_file_id.startsWith("EMP-")) return row.drive_file_id; // 旧データ救済
  return null;
}

/**
 * Drive 上のレシートを状態別フォルダへ移動（ベストエフォート）。
 * 失敗しても業務処理は止めない（Drive は申請者向けミラーのため）。
 */
export async function notifyDriveMove(requestId: string, action: "returned" | "approved" | "completed"): Promise<void> {
  try {
    await fetch("/api/bud/expense-drive/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, action }),
    });
  } catch {
    // ミラー移動の失敗は無視（後から手動でも直せる）
  }
}

/**
 * Drive 上のレシートを「レシート日付_時刻_社員番号_店名_金額.jpg」へ自動リネーム（経理承認時・ベストエフォート）。
 */
export async function notifyDriveRename(requestId: string): Promise<void> {
  try {
    await fetch("/api/bud/expense-drive/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
  } catch {
    // リネーム失敗は無視（名前が機械的なまま残るだけ）
  }
}

/**
 * Drive 上のレシート画像の中身を差し替え（回転補正の反映・ベストエフォート）。
 */
export async function notifyDriveContentUpdate(requestId: string, blob: Blob): Promise<void> {
  try {
    const fd = new FormData();
    fd.append("requestId", requestId);
    fd.append("file", blob, "rotated.jpg");
    await fetch("/api/bud/expense-drive/update-content", { method: "POST", body: fd });
  } catch {
    // ミラー更新の失敗は無視（Storage 側が正）
  }
}

/** 画像 Blob を指定角度（90の倍数）回転して返す */
export async function rotateImageBlob(blob: Blob, deg: number): Promise<Blob> {
  if (!deg) return blob;
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = url;
    });
    const swap = deg % 180 !== 0;
    const canvas = document.createElement("canvas");
    canvas.width = swap ? img.height : img.width;
    canvas.height = swap ? img.width : img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return blob;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((deg * Math.PI) / 180);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    return await new Promise<Blob>((res) => canvas.toBlob((b) => res(b ?? blob), "image/jpeg", 0.9));
  } finally {
    URL.revokeObjectURL(url);
  }
}

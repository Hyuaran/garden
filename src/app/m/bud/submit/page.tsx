"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createBrowserClient } from "@/app/_lib/supabase/browser";

import {
  budBackLink,
  budCard,
  budHeader,
  budLead,
  budMobile,
  budNotice,
  budPage,
  budPrimaryButton,
  budSecondaryButton,
  budSectionTitle,
  budTitle,
} from "../../_lib/mobile-theme";
import { CameraCapture } from "./CameraCapture";

type Shot = {
  id: string;
  url: string;
  ts: number;
  selected: boolean;
  failed: boolean;
  rotation: number;
};

type ExpenseKind = "individual" | "company";

type ExpenseOcrResult = {
  receipt_date: string | null;
  receipt_time: string | null;
  store_name: string | null;
  amount: number | null;
  qualified_number: string | null;
  qualified_class: "有" | "無";
  category_id: string | null;
  category_name: string | null;
  orientation: 0 | 90 | 180 | 270;
  confidence: "high" | "low";
};

type OcrProgress = {
  done: number;
  total: number;
};

type CorpOption = { id: string; name_short: string | null };
type ApplicantEmployee = { employee_id: string; expense_default_corp_id?: string | null };

const MAX_SHOTS = 50;
const OCR_CONCURRENCY = 2;
const OCR_TIMEOUT_MS = 45000;

async function rotateBlob(blob: Blob, deg: number): Promise<Blob> {
  if (!deg) return blob;
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
    const rad = (deg * Math.PI) / 180;
    const swap = deg % 180 !== 0;
    const canvas = document.createElement("canvas");
    canvas.width = swap ? img.height : img.width;
    canvas.height = swap ? img.width : img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return blob;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(rad);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    return await new Promise<Blob>((resolve) => canvas.toBlob((next) => resolve(next ?? blob), "image/jpeg", 0.9));
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function readReceiptOcr(blob: Blob): Promise<ExpenseOcrResult | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);
  try {
    const fd = new FormData();
    fd.append("file", blob, "receipt.jpg");
    const res = await fetch("/api/bud/expense-ocr", { method: "POST", body: fd, signal: controller.signal });
    const json = (await res.json()) as { ok?: boolean; result?: ExpenseOcrResult };
    if (!res.ok || !json.ok || !json.result) return null;
    return json.result;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

async function runLimited<T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>) {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

export default function MobileExpenseSubmit() {
  const [kind, setKind] = useState<ExpenseKind>("individual");
  const [shots, setShots] = useState<Shot[]>([]);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);
  const [corpOptions, setCorpOptions] = useState<CorpOption[]>([]);
  const [selectedCorpId, setSelectedCorpId] = useState("");
  const [corpLoading, setCorpLoading] = useState(true);
  const seq = useRef(0);
  const router = useRouter();

  const selectedCount = shots.filter((shot) => shot.selected && !shot.failed).length;
  const selectableCount = shots.filter((shot) => !shot.failed).length;
  const selectableCorpOptions =
    selectedCorpId && !corpOptions.some((corp) => corp.id === selectedCorpId)
      ? [{ id: selectedCorpId, name_short: selectedCorpId }, ...corpOptions]
      : corpOptions;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = createBrowserClient();
      setCorpLoading(true);
      try {
        const [corpRes, authRes] = await Promise.all([
          supabase.from("bud_corporations").select("id,name_short").order("id", { ascending: true }),
          supabase.auth.getUser(),
        ]);
        if (!cancelled) setCorpOptions((corpRes.data as CorpOption[] | null) ?? []);

        const authUserId = authRes.data?.user?.id ?? null;
        if (!authUserId) return;

        const empResWithDefault = await supabase
          .from("root_employees")
          .select("employee_id,expense_default_corp_id")
          .eq("user_id", authUserId)
          .maybeSingle<ApplicantEmployee>();
        let defaultCorpId = empResWithDefault.data?.expense_default_corp_id ?? "";
        if (empResWithDefault.error) {
          const empFallbackRes = await supabase.from("root_employees").select("employee_id").eq("user_id", authUserId).maybeSingle<ApplicantEmployee>();
          defaultCorpId = empFallbackRes.data?.expense_default_corp_id ?? "";
        }
        if (!cancelled) setSelectedCorpId(defaultCorpId);
      } finally {
        if (!cancelled) setCorpLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleBack = () => {
    if (shots.length > 0) setShowLeaveConfirm(true);
    else router.push("/m/bud");
  };

  const addShot = (blob: Blob) => {
    seq.current += 1;
    setShots((prev) =>
      prev.length >= MAX_SHOTS
        ? prev
        : [
            ...prev,
            {
              id: `s${seq.current}`,
              url: URL.createObjectURL(blob),
              ts: Date.now(),
              selected: true,
              failed: false,
              rotation: 0,
            },
          ],
    );
    setSent(false);
  };

  const toggle = (id: string) =>
    setShots((prev) => prev.map((shot) => (shot.id === id && !shot.failed ? { ...shot, selected: !shot.selected } : shot)));

  const rotateShot = (id: string) =>
    setShots((prev) => prev.map((shot) => (shot.id === id && !shot.failed ? { ...shot, rotation: (shot.rotation + 90) % 360 } : shot)));

  const markFailed = (id: string) =>
    setShots((prev) => prev.map((shot) => (shot.id === id ? { ...shot, failed: true, selected: false } : shot)));

  const setAll = (selected: boolean) =>
    setShots((prev) => prev.map((shot) => (shot.failed ? shot : { ...shot, selected })));

  const submit = async () => {
    if (selectedCount === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const supabase = createBrowserClient();
      const { data: auth } = await supabase.auth.getUser();
      const authUserId = auth?.user?.id ?? null;
      if (!authUserId) throw new Error("ログインが切れています。もう一度ログインしてください。");

      const { data: emp } = await supabase
        .from("root_employees")
        .select("employee_id")
        .eq("user_id", authUserId)
        .maybeSingle<{ employee_id: string }>();
      const empId = emp?.employee_id ?? null;
      if (!empId) throw new Error("社員情報が見つかりません。");

      const now = new Date();
      const pad = (n: number, width = 2) => String(n).padStart(width, "0");
      const ymd = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
      const hm = `${pad(now.getHours())}${pad(now.getMinutes())}`;
      const empNo = empId.replace(/^EMP-/, "");

      const targets = shots.filter((shot) => shot.selected && !shot.failed);
      // 送信のたびに新しいパスを使う（前回送信が途中失敗していても、既存ファイルとの衝突や
      // 上書き（Storage に UPDATE ポリシーが無く RLS で拒否される）を踏まないため）
      const attemptTs = Date.now();
      setOcrProgress({ done: 0, total: targets.length });
      await runLimited(targets, OCR_CONCURRENCY, async (shot, index) => {
        let blob = await (await fetch(shot.url)).blob();
        if (shot.rotation) blob = await rotateBlob(blob, shot.rotation);

        const ocr = await readReceiptOcr(blob);
        setOcrProgress((prev) => (prev ? { ...prev, done: Math.min(prev.done + 1, prev.total) } : prev));
        if (ocr?.orientation) blob = await rotateBlob(blob, ocr.orientation);

        const driveName = `${ymd}_${hm}_${empNo}_${pad(index + 1)}.jpg`;
        const path = `${empId}/${attemptTs}-${shot.id}.jpg`;

        const up = await supabase.storage
          .from("bud-receipts")
          .upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
        if (up.error) throw new Error(`画像の保存に失敗しました: ${up.error.message}`);

        let driveFileId: string | null = null;
        let driveViewUrl: string | null = null;
        try {
          const fd = new FormData();
          fd.append("file", blob, driveName);
          fd.append("filename", driveName);
          const res = await fetch("/api/bud/expense-drive/upload", { method: "POST", body: fd });
          const json = (await res.json()) as { ok: boolean; fileId?: string; viewUrl?: string | null };
          if (json.ok) {
            driveFileId = json.fileId ?? null;
            driveViewUrl = json.viewUrl ?? null;
          }
        } catch {
          // Storageには保存済みなので、Drive側だけ失敗しても申請は続行する。
        }

        const ins = await supabase.from("bud_expense_requests").insert({
          applicant_employee_id: empId,
          expense_kind: kind,
          corp_id: selectedCorpId || null,
          status: "submitted",
          receipt_date: ocr?.receipt_date ?? null,
          receipt_time: ocr?.receipt_time ?? null,
          store_name: ocr?.store_name ?? null,
          // amount は NOT NULL 列。OCRで読めなかった場合は 0（=未入力扱い・経理が承認待ちで入力）
          amount: ocr?.amount ?? 0,
          qualified_number: ocr?.qualified_number ?? null,
          qualified_class: ocr?.qualified_class ?? null,
          category_id: ocr?.category_id ?? null,
          description: ocr?.confidence === "low" ? "OCR要確認" : null,
          storage_path: up.data?.path ?? path,
          drive_file_id: driveFileId,
          drive_view_url: driveViewUrl,
        });
        if (ins.error) throw new Error(`申請の登録に失敗しました: ${ins.error.message}`);
      });

      setSentCount(targets.length);
      setSent(true);
    } catch (e) {
      // Error 以外（DOMException・イベント・プレーンオブジェクト等）でも原因が読めるよう文字列化する
      const detail =
        e instanceof Error
          ? e.message
          : typeof e === "object" && e !== null
            ? (() => {
                try {
                  return JSON.stringify(e);
                } catch {
                  return String(e);
                }
              })()
            : String(e);
      setError(detail ? `送信に失敗しました: ${detail}` : "送信に失敗しました。");
    } finally {
      setSubmitting(false);
      setOcrProgress(null);
    }
  };

  const resetForm = () => {
    shots.forEach((shot) => URL.revokeObjectURL(shot.url));
    setShots([]);
    setSent(false);
    setSentCount(0);
    setError(null);
    setOcrProgress(null);
  };

  if (sent) {
    return (
      <main style={budPage}>
        <section style={successCard}>
          <div style={successMark}>✓</div>
          <h1 style={{ ...budTitle, textAlign: "center" }}>送信しました</h1>
          <p style={{ ...budLead, textAlign: "center", marginTop: 10 }}>
            {sentCount}件の領収書を経理へ送りました。
            <br />
            内容の確認と承認をお待ちください。
          </p>
        </section>
        <div style={successActions}>
          <button type="button" onClick={resetForm} style={budSecondaryButton}>
            続けて申請する
          </button>
          <button type="button" onClick={() => router.push("/m/bud/drive")} style={budPrimaryButton}>
            申請状況を見る
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ ...budPage, paddingBottom: 120 }}>
      <header style={budHeader}>
        <button type="button" onClick={handleBack} aria-label="戻る" style={{ ...budBackLink, border: undefined }}>
          ‹
        </button>
        <div>
          <h1 style={budTitle}>経費申請</h1>
          <p style={budLead}>領収書を撮って、送る分だけ選びます。</p>
        </div>
      </header>

      {showLeaveConfirm && (
        <div style={modalOverlay}>
          <div style={modalCard}>
            <h2 style={{ ...budSectionTitle, marginBottom: 10 }}>撮影中の画像があります</h2>
            <p style={{ color: budMobile.colors.sub, fontSize: 13, lineHeight: 1.7, margin: "0 0 16px" }}>
              戻ると、この画面で撮影した画像は破棄されます。
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button type="button" onClick={() => setShowLeaveConfirm(false)} style={budSecondaryButton}>
                続ける
              </button>
              <button type="button" onClick={() => router.push("/m/bud")} style={{ ...budPrimaryButton, background: budMobile.colors.red }}>
                破棄して戻る
              </button>
            </div>
          </div>
        </div>
      )}

      <section style={{ ...budCard, padding: 14, marginBottom: 14 }}>
        <h2 style={budSectionTitle}>経費の種類</h2>
        <div style={kindRow}>
          <button type="button" onClick={() => setKind("individual")} style={kindChip(kind === "individual")}>
            個別経費
          </button>
          <button type="button" onClick={() => setKind("company")} style={kindChip(kind === "company")}>
            会社経費
          </button>
        </div>
      </section>

      <section style={{ ...budCard, padding: 14, marginBottom: 14 }}>
        <h2 style={budSectionTitle}>法人</h2>
        <select value={selectedCorpId} onChange={(e) => setSelectedCorpId(e.target.value)} disabled={corpLoading} style={corpSelect}>
          <option value="">未設定</option>
          {selectableCorpOptions.map((corp) => (
            <option key={corp.id} value={corp.id}>
              {corp.name_short ?? corp.id}
            </option>
          ))}
        </select>
        <p style={corpHelp}>通常は既定の法人のまま送信します。</p>
      </section>

      <section style={{ ...budCard, padding: 14, marginBottom: 14 }}>
        <div style={shootHead}>
          <div>
            <h2 style={{ ...budSectionTitle, marginBottom: 4 }}>領収書</h2>
            <p style={{ ...budLead, margin: 0 }}>最大{MAX_SHOTS}枚まで撮影できます。</p>
          </div>
          <button type="button" onClick={() => setCameraOpen(true)} style={budPrimaryButton}>
            撮影する
          </button>
        </div>
      </section>

      {cameraOpen && <CameraCapture onCapture={addShot} onClose={() => setCameraOpen(false)} count={shots.length} max={MAX_SHOTS} />}

      {shots.length === 0 ? (
        <div style={budNotice}>まだ領収書がありません。撮影するボタンから追加してください。</div>
      ) : (
        <section>
          <div style={toolbar}>
            <span>
              {selectedCount}/{selectableCount}件を送信
            </span>
            <span>
              <button type="button" style={linkButton} onClick={() => setAll(true)}>
                全選択
              </button>
              <button type="button" style={linkButton} onClick={() => setAll(false)}>
                全解除
              </button>
            </span>
          </div>
          <div style={shotGrid}>
            {shots.map((shot, index) => (
              <article key={shot.id} style={{ ...shotCard, opacity: shot.failed ? 0.45 : 1 }}>
                <button type="button" onClick={() => toggle(shot.id)} style={selectButton(shot.selected)}>
                  {shot.selected ? "✓" : ""}
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shot.url}
                  alt={`領収書 ${index + 1}`}
                  style={{ width: "100%", height: 138, objectFit: "cover", transform: `rotate(${shot.rotation}deg)` }}
                  onError={() => markFailed(shot.id)}
                />
                <div style={shotFoot}>
                  <span>#{index + 1}</span>
                  <button type="button" style={rotateBtn} onClick={() => rotateShot(shot.id)} disabled={shot.failed}>
                    回転
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {error && <div style={{ ...budNotice, marginTop: 14, color: budMobile.colors.red }}>{error}</div>}

      {submitting && ocrProgress && (
        <div style={ocrProgressCard}>
          <strong>自動読取中...</strong>
          <span>
            {ocrProgress.done}/{ocrProgress.total}件
          </span>
        </div>
      )}

      <div style={submitBar}>
        <button type="button" disabled={selectedCount === 0 || submitting} onClick={() => void submit()} style={submitButton(selectedCount === 0 || submitting)}>
          {submitting && ocrProgress ? `自動読取中... ${ocrProgress.done}/${ocrProgress.total}` : submitting ? "送信中..." : `${selectedCount}件を送信`}
        </button>
      </div>
    </main>
  );
}

const kindRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };
const kindChip = (active: boolean): React.CSSProperties => ({
  ...budSecondaryButton,
  background: active ? budMobile.colors.goldStrong : "#fffdf6",
  color: active ? "#fff" : budMobile.colors.sub,
  borderColor: active ? budMobile.colors.goldStrong : budMobile.colors.borderStrong,
});
const corpSelect: React.CSSProperties = {
  width: "100%",
  border: `1px solid ${budMobile.colors.borderStrong}`,
  borderRadius: 12,
  background: "#fffdf6",
  color: budMobile.colors.text,
  fontFamily: budMobile.font.serif,
  fontSize: 15,
  padding: "11px 12px",
  outline: "none",
};
const corpHelp: React.CSSProperties = {
  margin: "8px 0 0",
  color: budMobile.colors.muted,
  fontSize: 12,
  lineHeight: 1.6,
};
const shootHead: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 };
const toolbar: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 10,
  color: budMobile.colors.sub,
  fontSize: 12,
};
const linkButton: React.CSSProperties = { border: "none", background: "transparent", color: budMobile.colors.gold, fontFamily: budMobile.font.serif, marginLeft: 8 };
const shotGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
const shotCard: React.CSSProperties = { ...budCard, position: "relative", overflow: "hidden" };
const selectButton = (active: boolean): React.CSSProperties => ({
  position: "absolute",
  zIndex: 2,
  top: 8,
  left: 8,
  width: 28,
  height: 28,
  borderRadius: 999,
  border: active ? "none" : "1px solid rgba(255,255,255,0.8)",
  background: active ? budMobile.colors.goldStrong : "rgba(61,53,40,0.38)",
  color: "#fff",
  fontWeight: 700,
});
const shotFoot: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", color: budMobile.colors.sub, fontSize: 12 };
const rotateBtn: React.CSSProperties = { border: "none", background: "transparent", color: budMobile.colors.gold, fontFamily: budMobile.font.serif };
const ocrProgressCard: React.CSSProperties = {
  ...budCard,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  marginTop: 14,
  padding: "12px 14px",
  color: budMobile.colors.sub,
  fontSize: 13,
};
const submitBar: React.CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: "calc(70px + env(safe-area-inset-bottom))",
  padding: "10px 16px",
  background: "linear-gradient(180deg, rgba(247,244,236,0), rgba(247,244,236,0.96) 30%)",
  zIndex: 40,
};
const submitButton = (disabled: boolean): React.CSSProperties => ({
  ...budPrimaryButton,
  width: "min(528px, 100%)",
  display: "block",
  margin: "0 auto",
  opacity: disabled ? 0.55 : 1,
});
const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 80,
  background: "rgba(61,53,40,0.42)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
};
const modalCard: React.CSSProperties = { ...budCard, width: "min(360px, 100%)", padding: 18, background: "#fffdf6" };
const successCard: React.CSSProperties = { ...budCard, padding: 26, marginTop: 38, textAlign: "center" };
const successMark: React.CSSProperties = {
  width: 68,
  height: 68,
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(94,125,68,0.14)",
  color: budMobile.colors.green,
  fontSize: 34,
  marginBottom: 18,
};
const successActions: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 };

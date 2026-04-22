"use client";

/**
 * 進行期の数値更新フォーム（📊 タブ）
 *
 * - PdfUploader から抽出値をプリフィル
 * - 手動編集可能
 * - 保存ボタン → updateShinkouki
 */
import { useState, type FormEvent } from "react";

import { C } from "../_constants/colors";
import type { Shinkouki } from "../_constants/companies";
import { updateShinkouki } from "../_lib/mutations";
import type { ParsePdfResult } from "../_lib/types";
import { PdfUploader } from "./PdfUploader";

type Props = {
  companyId: string;
  initial: Shinkouki;
  onSaved: () => void;
  onClose: () => void;
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1.5px solid #d8f3dc",
  borderRadius: 8,
  fontSize: 14,
  boxSizing: "border-box" as const,
  fontFamily: "inherit",
  background: "#fff",
  color: C.textDark,
};

const labelStyle = {
  display: "block",
  marginBottom: 6,
  fontSize: 13,
  color: C.textSub,
};

export function NumberUpdateForm({ companyId, initial, onSaved, onClose }: Props) {
  const [uriage, setUriage] = useState<string>(initial.uriage?.toString() ?? "");
  const [gaichuhi, setGaichuhi] = useState<string>(initial.gaichuhi?.toString() ?? "");
  const [rieki, setRieki] = useState<string>(initial.rieki?.toString() ?? "");
  const [reflected, setReflected] = useState<string>(initial.reflected);
  const [zantei, setZantei] = useState<boolean>(initial.zantei);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleExtracted(data: ParsePdfResult) {
    if (data.company_id && data.company_id !== companyId) {
      setError(`この PDF は ${data.company_id} 宛です（${companyId} ではありません）`);
      return;
    }
    if (data.uriage !== null) setUriage(String(data.uriage));
    if (data.gaichuhi !== null) setGaichuhi(String(data.gaichuhi));
    if (data.rieki !== null) setRieki(String(data.rieki));
    if (data.period) setReflected(`${data.period}まで反映中`);
    setError("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await updateShinkouki(companyId, {
        uriage: uriage === "" ? null : parseInt(uriage, 10),
        gaichuhi: gaichuhi === "" ? null : parseInt(gaichuhi, 10),
        rieki: rieki === "" ? null : parseInt(rieki, 10),
        reflected,
        zantei,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PdfUploader onExtracted={handleExtracted} onError={setError} />

      <div>
        <label style={labelStyle}>売上高（円）</label>
        <input
          type="text"
          inputMode="numeric"
          value={uriage}
          onChange={(e) => setUriage(e.target.value.replace(/[^\d-]/g, ""))}
          style={inputStyle}
          placeholder="190797587"
        />
      </div>

      <div>
        <label style={labelStyle}>外注費（円）</label>
        <input
          type="text"
          inputMode="numeric"
          value={gaichuhi}
          onChange={(e) => setGaichuhi(e.target.value.replace(/[^\d-]/g, ""))}
          style={inputStyle}
          placeholder="124932774"
        />
      </div>

      <div>
        <label style={labelStyle}>利益（円、赤字は負の値）</label>
        <input
          type="text"
          inputMode="numeric"
          value={rieki}
          onChange={(e) => setRieki(e.target.value.replace(/[^\d-]/g, ""))}
          style={inputStyle}
          placeholder="6444667"
        />
      </div>

      <div>
        <label style={labelStyle}>反映済み期間</label>
        <input
          type="text"
          value={reflected}
          onChange={(e) => setReflected(e.target.value)}
          style={inputStyle}
          placeholder="2026/3まで反映中"
        />
      </div>

      <div>
        <label style={labelStyle}>状態</label>
        <div style={{ display: "flex", gap: 16 }}>
          <label>
            <input type="radio" checked={zantei} onChange={() => setZantei(true)} />
            <span style={{ marginLeft: 6 }}>暫定</span>
          </label>
          <label>
            <input type="radio" checked={!zantei} onChange={() => setZantei(false)} />
            <span style={{ marginLeft: 6 }}>確定</span>
          </label>
        </div>
      </div>

      {error && (
        <div style={{ color: C.red, fontSize: 13 }}>⚠️ {error}</div>
      )}

      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: `1px solid ${C.textMuted}`,
            background: "#fff",
            color: C.textDark,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          キャンセル
        </button>
        <button
          type="submit"
          disabled={saving}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            background: C.midGreen,
            color: "#fff",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </form>
  );
}

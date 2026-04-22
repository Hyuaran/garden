"use client";

/**
 * 期切り替えフォーム（🔄 タブ）
 *
 * 進行期を確定決算期として fiscal_periods に昇格し、
 * 次期の進行期を開始する（年1回の運用）。
 */
import { useState, type FormEvent } from "react";

import { C } from "../_constants/colors";
import type { Shinkouki } from "../_constants/companies";
import { rolloverPeriod } from "../_lib/mutations";

type Props = {
  companyId: string;
  current: Shinkouki;
  onRolledOver: () => void;
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

export function PeriodRolloverForm({ companyId, current, onRolledOver, onClose }: Props) {
  const [junshisan, setJunshisan] = useState("");
  const [genkin, setGenkin] = useState("");
  const [yokin, setYokin] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirmed() {
    setError("");
    setSaving(true);
    try {
      await rolloverPeriod(companyId, {
        junshisan: parseInt(junshisan, 10),
        genkin: parseInt(genkin, 10),
        yokin: parseInt(yokin, 10),
        doc_url: docUrl,
      });
      onRolledOver();
    } catch (e) {
      setError(e instanceof Error ? e.message : "期切り替えに失敗しました");
    } finally {
      setSaving(false);
      setShowConfirm(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!junshisan || !genkin || !yokin || !docUrl) {
      setError("すべての項目を入力してください");
      return;
    }
    setShowConfirm(true);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ padding: 12, background: C.bgWarm3, borderRadius: 8, fontSize: 13, color: C.textSub }}>
        ⚠️ 第{current.ki}期の進行期データを確定決算として保存し、第{current.ki + 1}期の進行期をスタートします。<br />
        現在の売上/外注/利益も含めて確定期データに保存されます。
      </div>

      <div>
        <label style={labelStyle}>純資産（円）</label>
        <input
          type="text"
          inputMode="numeric"
          value={junshisan}
          onChange={(e) => setJunshisan(e.target.value.replace(/[^\d-]/g, ""))}
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>現金（円）</label>
        <input
          type="text"
          inputMode="numeric"
          value={genkin}
          onChange={(e) => setGenkin(e.target.value.replace(/[^\d-]/g, ""))}
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>預金（円）</label>
        <input
          type="text"
          inputMode="numeric"
          value={yokin}
          onChange={(e) => setYokin(e.target.value.replace(/[^\d-]/g, ""))}
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>決算書 URL（Google Drive リンク等）</label>
        <input
          type="url"
          value={docUrl}
          onChange={(e) => setDocUrl(e.target.value)}
          style={inputStyle}
          placeholder="https://drive.google.com/..."
        />
      </div>

      {error && (
        <div style={{ color: C.red, fontSize: 13 }}>⚠️ {error}</div>
      )}

      {showConfirm && (
        <div style={{ padding: 16, background: "#fffbea", borderRadius: 8, border: `1px solid ${C.gold}` }}>
          <div style={{ fontSize: 14, marginBottom: 12, color: C.textDark, fontWeight: 600 }}>
            ⚠️ 本当に実行しますか？この操作は取り消せません。
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => setShowConfirm(false)}
              disabled={saving}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: `1px solid ${C.textMuted}`,
                background: "#fff",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              やめる
            </button>
            <button
              type="button"
              onClick={handleConfirmed}
              disabled={saving}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: C.red,
                color: "#fff",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {saving ? "処理中..." : "実行する"}
            </button>
          </div>
        </div>
      )}

      {!showConfirm && (
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
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              background: C.gold,
              color: "#fff",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            期切り替え実行
          </button>
        </div>
      )}
    </form>
  );
}

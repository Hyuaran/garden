"use client";

import { useState, type CSSProperties, type FormEvent } from "react";

import type { ChangeBirthdayWithPasswordResult } from "../../_actions/change-birthday-with-password";

export type ChangeBirthdayModalProps = {
  open: boolean;
  onClose: () => void;
  currentBirthday: string;
  onSubmit: (input: {
    newBirthday: string;
    currentPassword: string;
  }) => Promise<ChangeBirthdayWithPasswordResult>;
  onSuccess?: () => void;
};

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};
const panelStyle: CSSProperties = {
  width: "min(480px, 92vw)",
  background: "#fff",
  borderRadius: 12,
  padding: 24,
  boxShadow: "0 16px 32px rgba(0,0,0,0.2)",
  fontFamily: "'Noto Sans JP', sans-serif",
  color: "#222",
};

export function ChangeBirthdayModal(props: ChangeBirthdayModalProps) {
  const { open, onClose, currentBirthday } = props;
  const [newBirthday, setNewBirthday] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting || !newBirthday || !currentPassword) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await props.onSubmit({ newBirthday, currentPassword });
      if (result.success) {
        props.onSuccess?.();
        setNewBirthday("");
        setCurrentPassword("");
        onClose();
        return;
      }
      setError(result.errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={overlayStyle}>
      <div style={panelStyle} role="dialog" aria-modal="true">
        <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>誕生日の変更</h2>
        <form onSubmit={handleSubmit}>
          <p>現在の誕生日: {currentBirthday}</p>
          <div style={{ marginTop: 12 }}>
            <label htmlFor="cbm-new-birthday" style={{ display: "block", fontSize: 12, color: "#666" }}>
              新しい誕生日
            </label>
            <input
              id="cbm-new-birthday"
              type="date"
              value={newBirthday}
              onChange={(e) => setNewBirthday(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              required
              style={{ width: "100%", padding: 10, fontSize: 14, color: "#222", background: "#fff" }}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <label htmlFor="cbm-current-pw" style={{ display: "block", fontSize: 12, color: "#666" }}>
              現在のパスワード
            </label>
            <input
              id="cbm-current-pw"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              style={{ width: "100%", padding: 10, fontSize: 14, color: "#222", background: "#fff" }}
            />
            <p style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
              ※本人確認のため入力してください
            </p>
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose}>
              キャンセル
            </button>
            <button
              type="submit"
              disabled={!newBirthday || !currentPassword || submitting}
            >
              {submitting ? "変更中..." : "変更する"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

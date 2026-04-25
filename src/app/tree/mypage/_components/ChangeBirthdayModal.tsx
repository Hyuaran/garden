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

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // 実装は Task 12 で
  };

  return (
    <div style={overlayStyle}>
      <div style={panelStyle} role="dialog" aria-modal="true">
        <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>誕生日の変更</h2>
        <form onSubmit={handleSubmit}>
          <p>現在の誕生日: {currentBirthday}</p>
          <p style={{ fontSize: 12, color: "#666" }}>
            （以後 Task 11 で入力欄を追加）
          </p>
          <div style={{ marginTop: 16, display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose}>
              キャンセル
            </button>
            <button type="submit" disabled>変更する</button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInLeaf, isLeafUnlocked } from "../_lib/auth";
import { colors } from "../_constants/colors";

export default function LeafLoginPage() {
  const router = useRouter();
  const [empId, setEmpId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 既にログイン済みならバックオフィスへ
  useEffect(() => {
    if (isLeafUnlocked()) {
      router.replace("/leaf/backoffice");
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signInLeaf(empId.trim(), password);
      if (!result.success) {
        setError(result.error ?? "ログインに失敗しました");
        return;
      }
      router.replace("/leaf/backoffice");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: colors.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Meiryo, sans-serif",
      }}
    >
      <div
        style={{
          background: colors.bgCard,
          borderRadius: 12,
          padding: "40px 48px",
          width: "100%",
          maxWidth: 400,
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        }}
      >
        {/* ロゴ */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: colors.accent,
              color: "#fff",
              fontSize: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px",
            }}
          >
            🍃
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: colors.text }}>
            Garden Leaf
          </div>
          <div style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
            関電業務委託 — 事務管理
          </div>
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: colors.textMuted,
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              社員番号
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={empId}
              onChange={(e) => setEmpId(e.target.value)}
              placeholder="例: 0008"
              autoFocus
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 6,
                border: `1.5px solid ${colors.border}`,
                fontSize: 15,
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = colors.accent)}
              onBlur={(e) => (e.target.style.borderColor = colors.border)}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 600,
                color: colors.textMuted,
                marginBottom: 6,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="誕生日 MMDD（例: 0417）"
              required
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 6,
                border: `1.5px solid ${colors.border}`,
                fontSize: 15,
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = colors.accent)}
              onBlur={(e) => (e.target.style.borderColor = colors.border)}
            />
          </div>

          {error && (
            <div
              style={{
                background: colors.dangerBg,
                color: colors.danger,
                padding: "10px 12px",
                borderRadius: 6,
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: 6,
              border: "none",
              background: loading ? colors.textMuted : colors.accent,
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "background 0.15s",
            }}
          >
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>

        <div
          style={{
            marginTop: 20,
            fontSize: 11,
            color: colors.textMuted,
            textAlign: "center",
          }}
        >
          画面は5分間操作がないと自動的にロックされます
        </div>
      </div>
    </div>
  );
}

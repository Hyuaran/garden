"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInBloom } from "../bloom/_lib/auth";

export default function GardenLoginPage() {
  const router = useRouter();
  const [empId, setEmpId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await signInBloom(empId, password);
    setSubmitting(false);
    if (result.success) {
      router.push("/");
    } else {
      setError(result.error ?? "ログイン失敗");
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #FAF8F3 0%, #E0F6FF 100%)",
      }}
    >
      <form
        onSubmit={onSubmit}
        style={{
          padding: 32,
          background: "rgba(255,255,255,0.9)",
          borderRadius: 12,
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
          minWidth: 320,
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 24 }}>Garden ログイン</h1>
        <label style={{ display: "block", marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: "#666" }}>社員番号</span>
          <input
            type="text"
            value={empId}
            onChange={(e) => setEmpId(e.target.value)}
            required
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>
        <label style={{ display: "block", marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: "#666" }}>パスワード</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>
        {error && <p style={{ color: "red", fontSize: 14 }}>{error}</p>}
        <button type="submit" disabled={submitting} style={{ padding: "10px 16px", width: "100%" }}>
          {submitting ? "ログイン中…" : "ログイン"}
        </button>
        <p style={{ marginTop: 16, fontSize: 12, color: "#888" }}>
          社内 PC からのみアクセス可能です。
        </p>
      </form>
    </main>
  );
}

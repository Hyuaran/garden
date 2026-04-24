"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useBloomState } from "../../../_state/BloomStateContext";
import type { DigestPage, DigestPageKind, MonthlyDigest } from "../../../_types/monthly-digest";
import { fetchDigestByMonth, updateDigest } from "../../_lib/digest-queries";

const PAGE_KINDS: Array<{ value: DigestPageKind; label: string; icon: string }> = [
  { value: "cover", label: "表紙", icon: "🌸" },
  { value: "achievements", label: "主要達成", icon: "🏆" },
  { value: "progress_graph", label: "進捗グラフ", icon: "📊" },
  { value: "next_month_goals", label: "来月の目標", icon: "🎯" },
  { value: "work_summary", label: "稼働サマリ", icon: "🧮" },
  { value: "custom", label: "カスタム", icon: "📄" },
];

export default function EditDigestPage() {
  const router = useRouter();
  const params = useParams<{ month: string }>();
  const month = params?.month ?? "";

  const { canRead } = useBloomState();
  const isAdmin = canRead("admin");

  const [digest, setDigest] = useState<MonthlyDigest | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [pages, setPages] = useState<DigestPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!month) return;
    setError(null);
    try {
      const d = await fetchDigestByMonth(month);
      if (d) {
        setDigest(d);
        setTitle(d.title);
        setSummary(d.summary ?? "");
        setPages(d.pages);
      } else {
        setError("該当月のダイジェストが見つかりません");
      }
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!digest) return;
    setSaving(true);
    setNotice(null);
    try {
      const updated = await updateDigest(digest.id, { title, summary, pages });
      if (updated) {
        setDigest(updated);
        setNotice("保存しました");
      } else {
        setError("保存に失敗しました");
      }
    } finally {
      setSaving(false);
    }
  };

  const addPage = (kind: DigestPageKind) => {
    const label = PAGE_KINDS.find((p) => p.value === kind)?.label ?? kind;
    setPages((prev) => [...prev, { kind, title: label, body: "" }]);
  };

  const removePage = (index: number) => {
    setPages((prev) => prev.filter((_, i) => i !== index));
  };

  const movePage = (from: number, to: number) => {
    if (to < 0 || to >= pages.length) return;
    setPages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const updatePage = (index: number, patch: Partial<DigestPage>) => {
    setPages((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  if (!isAdmin) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <Link href={`/bloom/monthly-digest/${month}`} style={backLinkStyle}>
          ← 戻る
        </Link>
        <p style={{ marginTop: 16, fontSize: 14, color: "#7f1d1d" }}>
          編集には admin 以上の権限が必要です。
        </p>
      </div>
    );
  }

  if (loading) {
    return <p style={{ fontSize: 13, color: "#6b8e75" }}>読み込み中...</p>;
  }

  if (!digest) {
    return (
      <div>
        <Link href="/bloom/monthly-digest" style={backLinkStyle}>
          ← 一覧へ戻る
        </Link>
        <p style={{ marginTop: 12, fontSize: 13, color: "#7f1d1d" }}>
          {error ?? "ダイジェストが存在しません"}
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <div style={{ marginBottom: 12 }}>
        <Link href={`/bloom/monthly-digest/${month}`} style={backLinkStyle}>
          ← 詳細へ戻る
        </Link>
      </div>

      <header style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1b4332", margin: 0 }}>
          ✏️ {month} ダイジェスト 編集
        </h2>
      </header>

      {error && (
        <div style={errorStyle}>{error}</div>
      )}
      {notice && (
        <div style={noticeStyle}>{notice}</div>
      )}

      <section style={sectionStyle}>
        <label style={labelStyle}>タイトル</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={saving}
          style={inputStyle}
        />

        <label style={{ ...labelStyle, marginTop: 16 }}>
          サマリ（冒頭コメント）
        </label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          disabled={saving}
          rows={3}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />
      </section>

      <section style={sectionStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "#1b4332", margin: 0 }}>
            ページ ({pages.length})
          </h3>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {PAGE_KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => addPage(k.value)}
                disabled={saving}
                style={addBtnStyle}
                title={`${k.label} を追加`}
              >
                + {k.icon} {k.label}
              </button>
            ))}
          </div>
        </div>

        {pages.length === 0 ? (
          <p style={{ fontSize: 12, color: "#95d5b2" }}>ページがありません。</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {pages.map((p, i) => {
              const kindDef = PAGE_KINDS.find((k) => k.value === p.kind);
              return (
                <li
                  key={i}
                  style={{
                    padding: 12,
                    marginBottom: 8,
                    border: "1px solid #d8f3dc",
                    borderRadius: 10,
                    background: "#fff",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{kindDef?.icon ?? "📄"}</span>
                    <span style={{ fontSize: 11, color: "#6b8e75" }}>
                      {kindDef?.label ?? p.kind} · {i + 1} / {pages.length}
                    </span>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => movePage(i, i - 1)}
                        disabled={i === 0 || saving}
                        style={iconBtnStyle(i === 0 || saving)}
                        aria-label="上へ"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => movePage(i, i + 1)}
                        disabled={i === pages.length - 1 || saving}
                        style={iconBtnStyle(i === pages.length - 1 || saving)}
                        aria-label="下へ"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removePage(i)}
                        disabled={saving}
                        style={{ ...iconBtnStyle(saving), color: "#7f1d1d" }}
                        aria-label="削除"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={p.title}
                    onChange={(e) => updatePage(i, { title: e.target.value })}
                    disabled={saving}
                    placeholder="ページタイトル"
                    style={{ ...inputStyle, marginBottom: 8 }}
                  />
                  <textarea
                    value={p.body}
                    onChange={(e) => updatePage(i, { body: e.target.value })}
                    disabled={saving}
                    rows={4}
                    placeholder="本文（Markdown 可 / 改行保持）"
                    style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
                  />
                  <input
                    type="text"
                    value={p.image_url ?? ""}
                    onChange={(e) =>
                      updatePage(i, { image_url: e.target.value || undefined })
                    }
                    disabled={saving}
                    placeholder="画像 URL (任意)"
                    style={{ ...inputStyle, marginTop: 8, fontSize: 12 }}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={() => router.push(`/bloom/monthly-digest/${month}`)}
          disabled={saving}
          style={secondaryBtnStyle}
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            padding: "10px 20px",
            fontSize: 14,
            fontWeight: 700,
            borderRadius: 8,
            border: "none",
            background: saving ? "#d8f3dc" : "#40916c",
            color: saving ? "#6b8e75" : "#fff",
            cursor: saving ? "default" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </div>
  );
}

const backLinkStyle = {
  fontSize: 13,
  color: "#40916c",
  textDecoration: "none",
} as const;

const sectionStyle = {
  background: "#fff",
  borderRadius: 12,
  padding: 16,
  border: "1px solid #d8f3dc",
  marginBottom: 16,
} as const;

const labelStyle = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#1b4332",
  marginBottom: 4,
} as const;

const inputStyle = {
  width: "100%",
  padding: "8px 12px",
  fontSize: 13,
  border: "1px solid #d8f3dc",
  borderRadius: 8,
  outline: "none",
  color: "#1b4332",
  background: "#fff",
  boxSizing: "border-box" as const,
};

const addBtnStyle = {
  padding: "4px 10px",
  fontSize: 11,
  fontWeight: 600,
  borderRadius: 6,
  border: "1px solid #d8f3dc",
  background: "#fff",
  color: "#40916c",
  cursor: "pointer",
  fontFamily: "inherit",
} as const;

function iconBtnStyle(disabled: boolean) {
  return {
    padding: "2px 8px",
    fontSize: 13,
    borderRadius: 4,
    border: "1px solid #d8f3dc",
    background: "#fff",
    color: disabled ? "#d1d5db" : "#40916c",
    cursor: disabled ? "default" : "pointer",
    fontFamily: "inherit",
  } as const;
}

const secondaryBtnStyle = {
  padding: "10px 20px",
  fontSize: 14,
  fontWeight: 600,
  borderRadius: 8,
  border: "1px solid #95d5b2",
  background: "#fff",
  color: "#40916c",
  cursor: "pointer",
  fontFamily: "inherit",
} as const;

const errorStyle = {
  padding: "10px 14px",
  marginBottom: 16,
  borderRadius: 8,
  background: "#fef2f2",
  color: "#7f1d1d",
  fontSize: 12,
} as const;

const noticeStyle = {
  padding: "10px 14px",
  marginBottom: 16,
  borderRadius: 8,
  background: "#d8f3dc",
  color: "#1b4332",
  fontSize: 12,
} as const;

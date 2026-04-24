"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useBloomState } from "../../_state/BloomStateContext";
import type { MonthlyDigest, MonthlyDigestStatus } from "../../_types/monthly-digest";
import { DigestPageRenderer } from "../components/DigestPageRenderer";
import { ProjectionViewer } from "../components/ProjectionViewer";
import {
  archiveDigest,
  fetchDigestByMonth,
  publishDigest,
  toMonthKey,
} from "../_lib/digest-queries";

const STATUS_LABEL: Record<
  MonthlyDigestStatus,
  { label: string; bg: string; color: string }
> = {
  draft: { label: "編集中", bg: "#fef3c7", color: "#92400e" },
  published: { label: "公開", bg: "#d8f3dc", color: "#1b4332" },
  archived: { label: "過去分", bg: "#f1f8f4", color: "#6b8e75" },
};

export default function MonthDigestPage() {
  const router = useRouter();
  const params = useParams<{ month: string }>();
  const month = params?.month ?? "";

  const { canRead, bloomUser } = useBloomState();
  const isAdmin = canRead("admin");

  const [digest, setDigest] = useState<MonthlyDigest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projection, setProjection] = useState(false);
  const [projectionStart, setProjectionStart] = useState(0);

  const load = useCallback(async () => {
    if (!month) return;
    setError(null);
    try {
      const d = await fetchDigestByMonth(month);
      setDigest(d);
      if (!d) setError("該当月のダイジェストが見つかりません");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "取得に失敗しました";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePublish = async () => {
    if (!digest || !bloomUser) return;
    const updated = await publishDigest(digest.id, bloomUser.user_id);
    if (updated) setDigest(updated);
  };

  const handleArchive = async () => {
    if (!digest) return;
    const updated = await archiveDigest(digest.id);
    if (updated) setDigest(updated);
  };

  if (loading) {
    return <p style={{ fontSize: 13, color: "#6b8e75" }}>読み込み中...</p>;
  }

  if (!digest) {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <p style={{ fontSize: 13, color: "#7f1d1d" }}>
          {error ?? "ダイジェストが存在しません"}
        </p>
        <Link href="/bloom/monthly-digest" style={backLinkStyle}>
          ← 一覧へ戻る
        </Link>
      </div>
    );
  }

  const style = STATUS_LABEL[digest.status];
  const key = toMonthKey(digest.digest_month);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <div style={{ marginBottom: 12 }}>
        <Link href="/bloom/monthly-digest" style={backLinkStyle}>
          ← 一覧へ戻る
        </Link>
      </div>

      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1b4332", margin: 0 }}>
              {digest.title}
            </h2>
            <span
              style={{
                fontSize: 11,
                padding: "3px 10px",
                borderRadius: 10,
                background: style.bg,
                color: style.color,
                fontWeight: 600,
              }}
            >
              {style.label}
            </span>
          </div>
          <div style={{ fontSize: 13, color: "#6b8e75" }}>
            {key} · {digest.pages.length} ページ
            {digest.published_at && ` · 公開 ${digest.published_at.slice(0, 10)}`}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              setProjectionStart(0);
              setProjection(true);
            }}
            disabled={digest.pages.length === 0}
            style={primaryBtnStyle(digest.pages.length === 0)}
          >
            🖥️ 投影モード
          </button>
          <a
            href={`/bloom/monthly-digest/${key}/export`}
            target="_blank"
            rel="noreferrer"
            style={secondaryBtnStyle}
          >
            📥 PDF
          </a>
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => router.push(`/bloom/monthly-digest/${key}/edit`)}
                style={secondaryBtnStyle}
              >
                ✏️ 編集
              </button>
              {digest.status === "draft" && (
                <button type="button" onClick={handlePublish} style={primaryBtnStyle(false)}>
                  公開する
                </button>
              )}
              {digest.status === "published" && (
                <button type="button" onClick={handleArchive} style={secondaryBtnStyle}>
                  アーカイブ
                </button>
              )}
            </>
          )}
        </div>
      </header>

      {digest.summary && (
        <div
          style={{
            padding: "14px 18px",
            background: "#f1f8f4",
            borderRadius: 10,
            fontSize: 13,
            color: "#1b4332",
            lineHeight: 1.7,
            whiteSpace: "pre-wrap",
            marginBottom: 20,
          }}
        >
          {digest.summary}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {digest.pages.map((page, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              setProjectionStart(i);
              setProjection(true);
            }}
            style={{
              all: "unset",
              cursor: "pointer",
              display: "block",
              borderRadius: 16,
              position: "relative",
            }}
            title={`投影モードで ${i + 1} ページ目を開く`}
          >
            <DigestPageRenderer page={page} digest={digest} />
          </button>
        ))}
        {digest.pages.length === 0 && (
          <p style={{ fontSize: 13, color: "#95d5b2" }}>
            ページが未登録です。
            {isAdmin && " 編集画面から追加してください。"}
          </p>
        )}
      </div>

      {projection && (
        <ProjectionViewer
          digest={digest}
          startIndex={projectionStart}
          onClose={() => setProjection(false)}
        />
      )}
    </div>
  );
}

const backLinkStyle = {
  fontSize: 13,
  color: "#40916c",
  textDecoration: "none",
} as const;

function primaryBtnStyle(disabled: boolean) {
  return {
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    borderRadius: 8,
    border: "none",
    background: disabled ? "#d8f3dc" : "#40916c",
    color: disabled ? "#6b8e75" : "#fff",
    cursor: disabled ? "default" : "pointer",
    fontFamily: "inherit",
  } as const;
}

const secondaryBtnStyle = {
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 8,
  border: "1px solid #95d5b2",
  background: "#fff",
  color: "#40916c",
  cursor: "pointer",
  fontFamily: "inherit",
  textDecoration: "none",
  display: "inline-block",
} as const;

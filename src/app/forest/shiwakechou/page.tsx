"use client";

/**
 * 仕訳帳機能 トップページ — 6 法人カード一覧
 *
 * spec: docs/superpowers/specs/2026-04-26-shiwakechou-bud-migration-design.md §画面 1
 *
 * 認証: Forest 親レイアウト経由 (admin / executive)
 * Forest コアパッケージへの直接 import は避ける (Bud 移行容易性確保)
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

interface CorpRow {
  id: string;
  code: string;
  name_full: string;
  name_short: string;
  sort_order: number;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const CORP_COLORS: Record<string, string> = {
  hyuaran: "#10b981", // emerald (リーフ)
  centerrise: "#3b82f6", // blue
  linksupport: "#8b5cf6", // violet
  arata: "#f59e0b", // amber
  taiyou: "#ef4444", // red
  ichi: "#6366f1", // indigo
};

export default function ShiwakechouTopPage() {
  const [corps, setCorps] = useState<CorpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;

    async function load() {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: true, autoRefreshToken: true },
        });
        const { data, error } = await supabase
          .from("bud_corporations")
          .select("id, code, name_full, name_short, sort_order")
          .eq("is_active", true)
          .order("sort_order", { ascending: true });

        if (canceled) return;
        if (error) {
          setError(`法人マスタ取得失敗: ${error.message}`);
          setLoading(false);
          return;
        }
        setCorps((data ?? []) as CorpRow[]);
        setLoading(false);
      } catch (e) {
        if (!canceled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      canceled = true;
    };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>
        読み込み中...
      </div>
    );
  }
  if (error) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: "center",
          color: "#dc2626",
          fontWeight: 500,
        }}
      >
        エラー: {error}
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: "#1f2937",
            margin: 0,
          }}
        >
          仕訳帳
        </h1>
        <div
          style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}
        >
          法人を選択して銀行明細をアップロード / 仕訳化 / 弥生エクスポート
        </div>
      </div>

      <div style={{ marginBottom: 16, display: "flex", gap: 12 }}>
        <Link
          href="/forest/shiwakechou/balance-overview"
          style={{
            display: "inline-block",
            padding: "8px 16px",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            color: "#1f2937",
            fontSize: 13,
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          📊 残高オーバービュー (Q4)
        </Link>
      </div>

      {/* 6 法人カード */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
        }}
      >
        {corps.map((corp) => {
          const color = CORP_COLORS[corp.id] ?? "#6b7280";
          return (
            <Link
              key={corp.id}
              href={`/forest/shiwakechou/${corp.id}`}
              style={{
                display: "block",
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderLeft: `4px solid ${color}`,
                borderRadius: 8,
                padding: 20,
                textDecoration: "none",
                color: "#1f2937",
                transition: "transform 0.1s ease, box-shadow 0.1s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "#6b7280",
                  marginBottom: 4,
                }}
              >
                {corp.code}
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: "#1f2937",
                  marginBottom: 8,
                }}
              >
                {corp.name_short}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "#9ca3af",
                }}
              >
                {corp.name_full}
              </div>
              <div
                style={{
                  marginTop: 12,
                  fontSize: 11,
                  color: color,
                  fontWeight: 500,
                }}
              >
                銀行明細アップロード →
              </div>
            </Link>
          );
        })}
      </div>

      {/* footer info */}
      <div
        style={{
          marginTop: 24,
          fontSize: 11,
          color: "#9ca3af",
          lineHeight: 1.6,
        }}
      >
        B-min Phase 1 機能。共通マスタ管理 / 確認画面 / 弥生エクスポート完成は Phase 1 完走後。
        Phase 2 で CC / MF / 現金処理を統合予定。
      </div>
    </div>
  );
}

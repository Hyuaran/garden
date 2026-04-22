"use client";

/**
 * Garden-Tree 動画ポータル画面 (/tree/videos)
 *
 * プロトタイプの <VideoPortalScreen /> を移植。
 *
 * 構成:
 *  1. カテゴリフィルタ（すべて / 面接 / 入社後）
 *  2. セクション別動画カード（番号バッジ・再生領域・説明）
 *  3. 準備中プレースホルダー
 *
 * - 動画再生はデモ表示（実際はGoogleドライブ連携予定）
 * - サイドバー・KPIヘッダーは TreeShell が描画
 */

import { useState } from "react";

import { GlassPanel } from "../_components/GlassPanel";
import { WireframeLabel } from "../_components/WireframeLabel";
import { C } from "../_constants/colors";

/* ---------- 型定義 ---------- */

type VideoSection = "interview" | "onboarding";

type Video = {
  id: string;
  section: VideoSection;
  number: number;
  title: string;
  desc: string;
  duration: string;
  ready: boolean;
  fileId: string;
};

/* ---------- デモデータ ---------- */

const SECTIONS: { key: VideoSection; label: string; icon: string }[] = [
  { key: "interview", label: "面接", icon: "🎤" },
  { key: "onboarding", label: "入社後", icon: "📚" },
];

const VIDEOS: Video[] = [
  { id: "v1", section: "interview", number: 1, title: "会社概要・業務説明", desc: "Garden Groupの会社概要と、テレマーケティング業務の全体像を説明する動画です。", duration: "12:30", ready: true, fileId: "demo1" },
  { id: "v2", section: "interview", number: 2, title: "勤務条件・福利厚生", desc: "勤務時間、給与体系、交通費、福利厚生について詳しく解説します。", duration: "8:45", ready: true, fileId: "demo2" },
  { id: "v3", section: "onboarding", number: 1, title: "システム操作ガイド", desc: "Garden Treeの基本操作方法を、画面を見ながら一つずつ説明します。", duration: "15:00", ready: true, fileId: "demo3" },
  { id: "v4", section: "onboarding", number: 2, title: "トークスクリプト基礎", desc: "テレマーケティングの基本トークスクリプトと、よくある質問への対応方法です。", duration: "20:15", ready: true, fileId: "demo4" },
  { id: "v5", section: "onboarding", number: 3, title: "コンプライアンス研修", desc: "個人情報保護法、特定商取引法など、業務に関連する法令の基礎知識です。", duration: "---", ready: false, fileId: "" },
];

/* ---------- コンポーネント ---------- */

export default function VideoPortalPage() {
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [filter, setFilter] = useState<"すべて" | "面接" | "入社後">("すべて");

  const cats: ("すべて" | "面接" | "入社後")[] = ["すべて", "面接", "入社後"];
  const filtered = filter === "すべて" ? VIDEOS : VIDEOS.filter((v) => v.section === (filter === "面接" ? "interview" : "onboarding"));

  const sectionLabel = (s: VideoSection) => SECTIONS.find((sec) => sec.key === s)!;

  return (
    <div style={{ padding: "24px 40px 80px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ position: "relative", marginBottom: 20 }}>
        <WireframeLabel color="#8b5cf6">🎬 動画ポータル</WireframeLabel>
        <div style={{ paddingTop: 8 }} />
      </div>

      {/* フィルタ */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {cats.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            style={{
              padding: "8px 20px", borderRadius: 20, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, fontFamily: "'Noto Sans JP', sans-serif",
              background: filter === cat ? "#8b5cf6" : "rgba(0,0,0,0.04)",
              color: filter === cat ? C.white : C.textSub,
              transition: "all 0.2s",
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* セクション別表示 */}
      {SECTIONS.filter((sec) => filter === "すべて" || sec.label === filter).map((sec) => {
        const sectionVideos = filtered.filter((v) => v.section === sec.key);
        if (sectionVideos.length === 0) return null;
        return (
          <div key={sec.key} style={{ marginBottom: 32 }}>
            <div style={{
              padding: "10px 20px", borderRadius: 12, marginBottom: 16,
              background: "linear-gradient(135deg, #8b5cf6, #a78bfa)",
              color: C.white, fontSize: 14, fontWeight: 700,
            }}>
              {sec.icon} {sec.label}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
              {sectionVideos.map((v) => (
                <GlassPanel key={v.id} style={{ padding: 0, overflow: "hidden", opacity: v.ready ? 1 : 0.6 }}>
                  {/* 動画再生領域 */}
                  {v.ready ? (
                    <div
                      onClick={() => setActiveVideo(activeVideo === v.id ? null : v.id)}
                      style={{
                        position: "relative", paddingTop: "56.25%", cursor: "pointer",
                        background: activeVideo === v.id
                          ? "linear-gradient(135deg, #1a1a2e, #16213e)"
                          : "linear-gradient(135deg, #2c3e50, #3498db)",
                      }}
                    >
                      {activeVideo === v.id ? (
                        <div style={{
                          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: C.white, fontSize: 16, fontWeight: 600,
                        }}>
                          ▶ 動画再生中（デモ表示）
                        </div>
                      ) : (
                        <div style={{
                          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <div style={{
                            width: 60, height: 60, borderRadius: "50%",
                            background: "rgba(255,255,255,0.25)", backdropFilter: "blur(8px)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 24, color: C.white,
                          }}>▶</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{
                      paddingTop: "56.25%", position: "relative",
                      background: "linear-gradient(135deg, #ddd, #eee)",
                    }}>
                      <div style={{
                        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: C.textMuted, fontSize: 14,
                      }}>
                        現在準備中です
                      </div>
                    </div>
                  )}
                  {/* 情報 */}
                  <div style={{ padding: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: "#8b5cf6", color: C.white,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 800,
                      }}>{v.number}</div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.textDark }}>{v.title}</span>
                      <span style={{ fontSize: 10, color: C.textMuted, marginLeft: "auto", background: "rgba(0,0,0,0.04)", padding: "2px 8px", borderRadius: 8 }}>{v.duration}</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.6 }}>{v.desc}</div>
                    {v.ready && (
                      <div style={{ marginTop: 8, fontSize: 11, color: "#8b5cf6", cursor: "pointer", fontWeight: 600 }}>
                        Googleドライブで開く →
                      </div>
                    )}
                  </div>
                </GlassPanel>
              ))}
            </div>
          </div>
        );
      })}

      <div style={{ marginTop: 16, textAlign: "center", fontSize: 11, color: C.textMuted }}>
        最終更新: 2026/04/12 • 動画はGoogleドライブに保管 • 面接前・入社後の研修に活用
      </div>
    </div>
  );
}

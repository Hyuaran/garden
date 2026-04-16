"use client";

/**
 * Garden-Tree ダッシュボード画面 (/tree/dashboard)
 *
 * プロトタイプの <DashboardScreen /> を移植。
 *
 * 構成:
 *  1. 挨拶パネル（ユーザー名 + 月間目標までの残P）
 *  2. Chatwork クイックアクセス（権限別メッセージ + 内部情報画面 + 外部Chatworkを開くリンク）
 *  3. F2: 積み上げ式月間ロードマップ（週ごとスタックバー + 4週カード）
 *  4. アドバイスパネル（データFB + 責任者ワンポイント）
 *  5. 管理者メモ（MANAGER 限定）
 *
 * - サイドバー・KPIヘッダーは TreeShell が描画するため、本ページは中身のみ。
 * - 権限 (role) は useTreeState() 経由で取得。
 * - Chatwork 内部ログイン情報画面 (/tree/chatwork) は後続タスクで実装。
 */

import { useRouter } from "next/navigation";

import { GlassPanel } from "../_components/GlassPanel";
import { PointValue } from "../_components/PointValue";
import { WireframeLabel } from "../_components/WireframeLabel";
import { C } from "../_constants/colors";
import { ROLES } from "../_constants/roles";
import { TREE_PATHS } from "../_constants/screens";
import { USER } from "../_constants/user";
import { P } from "../_lib/format";
import { useTreeState } from "../_state/TreeStateContext";

export default function TreeDashboardPage() {
  const router = useRouter();
  const { role } = useTreeState();

  // 月間目標/達成/営業日進捗（プロトタイプと同じデモ値）
  const mt = 60; // 月間目標 (P)
  const md = 42; // 現時点達成 (P)
  const di = 22; // 月間営業日
  const dp = 15; // 経過営業日
  const ip = Math.round((mt * dp) / di); // 理想ペース
  const pg = md - ip; // 理想ペース差

  const dataAdvice =
    pg >= 0
      ? `現在 ${P(md)} で理想ペース（${P(ip)}）を ${P(pg)} 上回っています。この調子で第4週も安定したペースを維持しましょう。`
      : `現在 ${P(md)} で理想ペース（${P(ip)}）を ${P(Math.abs(pg))} 下回っています。残り${di - dp}営業日で${P(mt - md)}必要です。1日あたり${P(Math.ceil((mt - md) / (di - dp)))}を目標にしましょう。`;

  // 週別の達成状況（デモ値）
  const weeks = [
    { week: "第1週", done: 12, target: 15 },
    { week: "第2週", done: 14, target: 15 },
    { week: "第3週", done: 16, target: 15 },
    { week: "第4週", done: 0, target: 15 },
  ];
  const gColors = ["#1b4332", "#2d6a4f", "#40916c", "#74c69d"];

  // 累積計算
  let cumSum = 0;
  const stacks = weeks.map((w) => {
    const prev = cumSum;
    cumSum += w.done;
    return { ...w, prev, cum: cumSum };
  });
  const totalDone = cumSum;
  const pct = Math.round((totalDone / mt) * 100);
  const activeIdx = stacks.filter((x) => x.done > 0).length - 1;

  const chatworkCaption =
    role === ROLES.SPROUT
      ? "トス共有アカウント"
      : role === ROLES.BRANCH
        ? "クローザー共有アカウント"
        : "個人アカウント";

  return (
    <div
      style={{
        padding: "24px 40px 80px",
        maxWidth: 1100,
        margin: "0 auto",
        width: "100%",
      }}
    >
      <div style={{ position: "relative", marginBottom: 20 }}>
        <WireframeLabel>画面2: ダッシュボード</WireframeLabel>
        <div style={{ paddingTop: 8 }} />
      </div>

      {/* 1. 挨拶パネル */}
      <GlassPanel style={{ marginBottom: 24, padding: 28 }}>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: C.darkGreen,
            margin: 0,
          }}
        >
          {USER.name}さん、おはようございます!
        </h2>
        <p
          style={{
            fontSize: 14,
            color: C.textSub,
            margin: "8px 0 0",
          }}
        >
          本日も頑張りましょう。月間目標まで{" "}
          <strong style={{ color: C.textDark, fontSize: 18 }}>
            あと<PointValue n={mt - md} size={18} />
          </strong>{" "}
          です。
        </p>
      </GlassPanel>

      {/* 2. Chatwork クイックアクセス */}
      <GlassPanel style={{ padding: 16, marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }} role="img" aria-label="chat">
              💬
            </span>
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: C.darkGreen,
                }}
              >
                Chatwork
              </div>
              <div style={{ fontSize: 11, color: C.textMuted }}>
                {chatworkCaption}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => router.push(TREE_PATHS.CHATWORK)}
              style={{
                padding: "8px 16px",
                border: `1px solid ${C.midGreen}33`,
                borderRadius: 10,
                background: C.white,
                color: C.midGreen,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "'Noto Sans JP', sans-serif",
              }}
            >
              ログイン情報を見る
            </button>
            <a
              href="https://www.chatwork.com/login.php"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: "8px 16px",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg, #e3382e, #c4302b)",
                color: C.white,
                fontSize: 12,
                fontWeight: 700,
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              Chatworkを開く →
            </a>
          </div>
        </div>
      </GlassPanel>

      {/* 3. F2: 積み上げ式月間ロードマップ */}
      <GlassPanel style={{ marginBottom: 24, padding: 28 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: C.darkGreen,
            }}
          >
            月間ロードマップ
          </div>
          <div style={{ fontSize: 12, color: C.textMuted }}>
            2026年4月（{dp}/{di}営業日経過）
          </div>
        </div>

        {/* 3-a. 中央サマリ */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div
            style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}
          >
            ここまでの積み上げ
          </div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 800,
              color: C.darkGreen,
              lineHeight: 1,
            }}
          >
            <PointValue n={totalDone} size={36} />
          </div>
          <div
            style={{
              fontSize: 13,
              color: C.textSub,
              marginTop: 6,
            }}
          >
            目標 <PointValue n={mt} size={13} /> の{" "}
            <strong style={{ color: pct >= 70 ? C.midGreen : C.gold }}>
              {pct}%
            </strong>{" "}
            達成
            {pct >= 70 && (
              <span style={{ marginLeft: 6, fontSize: 11 }}>
                素晴らしい積み上げです!
              </span>
            )}
          </div>
        </div>

        {/* 3-b. 水平スタックバー */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              height: 32,
              borderRadius: 16,
              overflow: "hidden",
              background: "#e8f5e9",
              display: "flex",
              position: "relative",
            }}
          >
            {stacks
              .filter((s) => s.done > 0)
              .map((s, i) => (
                <div
                  key={`stack-${i}`}
                  style={{
                    width: `${(s.done / mt) * 100}%`,
                    height: "100%",
                    background: `linear-gradient(135deg, ${gColors[i]}, ${gColors[Math.min(i + 1, 3)]})`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "width 0.8s ease",
                  }}
                >
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: "#fff",
                      whiteSpace: "nowrap",
                      textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                    }}
                  >
                    {s.done >= 5 ? `W${i + 1} ${P(s.done)}` : ""}
                  </span>
                </div>
              ))}
            {/* 理想ペース目印 */}
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `${(dp / di) * 100}%`,
                width: 2,
                background: C.gold,
                zIndex: 2,
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 4,
            }}
          >
            <span style={{ fontSize: 10, color: "#aaa" }}>{P(0)}</span>
            <span
              style={{
                fontSize: 10,
                color: C.gold,
                fontWeight: 600,
              }}
            >
              ↑ 理想ペース ({P(ip)})
            </span>
            <span style={{ fontSize: 10, color: "#aaa" }}>{P(mt)}</span>
          </div>
        </div>

        {/* 3-c. 週別カード（4列グリッド） */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 10,
          }}
        >
          {stacks.map((s, i) => {
            const isActive = s.done > 0 && i === activeIdx;
            const isDone = s.done >= s.target;
            const isFuture = s.done === 0;
            return (
              <div
                key={`week-${i}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                }}
              >
                <div
                  style={{
                    padding: "14px 12px",
                    borderRadius: 12,
                    textAlign: "center",
                    position: "relative",
                    overflow: "hidden",
                    background: isFuture ? "#f8f8f6" : C.white,
                    border: `1px solid ${
                      isActive
                        ? "rgba(201,168,76,0.3)"
                        : isDone
                          ? "rgba(45,106,79,0.12)"
                          : "rgba(0,0,0,0.04)"
                    }`,
                    boxShadow: isActive
                      ? "0 2px 8px rgba(201,168,76,0.1)"
                      : "none",
                  }}
                >
                  {!isFuture && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: `${Math.min(100, (s.cum / mt) * 100)}%`,
                        background: `linear-gradient(180deg, ${gColors[i]}18 0%, ${gColors[i]}08 100%)`,
                        transition: "height 0.8s ease",
                      }}
                    />
                  )}
                  <div style={{ position: "relative", zIndex: 1 }}>
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: isFuture ? "#ddd" : gColors[i],
                        margin: "0 auto 6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          color: "#fff",
                        }}
                      >
                        {i + 1}
                      </span>
                    </div>
                    <div style={{ fontSize: 9, color: C.textMuted }}>
                      この週
                    </div>
                    <div
                      style={{
                        fontSize: 17,
                        fontWeight: 800,
                        color: isFuture ? "#ccc" : gColors[i],
                        marginBottom: 2,
                      }}
                    >
                      <PointValue n={s.done} size={17} />
                    </div>
                    <div style={{ fontSize: 9, color: C.textMuted }}>
                      累計
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: isFuture ? "#ccc" : C.textDark,
                      }}
                    >
                      <PointValue n={s.cum} size={13} />
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        marginTop: 6,
                        fontWeight: 600,
                        color: isDone
                          ? C.lightGreen
                          : isActive
                            ? C.gold
                            : "#bbb",
                      }}
                    >
                      {isDone
                        ? "達成"
                        : isActive
                          ? "進行中"
                          : isFuture
                            ? "—"
                            : ""}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    textAlign: "center",
                    fontSize: 10,
                    fontWeight: 600,
                    color: C.textMuted,
                    marginTop: 6,
                  }}
                >
                  {s.week}
                </div>
              </div>
            );
          })}
        </div>
      </GlassPanel>

      {/* 4. アドバイスパネル (2カラム) */}
      <GlassPanel style={{ marginBottom: 24, padding: 24 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
          }}
        >
          <div
            style={{
              padding: 16,
              borderRadius: 14,
              background: "rgba(52,120,198,0.04)",
              border: "1px solid rgba(52,120,198,0.12)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "rgba(52,120,198,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                }}
              >
                📊
              </div>
              <span
                style={{ fontSize: 12, fontWeight: 700, color: "#3478c6" }}
              >
                フィードバック
              </span>
            </div>
            <div
              style={{ fontSize: 13, color: C.textDark, lineHeight: 1.8 }}
            >
              {dataAdvice}
            </div>
          </div>
          <div
            style={{
              padding: 16,
              borderRadius: 14,
              background: "rgba(196,74,74,0.03)",
              border: "1px solid rgba(196,74,74,0.1)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "rgba(196,74,74,0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                }}
              >
                👤
              </div>
              <span
                style={{ fontSize: 12, fontWeight: 700, color: "#c44a4a" }}
              >
                責任者からのワンポイントアドバイス
              </span>
            </div>
            <div
              style={{ fontSize: 13, color: C.textDark, lineHeight: 1.8 }}
            >
              第3週の追い込み、素晴らしいペースです。クロージングのタイミングをもう一歩早めると成約率がさらに上がるはずです。
            </div>
            <div
              style={{
                fontSize: 10,
                color: "#bbb",
                marginTop: 8,
                textAlign: "right",
              }}
            >
              — 山本 責任者 / 4月11日更新
            </div>
          </div>
        </div>
      </GlassPanel>

      {/* 5. 管理者メモ（MANAGER 限定） */}
      {role === ROLES.MANAGER && (
        <div
          style={{
            marginTop: 24,
            padding: "16px 20px",
            background: "rgba(201,168,76,0.06)",
            borderRadius: 14,
            border: "1px solid rgba(201,168,76,0.15)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: C.gold,
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            📋 管理者メモ
          </div>
          <div style={{ fontSize: 13, color: C.textSub }}>
            担当者Aの有効率が基準を下回っています。フォローを検討してください。
          </div>
        </div>
      )}
    </div>
  );
}

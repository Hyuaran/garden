"use client";

/**
 * Garden-Tree 見込み一覧
 *
 * プロトタイプの ProspectList を TypeScript 化。
 * 架電画面右側に表示する見込み（Prospect）リスト。
 *
 * - ログインユーザーの見込みのみ表示
 * - 当日 / 明日以降 / 日付指定 のフィルタ
 * - mode="sprout" のとき見込A件数を強調、mode="branch" のときコイン件数を強調
 */

import { useState } from "react";

import { C } from "../_constants/colors";
import { USER } from "../_constants/user";

type Prospect = {
  id: string;
  rank: string;
  customer: string;
  phone: string;
  date: string;
  time: string;
  memo: string;
  closer: string;
  owner: string;
};

type ProspectListProps = {
  mode?: "sprout" | "branch";
};

const RANK_COLOR: Record<string, string> = {
  A: "#3478c6",
  B: "#5a9ac6",
  C: "#7ab0d4",
  コイン: C.gold,
};

const FILTER_COLORS: Record<string, string> = {
  全て: C.darkGreen,
  当日: "#e67e22",
  明日以降: "#3478c6",
  日付: "#8a5ac6",
};
const FILTERS = ["全て", "当日", "明日以降", "日付"] as const;

const TODAY = "2026-04-13"; // デモ用固定日付

/** デモ用見込みデータ */
const ALL_PROSPECTS: Prospect[] = [
  { id: "p1", rank: "A", customer: "中島 真由美", phone: "03-1111-0001", date: "2026-04-13", time: "14:00", memo: "夫と相談中、週明け再架電", closer: "小泉 翔", owner: "東海林 美琴" },
  { id: "p2", rank: "A", customer: "大久保 誠", phone: "06-2222-0002", date: "2026-04-13", time: "15:30", memo: "料金比較資料を送付済み", closer: "石原 孝志朗", owner: "東海林 美琴" },
  { id: "p3", rank: "B", customer: "上田 隆", phone: "03-3333-0003", date: "2026-04-13", time: "16:00", memo: "光回線に興味あり", closer: "", owner: "東海林 美琴" },
  { id: "p4", rank: "B", customer: "永井 さくら", phone: "045-444-0004", date: "2026-04-14", time: "10:00", memo: "現在他社、乗り換え検討", closer: "", owner: "東海林 美琴" },
  { id: "p5", rank: "A", customer: "西田 美穂", phone: "03-7777-0007", date: "2026-04-15", time: "13:00", memo: "前向き検討中、15日再架電約束", closer: "萩尾 拓也", owner: "東海林 美琴" },
  { id: "p6", rank: "コイン", customer: "村上 洋介", phone: "03-9999-0009", date: "2026-04-13", time: "17:00", memo: "契約意思あり、夕方再架電", closer: "小泉 翔", owner: "東海林 美琴" },
  { id: "p7", rank: "C", customer: "原田 健太", phone: "06-5555-0005", date: "2026-04-12", time: "11:00", memo: "時間がないと言われた", closer: "", owner: "東海林 美琴" },
  { id: "p8", rank: "C", customer: "福田 まどか", phone: "03-6666-0006", date: "2026-04-11", time: "14:30", memo: "マンション確認中", closer: "", owner: "東海林 美琴" },
  { id: "p9", rank: "B", customer: "松井 隼人", phone: "06-8888-0008", date: "2026-04-16", time: "09:00", memo: "家族と相談予定", closer: "", owner: "東海林 美琴" },
  { id: "p10", rank: "A", customer: "他のアカウントの案件", phone: "03-0000-0000", date: "2026-04-13", time: "10:00", memo: "他担当者の見込み", closer: "", owner: "小泉 翔" },
].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

function fmtDate(d: string): string {
  const parts = d.split("-");
  return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
}

export function ProspectList({ mode = "sprout" }: ProspectListProps) {
  const myName = USER.fullName;
  const prospects = ALL_PROSPECTS.filter((p) => p.owner === myName);

  const [filter, setFilter] = useState("当日");
  const [dateFilter, setDateFilter] = useState("");

  const filtered = prospects.filter((p) => {
    if (filter === "当日") return p.date === TODAY;
    if (filter === "明日以降") return p.date > TODAY;
    if (filter === "日付" && dateFilter) return p.date === dateFilter;
    return true;
  });

  const rankACount = filtered.filter((p) => p.rank === "A").length;
  const coinCount = filtered.filter((p) => p.rank === "コイン").length;
  const highlightCount = mode === "sprout" ? rankACount : coinCount;
  const highlightLabel = mode === "sprout" ? "内見込A" : "内コイン";
  const highlightColor = mode === "sprout" ? "#3478c6" : C.gold;

  return (
    <div style={{ fontSize: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div
          style={{ fontSize: 13, fontWeight: 700, color: C.darkGreen }}
        >
          見込み一覧
        </div>
        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: 10, color: C.textMuted }}>
            {filtered.length}
            <span style={{ fontSize: 8 }}>件</span>
          </span>
          {highlightCount > 0 && (
            <span
              style={{
                fontSize: 9,
                color: highlightColor,
                marginLeft: 4,
              }}
            >
              （{highlightLabel} {highlightCount}
              <span style={{ fontSize: 7 }}>件</span>）
            </span>
          )}
        </div>
      </div>

      {/* フィルタボタン */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 6,
          flexWrap: "wrap",
        }}
      >
        {FILTERS.map((f) => (
          <span
            key={f}
            onClick={() => {
              setFilter(f);
              if (f !== "日付") setDateFilter("");
            }}
            style={{
              padding: "3px 8px",
              borderRadius: 6,
              fontSize: 9,
              fontWeight: 700,
              background:
                filter === f
                  ? FILTER_COLORS[f]
                  : "rgba(0,0,0,0.04)",
              color: filter === f ? "#fff" : C.textMuted,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {f}
          </span>
        ))}
      </div>

      {/* 日付ピッカー */}
      {filter === "日付" && (
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          style={{
            width: "100%",
            padding: "5px 8px",
            border: "1px solid #dcedc8",
            borderRadius: 6,
            fontSize: 11,
            fontFamily: "'Noto Sans JP', sans-serif",
            background: C.white,
            marginBottom: 8,
            boxSizing: "border-box",
          }}
        />
      )}

      {/* リスト */}
      {filtered.length === 0 ? (
        <div
          style={{
            padding: "20px 0",
            textAlign: "center",
            fontSize: 11,
            color: C.textMuted,
          }}
        >
          該当する見込みはありません
        </div>
      ) : (
        filtered.map((p) => (
          <div
            key={p.id}
            style={{
              padding: "8px 10px",
              marginBottom: 4,
              borderRadius: 8,
              background: "rgba(0,0,0,0.02)",
              borderLeft: `3px solid ${RANK_COLOR[p.rank] ?? "#999"}`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 2,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    padding: "1px 6px",
                    borderRadius: 4,
                    fontWeight: 800,
                    background: `${RANK_COLOR[p.rank] ?? "#999"}15`,
                    color: RANK_COLOR[p.rank] ?? "#999",
                  }}
                >
                  {p.rank}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: C.textDark,
                  }}
                >
                  {p.customer}
                </span>
              </div>
              <span
                style={{
                  fontSize: 9,
                  color:
                    p.date === TODAY ? "#e67e22" : C.textMuted,
                  fontWeight: p.date === TODAY ? 700 : 400,
                }}
              >
                {fmtDate(p.date)} {p.time}
              </span>
            </div>
            <div
              style={{
                fontSize: 10,
                color: C.textMuted,
                marginBottom: 2,
              }}
            >
              📞 {p.phone}
            </div>
            <div
              style={{
                fontSize: 10,
                color: C.textSub,
                lineHeight: 1.4,
              }}
            >
              {p.memo}
            </div>
            {p.closer && (
              <div
                style={{
                  fontSize: 9,
                  color: C.midGreen,
                  marginTop: 2,
                }}
              >
                担当: {p.closer}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

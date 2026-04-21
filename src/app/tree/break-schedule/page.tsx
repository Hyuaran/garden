"use client";

/**
 * Garden-Tree 休憩スケジュール管理画面 (/tree/break-schedule)
 *
 * プロトタイプの <BreakScheduleScreen /> を移植。
 *
 * 構成:
 *  1. スケジュール追加/編集フォーム
 *  2. スケジュール一覧テーブル（編集・削除・デモポップアップ）
 *
 * - MANAGER専用画面
 * - 昼休憩/小休憩/イレギュラーの3タイプ
 * - 対象: トス/クローザー/責任者/事務
 * - サイドバー・KPIヘッダーは TreeShell が描画
 */

import { useState } from "react";

import { ActionButton } from "../_components/ActionButton";
import { GlassPanel } from "../_components/GlassPanel";
import { WireframeLabel } from "../_components/WireframeLabel";
import { C } from "../_constants/colors";

/* ---------- 型定義 ---------- */

type BreakType = "lunch" | "short" | "irregular";
type TargetRole = "sprout" | "branch" | "manager" | "backyard";

type BreakSchedule = {
  id: number;
  startTime: string;
  endTime: string;
  type: BreakType;
  label: string;
  message: string;
  targets: TargetRole[];
};

/* ---------- 定数 ---------- */

const ALL_TARGETS: TargetRole[] = ["sprout", "branch", "manager", "backyard"];
const TARGET_LABELS: Record<TargetRole, string> = { sprout: "トス", branch: "クローザー", manager: "責任者", backyard: "事務" };
const TYPE_LABELS: Record<BreakType, string> = { lunch: "昼休憩", short: "小休憩", irregular: "イレギュラー" };

/* ---------- デモデータ ---------- */

const INITIAL_SCHEDULES: BreakSchedule[] = [
  { id: 1, startTime: "12:00", endTime: "13:00", type: "lunch", label: "昼休憩（第1グループ）", message: "昼休憩の時間です。1時間後に業務再開してください。", targets: ["sprout", "branch"] },
  { id: 2, startTime: "13:00", endTime: "14:00", type: "lunch", label: "昼休憩（第2グループ）", message: "昼休憩の時間です。1時間後に業務再開してください。", targets: ["manager", "backyard"] },
  { id: 3, startTime: "15:00", endTime: "15:10", type: "short", label: "午後小休憩", message: "10分間の小休憩です。", targets: ["sprout", "branch", "manager", "backyard"] },
];

/* ---------- コンポーネント ---------- */

export default function BreakSchedulePage() {
  const [schedules, setSchedules] = useState<BreakSchedule[]>(INITIAL_SCHEDULES);
  const [editId, setEditId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [form, setForm] = useState({
    startTime: "12:00",
    endTime: "13:00",
    type: "lunch" as BreakType,
    label: "",
    message: "",
    targets: [...ALL_TARGETS] as TargetRole[],
  });

  const toggleTarget = (t: TargetRole) => {
    setForm((prev) => ({
      ...prev,
      targets: prev.targets.includes(t) ? prev.targets.filter((x) => x !== t) : [...prev.targets, t],
    }));
  };

  const handleAdd = () => {
    const newSchedule: BreakSchedule = { id: Date.now(), ...form };
    setSchedules((prev) => [...prev, newSchedule].sort((a, b) => a.startTime.localeCompare(b.startTime)));
    setForm({ startTime: "12:00", endTime: "13:00", type: "lunch", label: "", message: "", targets: [...ALL_TARGETS] });
  };

  const handleUpdate = () => {
    if (editId === null) return;
    setSchedules((prev) =>
      prev.map((s) => (s.id === editId ? { ...s, ...form } : s)).sort((a, b) => a.startTime.localeCompare(b.startTime))
    );
    setEditId(null);
    setForm({ startTime: "12:00", endTime: "13:00", type: "lunch", label: "", message: "", targets: [...ALL_TARGETS] });
  };

  const handleEdit = (s: BreakSchedule) => {
    setEditId(s.id);
    setForm({ startTime: s.startTime, endTime: s.endTime, type: s.type, label: s.label, message: s.message, targets: [...s.targets] });
  };

  const handleDelete = (id: number) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
    setDeleteConfirmId(null);
  };

  const inputSt: React.CSSProperties = {
    padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)",
    fontSize: 13, fontFamily: "'Noto Sans JP', sans-serif", outline: "none",
  };

  return (
    <div style={{ padding: "24px 40px 80px", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ position: "relative", marginBottom: 20 }}>
        <WireframeLabel color="#e67e22">⏰ 休憩スケジュール管理</WireframeLabel>
        <div style={{ paddingTop: 8 }} />
      </div>

      {/* フォーム */}
      <GlassPanel style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.textDark, marginBottom: 12 }}>
          {editId ? "スケジュール編集" : "スケジュール追加"}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "120px 120px 140px 1fr", gap: 12, marginBottom: 12, alignItems: "end" }}>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>開始時間</div>
            <input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} style={{ ...inputSt, width: "100%" }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>終了時間</div>
            <input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} style={{ ...inputSt, width: "100%" }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>種類</div>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as BreakType }))} style={{ ...inputSt, width: "100%", cursor: "pointer" }}>
              {(Object.entries(TYPE_LABELS) as [BreakType, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>ラベル</div>
            <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="例: 昼休憩（第1グループ）" style={{ ...inputSt, width: "100%" }} />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>対象</div>
          <div style={{ display: "flex", gap: 8 }}>
            {ALL_TARGETS.map((t) => (
              <button
                key={t}
                onClick={() => toggleTarget(t)}
                style={{
                  padding: "4px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                  fontSize: 11, fontWeight: 600, fontFamily: "'Noto Sans JP', sans-serif",
                  background: form.targets.includes(t) ? C.midGreen : "rgba(0,0,0,0.04)",
                  color: form.targets.includes(t) ? C.white : C.textSub,
                }}
              >
                {TARGET_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>ポップアップメッセージ</div>
          <input value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder="休憩開始時に表示するメッセージ" style={{ ...inputSt, width: "100%" }} />
        </div>
        <ActionButton
          label={editId ? "更新する" : "追加する"}
          color={editId ? "#3478c6" : C.midGreen}
          onClick={editId ? handleUpdate : handleAdd}
        />
      </GlassPanel>

      {/* スケジュール一覧 */}
      <GlassPanel style={{ padding: 0, overflow: "hidden" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "80px 80px 100px 1fr 160px 120px",
          padding: "12px 16px", background: "linear-gradient(135deg, #e67e22, #f39c12)",
          color: C.white, fontSize: 11, fontWeight: 700, gap: 8,
        }}>
          <div>開始</div><div>終了</div><div>種類</div><div>ラベル</div><div>対象</div><div>操作</div>
        </div>
        {schedules.map((s) => (
          <div key={s.id} style={{
            display: "grid", gridTemplateColumns: "80px 80px 100px 1fr 160px 120px",
            padding: "12px 16px", gap: 8, alignItems: "center",
            borderBottom: "1px solid rgba(0,0,0,0.04)", fontSize: 13, color: C.textDark,
          }}>
            <div style={{ fontWeight: 600 }}>{s.startTime}</div>
            <div style={{ fontWeight: 600 }}>{s.endTime}</div>
            <div><span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "rgba(230,126,34,0.1)", color: "#e67e22", fontWeight: 600 }}>{TYPE_LABELS[s.type]}</span></div>
            <div style={{ fontSize: 12 }}>{s.label}</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {s.targets.map((t) => (
                <span key={t} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "rgba(45,106,79,0.08)", color: C.midGreen }}>{TARGET_LABELS[t]}</span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, position: "relative" }}>
              <button onClick={() => handleEdit(s)} style={{ fontSize: 11, color: "#3478c6", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "'Noto Sans JP', sans-serif" }}>編集</button>
              {deleteConfirmId === s.id ? (
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => handleDelete(s.id)} style={{ fontSize: 11, color: C.white, background: C.red, border: "none", borderRadius: 4, cursor: "pointer", padding: "2px 6px", fontFamily: "'Noto Sans JP', sans-serif" }}>削除</button>
                  <button onClick={() => setDeleteConfirmId(null)} style={{ fontSize: 11, color: C.textMuted, background: "rgba(0,0,0,0.04)", border: "none", borderRadius: 4, cursor: "pointer", padding: "2px 6px", fontFamily: "'Noto Sans JP', sans-serif" }}>取消</button>
                </div>
              ) : (
                <button onClick={() => setDeleteConfirmId(s.id)} style={{ fontSize: 11, color: C.red, background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontFamily: "'Noto Sans JP', sans-serif" }}>削除</button>
              )}
            </div>
          </div>
        ))}
      </GlassPanel>

      <div style={{ marginTop: 16, textAlign: "center", fontSize: 11, color: C.textMuted }}>
        責任者専用 • 休憩スケジュールは対象メンバーにポップアップ通知 • グループ分けで時差休憩に対応
      </div>
    </div>
  );
}

"use client";

/**
 * Garden-Tree フォローコール一覧画面 (/tree/follow-call)
 *
 * プロトタイプの <FollowCallScreen /> を移植。
 *
 * 構成:
 *  1. サマリーカード（全件数 / 時間指定あり / 待機中 / 完了）
 *  2. 時間指定ありセクション（テーブル形式）
 *  3. 時間指定なしセクション（カード形式）
 *
 * - ステートレス画面（デモデータ表示のみ）
 * - サイドバー・KPIヘッダーは TreeShell が描画
 */

import { useRouter } from "next/navigation";

import { GlassPanel } from "../_components/GlassPanel";
import { WireframeLabel } from "../_components/WireframeLabel";
import { C } from "../_constants/colors";
import { TREE_PATHS } from "../_constants/screens";

/* ---------- 型定義 ---------- */

type FollowCallItem = {
  id: string;
  customer: string;
  phone: string;
  closer: string;
  scheduledTime: string | null;
  atoOkDate: string;
  product: string;
  channel: string;
  openDate: string;
  status: string;
  statusColor: string;
};

/* ---------- デモデータ ---------- */

const DEMO_FOLLOW_CALLS: FollowCallItem[] = [
  { id: "f1", customer: "田中工業 様", phone: "06-1234-5678", closer: "萩尾 拓也", scheduledTime: "14:00", atoOkDate: "4/14", product: "電力プランA", channel: "WEB", openDate: "4/20", status: "待機中", statusColor: "#3478c6" },
  { id: "f2", customer: "鈴木商事 様", phone: "078-9876-5432", closer: "小泉 翔", scheduledTime: "15:30", atoOkDate: "4/14", product: "ガスプランB", channel: "TEL", openDate: "4/22", status: "待機中", statusColor: "#3478c6" },
  { id: "f3", customer: "佐藤建設 様", phone: "06-1111-2222", closer: "萩尾 拓也", scheduledTime: "16:00", atoOkDate: "4/13", product: "電力プランA", channel: "WEB", openDate: "4/18", status: "完了", statusColor: C.midGreen },
  { id: "f4", customer: "中村電機 様", phone: "06-3333-4444", closer: "石原 孝志朗", scheduledTime: null, atoOkDate: "4/14", product: "電力プランC", channel: "WEB", openDate: "4/25", status: "待機中", statusColor: "#3478c6" },
  { id: "f5", customer: "山本商店 様", phone: "078-5555-6666", closer: "小泉 翔", scheduledTime: null, atoOkDate: "4/12", product: "ガスプランB", channel: "TEL", openDate: "4/19", status: "待機中", statusColor: "#3478c6" },
];

/* ---------- コンポーネント ---------- */

export default function FollowCallPage() {
  const router = useRouter();
  const scheduled = DEMO_FOLLOW_CALLS.filter((f) => f.scheduledTime).sort((a, b) => (a.scheduledTime! > b.scheduledTime! ? 1 : -1));
  const unscheduled = DEMO_FOLLOW_CALLS.filter((f) => !f.scheduledTime);

  /**
   * フォロー対象の顧客情報をクエリパラメータに載せて /tree/call に遷移。
   * 遷移先では mode=follow を検知して call_mode="follow" で soil_call_history に保存する。
   */
  const handleFollowClick = (f: FollowCallItem) => {
    const params = new URLSearchParams({
      mode: "follow",
      customer: f.customer.replace(/\s*様$/, ""),
      phone: f.phone,
    });
    router.push(`${TREE_PATHS.IN_CALL}?${params.toString()}`);
  };

  const totalCount = DEMO_FOLLOW_CALLS.length;
  const scheduledCount = scheduled.length;
  const waitCount = DEMO_FOLLOW_CALLS.filter((f) => f.status === "待機中").length;
  const doneCount = DEMO_FOLLOW_CALLS.filter((f) => f.status === "完了").length;

  return (
    <div style={{ padding: "24px 40px 80px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ position: "relative", marginBottom: 20 }}>
        <WireframeLabel color="#10b981">📞 フォローコール一覧</WireframeLabel>
        <div style={{ paddingTop: 8 }} />
      </div>

      {/* サマリーカード */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "全件数", val: totalCount, unit: "件", color: C.textDark },
          { label: "時間指定あり", val: scheduledCount, unit: "件", color: "#3478c6" },
          { label: "待機中", val: waitCount, unit: "件", color: "#e67e22" },
          { label: "完了", val: doneCount, unit: "件", color: C.midGreen },
        ].map((s) => (
          <GlassPanel key={s.label} style={{ padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.val}<span style={{ fontSize: 14, fontWeight: 600 }}>{s.unit}</span></div>
          </GlassPanel>
        ))}
      </div>

      {/* 時間指定ありセクション */}
      <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 700, color: C.textDark }}>時間指定あり（{scheduledCount}件）</div>
      <GlassPanel style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}>
        <div style={{
          display: "grid", gridTemplateColumns: "70px 1fr 120px 100px 80px 90px 80px 80px 80px",
          padding: "12px 16px", background: "linear-gradient(135deg, #10b981, #34d399)",
          color: C.white, fontSize: 11, fontWeight: 700, gap: 8,
        }}>
          <div>指定時間</div><div>顧客名</div><div>電話番号</div><div>クローザー</div>
          <div>後確OK日</div><div>商材</div><div>チャネル</div><div>開通予定</div><div>ステータス</div>
        </div>
        {scheduled.map((f) => (
          <div
            key={f.id}
            onClick={() => handleFollowClick(f)}
            style={{
              display: "grid", gridTemplateColumns: "70px 1fr 120px 100px 80px 90px 80px 80px 80px",
              padding: "12px 16px", gap: 8, alignItems: "center", cursor: "pointer",
              opacity: f.status === "完了" ? 0.5 : 1,
              borderBottom: "1px solid rgba(0,0,0,0.04)", fontSize: 13, color: C.textDark,
            }}
          >
            <div style={{ fontWeight: 700, color: "#3478c6" }}>{f.scheduledTime}</div>
            <div style={{ fontWeight: 600 }}>{f.customer}</div>
            <div style={{ fontSize: 12, color: C.textSub }}>{f.phone}</div>
            <div style={{ fontSize: 12 }}>{f.closer}</div>
            <div style={{ fontSize: 12, color: C.textSub }}>{f.atoOkDate}</div>
            <div style={{ fontSize: 11 }}>{f.product}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{f.channel}</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{f.openDate}</div>
            <div><span style={{ fontSize: 11, fontWeight: 600, color: f.statusColor, background: `${f.statusColor}15`, padding: "2px 8px", borderRadius: 8 }}>{f.status}</span></div>
          </div>
        ))}
      </GlassPanel>

      {/* 時間指定なしセクション */}
      <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 700, color: C.textDark }}>時間指定なし（{unscheduled.length}件）</div>
      {unscheduled.map((f) => (
        <GlassPanel
          key={f.id}
          onClick={() => handleFollowClick(f)}
          style={{ padding: 16, marginBottom: 12, cursor: "pointer", borderLeft: `4px solid ${C.midGreen}` }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.textDark }}>{f.customer}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: f.statusColor, background: `${f.statusColor}15`, padding: "2px 8px", borderRadius: 8 }}>{f.status}</span>
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 12, color: C.textSub }}>
            <span>{f.phone}</span>
            <span>クローザー: {f.closer}</span>
            <span>商材: {f.product}</span>
            <span>チャネル: {f.channel}</span>
            <span>開通予定: {f.openDate}</span>
          </div>
        </GlassPanel>
      ))}

      <div style={{ marginTop: 16, textAlign: "center", fontSize: 11, color: C.textMuted }}>
        後確OK後のフォローコール一覧 • 時間指定ありは優先表示 • データはGarden Treeから自動取得
      </div>
    </div>
  );
}

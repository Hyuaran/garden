"use client";

/**
 * Garden-Tree マイページ画面 (/tree/mypage)
 *
 * プロトタイプの <MyPageScreen /> を移植。
 *
 * 構成:
 *  1. パスワードゲート（4桁認証）
 *  2. 基本情報 / 登録情報
 *  3. 6ヶ月パフォーマンスチャート
 *  4. パスワード変更フォーム
 *  5. 通知音設定
 *  6. 届出セクション（電子契約リクエスト）
 *
 * - 認証前はパスワード入力画面のみ表示
 * - サイドバー・KPIヘッダーは TreeShell が描画
 */

import { useRef, useState } from "react";

import { ActionButton } from "../_components/ActionButton";
import { GlassPanel } from "../_components/GlassPanel";
import { WireframeLabel } from "../_components/WireframeLabel";
import { C } from "../_constants/colors";
import { useTreeState } from "../_state/TreeStateContext";
import { GARDEN_ROLE_LABELS } from "../../root/_constants/types";

/* ---------- デモデータ ---------- */

const SOUND_NAMES = ["小鳥のさえずり", "ギター", "風鈴", "木漏れ日", "小川のせせらぎ"];

type MonthPerf = {
  month: string;
  pts: number;
  calls: number;
  eff: number;
  rank: number;
};

const MONTHLY_PERF: MonthPerf[] = [
  { month: "2025/11", pts: 3.2, calls: 420, eff: 0.28, rank: 3 },
  { month: "2025/12", pts: 2.8, calls: 380, eff: 0.24, rank: 5 },
  { month: "2026/01", pts: 4.1, calls: 510, eff: 0.32, rank: 1 },
  { month: "2026/02", pts: 3.5, calls: 460, eff: 0.29, rank: 2 },
  { month: "2026/03", pts: 3.8, calls: 490, eff: 0.31, rank: 2 },
  { month: "2026/04", pts: 1.2, calls: 125, eff: 0.27, rank: 4 },
];

const maxPts = Math.max(...MONTHLY_PERF.map((p) => p.pts));

/* ---------- サブコンポーネント ---------- */

function InfoRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div style={{ display: "flex", padding: "8px 0", borderBottom: "1px solid rgba(0,0,0,0.03)" }}>
      <div style={{ width: 120, fontSize: 12, fontWeight: 600, color: C.textMuted }}>{label}</div>
      <div style={{ flex: 1, fontSize: 13, color: muted ? C.textMuted : C.textDark }}>{value}</div>
    </div>
  );
}

/* ---------- メインコンポーネント ---------- */

export default function MyPagePage() {
  const { mypageLocked, unlockMypage, triggerMypageLock, treeUser } = useTreeState();
  const [authenticated, setAuthenticated] = useState(false);
  const [pw, setPw] = useState("");
  const todokeRef = useRef<HTMLDivElement>(null);

  // 実ユーザーデータ（fallback 付き）
  const displayName = treeUser?.name ?? "-";
  const displayNameKana = treeUser?.name_kana ?? "-";
  const displayEmpId = treeUser?.employee_number ?? "-";
  const displayEmploymentType = treeUser?.employment_type ?? "-";
  const displayBirthday = treeUser?.birthday ?? "（未登録）";
  const displayEmail = treeUser?.email ?? "-";
  const displayRoleLabel = treeUser ? GARDEN_ROLE_LABELS[treeUser.garden_role] : "-";

  const scrollToTodoke = () => {
    setTimeout(() => {
      todokeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  // パスワード変更
  const [showPwChange, setShowPwChange] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // 通知音設定
  const [notifSoundIdx, setNotifSoundIdx] = useState(0);
  const [notifMuted, setNotifMuted] = useState(false);
  const [notifVolume, setNotifVolume] = useState(3);

  const handleLogin = () => {
    if (pw === "1234") {
      setAuthenticated(true);
      setPw("");
    }
  };

  const handlePwChange = () => {
    if (currentPw !== "1234") { setPwMsg({ ok: false, text: "現在のパスワードが違います" }); return; }
    if (newPw.length < 4 || newPw.length > 8) { setPwMsg({ ok: false, text: "新パスワードは4〜8桁で入力してください" }); return; }
    if (newPw !== confirmPw) { setPwMsg({ ok: false, text: "新パスワードが一致しません" }); return; }
    setPwMsg({ ok: true, text: "パスワードを変更しました" });
    setShowPwChange(false);
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
  };

  // パスワードゲート
  if (!authenticated) {
    return (
      <div style={{ padding: "24px 40px 80px", maxWidth: 400, margin: "0 auto" }}>
        <div style={{ position: "relative", marginBottom: 20 }}>
          <WireframeLabel color="#3478c6">🔒 マイページ</WireframeLabel>
          <div style={{ paddingTop: 8 }} />
        </div>
        <GlassPanel style={{ padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: C.darkGreen, margin: "0 0 8px" }}>本人確認</h2>
          <p style={{ fontSize: 12, color: C.textMuted, margin: "0 0 24px" }}>個人情報を閲覧するにはパスワードを入力してください</p>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            maxLength={8}
            placeholder="4桁パスワード"
            style={{
              width: "100%", padding: "14px 16px", border: "2px solid #dcedc8",
              borderRadius: 12, fontSize: 18, textAlign: "center", letterSpacing: 8,
              boxSizing: "border-box", fontFamily: "'Noto Sans JP', sans-serif",
              background: C.white, outline: "none",
            }}
          />
          <div style={{ marginTop: 16 }}>
            <ActionButton label="認証してマイページを開く" color="#3478c6" onClick={handleLogin} />
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 12 }}>デモ: 1234</div>
        </GlassPanel>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 40px 80px", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ position: "relative", marginBottom: 20 }}>
        <WireframeLabel color="#3478c6">👤 マイページ</WireframeLabel>
        <div style={{ paddingTop: 8 }} />
      </div>

      {/* 定期確認ロック中：変更なし / 変更ありボタン */}
      {mypageLocked && (
        <div
          style={{
            padding: "16px 24px",
            marginBottom: 20,
            borderRadius: 14,
            background: `linear-gradient(135deg, rgba(201,168,76,0.08), rgba(201,168,76,0.04))`,
            border: `2px solid ${C.gold}44`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.goldDark, marginBottom: 4 }}>
                📋 個人情報の定期確認中（3ヶ月に1度）
              </div>
              <div style={{ fontSize: 12, color: C.textMuted }}>
                登録内容に変更がないかご確認ください。変更がある場合は届出から申請できます。
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button
                onClick={unlockMypage}
                style={{
                  padding: "12px 24px",
                  border: "none",
                  borderRadius: 14,
                  background: `linear-gradient(135deg, ${C.darkGreen}, ${C.midGreen})`,
                  color: C.white,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Noto Sans JP', sans-serif",
                  boxShadow: `0 4px 16px ${C.midGreen}33`,
                }}
              >
                変更はありません
              </button>
              <button
                onClick={scrollToTodoke}
                style={{
                  padding: "12px 24px",
                  border: `2px solid ${C.gold}`,
                  borderRadius: 14,
                  background: `rgba(201,168,76,0.06)`,
                  color: C.goldDark,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Noto Sans JP', sans-serif",
                }}
              >
                変更する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* デモ：定期確認を再表示（ロック解除済みのときだけ表示） */}
      {!mypageLocked && (
        <div style={{ marginBottom: 12, textAlign: "right" }}>
          <button
            onClick={triggerMypageLock}
            style={{
              padding: "6px 14px",
              border: `1px dashed ${C.gold}`,
              borderRadius: 8,
              background: "transparent",
              color: C.goldDark,
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "'Noto Sans JP', sans-serif",
            }}
          >
            🧪 デモ：定期確認バナーを表示
          </button>
        </div>
      )}

      {/* 基本情報（KING OF TIME + 本人申告由来） */}
      <GlassPanel style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.textDark, marginBottom: 12 }}>
          基本情報
          <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 500, color: C.textMuted }}>
            （社員番号・氏名・入社日はKING OF TIME 由来 / 誕生日は本人申告）
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px" }}>
          <InfoRow label="氏名" value={displayName} />
          <InfoRow label="氏名カナ" value={displayNameKana} />
          <InfoRow label="社員番号" value={displayEmpId} />
          <InfoRow label="雇用形態" value={displayEmploymentType} />
          <InfoRow label="生年月日" value={displayBirthday} />
          <InfoRow label="Garden権限" value={displayRoleLabel} />
          <InfoRow label="メール" value={displayEmail} muted />
        </div>
      </GlassPanel>

      {/* 提出・登録情報（マネーフォワード電子契約 由来） */}
      <GlassPanel style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.textDark, marginBottom: 4 }}>提出・登録情報</div>
        <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 12 }}>
          ※ 以下の内容はマネーフォワードクラウド電子契約が source of truth です。
          変更が必要な場合は下部「届出・電子契約」からMFへ移動して届出を提出してください。
        </div>
        <InfoRow label="マイナンバー" value="✅ 提出済み" />
        <InfoRow label="交通費" value="渋谷駅 〜 新宿駅" />
        <InfoRow label="給与受取口座" value="●●銀行 ●●支店 普通 ●●●●●●●" muted />

        <div style={{ marginTop: 20, fontSize: 14, fontWeight: 700, color: C.textDark, marginBottom: 12 }}>緊急連絡先</div>
        <InfoRow label="氏名" value="東海林 太郎" />
        <InfoRow label="続柄" value="父" />
        <InfoRow label="郵便番号" value="〒150-0042" />
        <InfoRow label="住所" value="東京都渋谷区宇田川町1-1" />
        <InfoRow label="連絡先" value="090-9876-5432" />
      </GlassPanel>

      {/* 6ヶ月パフォーマンス */}
      <GlassPanel style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.textDark, marginBottom: 16 }}>パフォーマンス推移（6ヶ月）</div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 120, marginBottom: 12 }}>
          {MONTHLY_PERF.map((p) => (
            <div key={p.month} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.midGreen, marginBottom: 4 }}>{p.pts.toFixed(1)}P</div>
              <div style={{
                height: `${(p.pts / maxPts) * 80}px`,
                background: `linear-gradient(180deg, ${C.midGreen}, ${C.accentGreen})`,
                borderRadius: "4px 4px 0 0", margin: "0 auto", width: "70%",
              }} />
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>{p.month.slice(5)}</div>
            </div>
          ))}
        </div>
        {/* 詳細テーブル */}
        <div style={{ display: "grid", gridTemplateColumns: "80px repeat(6, 1fr)", gap: 4, fontSize: 11 }}>
          <div style={{ fontWeight: 600, color: C.textMuted }}>月</div>
          {MONTHLY_PERF.map((p) => <div key={p.month} style={{ textAlign: "center", color: C.textSub }}>{p.month.slice(5)}</div>)}
          <div style={{ fontWeight: 600, color: C.textMuted }}>ポイント</div>
          {MONTHLY_PERF.map((p) => <div key={p.month} style={{ textAlign: "center", fontWeight: 700, color: C.midGreen }}>{p.pts.toFixed(1)}P</div>)}
          <div style={{ fontWeight: 600, color: C.textMuted }}>架電数</div>
          {MONTHLY_PERF.map((p) => <div key={p.month} style={{ textAlign: "center", color: C.textSub }}>{p.calls}</div>)}
          <div style={{ fontWeight: 600, color: C.textMuted }}>有効率</div>
          {MONTHLY_PERF.map((p) => <div key={p.month} style={{ textAlign: "center", color: C.textSub }}>{(p.eff * 100).toFixed(0)}%</div>)}
          <div style={{ fontWeight: 600, color: C.textMuted }}>順位</div>
          {MONTHLY_PERF.map((p) => <div key={p.month} style={{ textAlign: "center", fontWeight: 700, color: p.rank <= 3 ? C.gold : C.textSub }}>{p.rank}位</div>)}
        </div>
      </GlassPanel>

      {/* パスワード変更 */}
      <GlassPanel style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.textDark }}>パスワード変更</div>
          <button
            onClick={() => setShowPwChange(!showPwChange)}
            style={{
              padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 11, fontWeight: 600, fontFamily: "'Noto Sans JP', sans-serif",
              background: "rgba(0,0,0,0.04)", color: C.textSub,
            }}
          >
            {showPwChange ? "閉じる" : "変更する"}
          </button>
        </div>
        {pwMsg && (
          <div style={{ fontSize: 12, color: pwMsg.ok ? C.midGreen : C.red, marginBottom: 8, fontWeight: 600 }}>{pwMsg.text}</div>
        )}
        {showPwChange && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 300 }}>
            <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="現在のパスワード" style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", fontSize: 13, fontFamily: "'Noto Sans JP', sans-serif", outline: "none" }} />
            <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="新しいパスワード（4〜8桁）" style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", fontSize: 13, fontFamily: "'Noto Sans JP', sans-serif", outline: "none" }} />
            <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="新しいパスワード（確認）" style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", fontSize: 13, fontFamily: "'Noto Sans JP', sans-serif", outline: "none" }} />
            <ActionButton label="変更を保存" color="#3478c6" onClick={handlePwChange} />
          </div>
        )}
      </GlassPanel>

      {/* 通知音設定 */}
      <GlassPanel style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.textDark, marginBottom: 12 }}>🔔 通知音設定</div>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: C.textMuted }}>通知音:</span>
            <button
              onClick={() => setNotifMuted(!notifMuted)}
              style={{
                padding: "4px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                fontSize: 11, fontWeight: 600, fontFamily: "'Noto Sans JP', sans-serif",
                background: notifMuted ? "rgba(214,48,49,0.1)" : "rgba(45,106,79,0.1)",
                color: notifMuted ? C.red : C.midGreen,
              }}
            >
              {notifMuted ? "OFF" : "ON"}
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: C.textMuted }}>音色:</span>
            <select
              value={notifSoundIdx}
              onChange={(e) => setNotifSoundIdx(Number(e.target.value))}
              style={{ padding: "4px 8px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.1)", fontSize: 12, fontFamily: "'Noto Sans JP', sans-serif" }}
            >
              {SOUND_NAMES.map((name, i) => <option key={i} value={i}>{name}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: C.textMuted }}>音量:</span>
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                onClick={() => setNotifVolume(v)}
                style={{
                  width: 24, height: 24, borderRadius: 6, border: "none", cursor: "pointer",
                  fontSize: 11, fontWeight: 700,
                  background: v <= notifVolume ? C.midGreen : "rgba(0,0,0,0.06)",
                  color: v <= notifVolume ? C.white : C.textMuted,
                }}
              >{v}</button>
            ))}
          </div>
        </div>
      </GlassPanel>

      {/* 届出セクション */}
      <div ref={todokeRef}>
        <GlassPanel style={{ padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.textDark, marginBottom: 12 }}>📋 届出・電子契約</div>
          <div style={{ fontSize: 12, color: C.textSub, marginBottom: 16 }}>各種届出はマネーフォワード電子契約を通じて申請します。</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
            {[
              { label: "緊急連絡先変更", icon: "📞", desc: "緊急連絡先の変更届出" },
              { label: "通勤経路変更", icon: "🚃", desc: "通勤経路・交通費の変更届出" },
              { label: "退職届", icon: "📄", desc: "退職届の提出" },
              { label: "秘密保持誓約書", icon: "🔒", desc: "NDA（秘密保持誓約書）の確認" },
            ].map((item) => (
              <GlassPanel key={item.label} style={{ padding: 14, cursor: "pointer", textAlign: "center" }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>{item.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.textDark }}>{item.label}</div>
                <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{item.desc}</div>
              </GlassPanel>
            ))}
          </div>
        </GlassPanel>
      </div>

      <div style={{ marginTop: 16, textAlign: "center", fontSize: 11, color: C.textMuted }}>
        個人情報は暗号化して管理 • 定期確認: 3ヶ月ごと • 届出はマネーフォワード電子契約経由
      </div>
    </div>
  );
}

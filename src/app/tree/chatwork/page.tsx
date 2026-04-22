"use client";

/**
 * Garden-Tree Chatwork情報画面 (/tree/chatwork)
 *
 * プロトタイプの <ChatworkScreen /> を移植。
 *
 * 構成:
 *  1. アカウント情報パネル（ロール別: 共有 or 個人）
 *  2. マスク表示 + コピー機能
 *  3. Chatworkを開くリンク
 *  4. 架電開始ボタン
 *
 * - SPROUTは共有トスアカウント、BRANCHは共有クローザーアカウント
 * - MANAGERは個人アカウント（パスワードなし）
 * - サイドバー・KPIヘッダーは TreeShell が描画
 */

import { useState } from "react";

import { ActionButton } from "../_components/ActionButton";
import { GlassPanel } from "../_components/GlassPanel";
import { WireframeLabel } from "../_components/WireframeLabel";
import { C } from "../_constants/colors";
import { ROLES } from "../_constants/roles";
import { useTreeState } from "../_state/TreeStateContext";

/* ---------- ヘルパー ---------- */

function mask(str: string): string {
  return "●".repeat(Math.min(str.length, 16));
}

function fmtTime(d: Date): string {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ---------- コンポーネント ---------- */

function CopyRow({ label, value, field, copied, onCopy }: {
  label: string;
  value: string;
  field: string;
  copied: string | null;
  onCopy: (text: string, field: string) => void;
}) {
  const isCopied = copied === field;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
      <div style={{ width: 100, fontSize: 12, fontWeight: 600, color: C.textMuted }}>{label}</div>
      <div style={{ flex: 1, fontSize: 14, fontFamily: "monospace", color: C.textDark, letterSpacing: 2 }}>{mask(value)}</div>
      <button
        onClick={() => onCopy(value, field)}
        style={{
          padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer",
          fontSize: 11, fontWeight: 600, fontFamily: "'Noto Sans JP', sans-serif",
          background: isCopied ? C.midGreen : "#3478c6",
          color: C.white, transition: "all 0.2s",
        }}
      >
        {isCopied ? "✓ コピーしました" : "コピー"}
      </button>
    </div>
  );
}

export default function ChatworkPage() {
  const { role } = useTreeState();
  const [copied, setCopied] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());

  // ロール別アカウント情報
  const accountInfo = (() => {
    if (role === ROLES.SPROUT) return { type: "shared", label: "共有トスアカウント", desc: "トスチーム全員で使用する共有アカウントです", email: "toss-team@garden-group.co.jp", pw: "GardenToss2026!" };
    if (role === ROLES.BRANCH) return { type: "shared", label: "共有クローザーアカウント", desc: "クローザーチーム全員で使用する共有アカウントです", email: "closer-team@garden-group.co.jp", pw: "GardenCloser2026!" };
    return { type: "personal", label: "個人アカウント", desc: "責任者用の個人アカウントです", email: "m.shoji@garden-group.co.jp", pw: null };
  })();

  const isPersonal = accountInfo.type === "personal";

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleRefresh = () => setLastUpdated(new Date());

  return (
    <div style={{ padding: "24px 40px 80px", maxWidth: 700, margin: "0 auto" }}>
      <div style={{ position: "relative", marginBottom: 20 }}>
        <WireframeLabel color="#e74c3c">💬 Chatwork情報</WireframeLabel>
        <div style={{ paddingTop: 8 }} />
      </div>

      <GlassPanel style={{ padding: 24 }}>
        {/* ヘッダー */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 20 }}>💬</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: C.textDark }}>{accountInfo.label}</span>
            </div>
            <div style={{ fontSize: 12, color: C.textSub }}>{accountInfo.desc}</div>
          </div>
          <button
            onClick={handleRefresh}
            style={{
              padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 11, fontWeight: 600, fontFamily: "'Noto Sans JP', sans-serif",
              background: "rgba(0,0,0,0.04)", color: C.textSub,
            }}
          >
            🔄 更新
          </button>
        </div>

        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 16 }}>
          最終更新: {fmtTime(lastUpdated)}
        </div>

        {/* アカウント情報 */}
        {isPersonal ? (
          <>
            <div style={{ fontSize: 12, color: C.textSub, marginBottom: 12, background: "rgba(52,120,198,0.06)", padding: "8px 12px", borderRadius: 8 }}>
              個人アカウントのため、パスワードは各自で管理してください。
            </div>
            <CopyRow label="メール" value={accountInfo.email} field="email" copied={copied} onCopy={handleCopy} />
          </>
        ) : (
          <>
            <CopyRow label="メール" value={accountInfo.email} field="email" copied={copied} onCopy={handleCopy} />
            {accountInfo.pw && <CopyRow label="パスワード" value={accountInfo.pw} field="pw" copied={copied} onCopy={handleCopy} />}
          </>
        )}

        {/* Chatworkリンク */}
        <div style={{ marginTop: 20 }}>
          <a
            href="https://www.chatwork.com/login.php"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block", textAlign: "center", padding: "14px 24px",
              borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: "none",
              background: "linear-gradient(135deg, #e74c3c, #c0392b)", color: C.white,
              boxShadow: "0 4px 16px rgba(231,76,60,0.3)",
            }}
          >
            Chatworkを開く
          </a>
        </div>
      </GlassPanel>

      {/* 架電開始ボタン */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
        <ActionButton
          label="架電を開始する"
          color={C.midGreen}
          large
        />
      </div>

      {/* 注意事項 */}
      <GlassPanel style={{ padding: 16, marginTop: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.textDark, marginBottom: 8 }}>ご利用上の注意</div>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: C.textSub, lineHeight: 2 }}>
          <li>共有アカウントのパスワードは他者に教えないでください</li>
          <li>ログイン情報を変更した場合は責任者に報告してください</li>
          <li>業務外のチャットルーム作成は禁止です</li>
          <li>退職時にはログアウトを確認してください</li>
        </ul>
      </GlassPanel>
    </div>
  );
}

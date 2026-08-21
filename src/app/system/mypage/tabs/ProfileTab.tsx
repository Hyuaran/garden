"use client";

import { useEffect, useRef, useState } from "react";
import { GARDEN_ROLE_LABELS, type GardenRole } from "@/app/root/_constants/types";
import type { MyPageProfile } from "../types";
import styles from "../mypage.module.css";

const LS_MYPAGE_LAST_CONFIRM = "gardenTree_mypageLastConfirm";
const MYPAGE_CONFIRM_INTERVAL_DAYS = 90;

function InfoRow({ label, value, pending = false }: { label: string; value: string; pending?: boolean }) {
  return <div className={styles.infoRow}><dt>{label}</dt><dd className={pending ? styles.pending : undefined}>{value}</dd></div>;
}

const PendingLabel = () => <span className={styles.pendingNote}>（準備中：この欄はまだ本物のデータではありません）</span>;

export default function ProfileTab({ birthdayRegistered, profile, registered, onUnlocked }: {
  birthdayRegistered: boolean;
  profile: MyPageProfile | null;
  registered: boolean;
  onUnlocked: (profile: MyPageProfile) => void;
}) {
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [unlockError, setUnlockError] = useState(false);
  const [mypageLocked, setMypageLocked] = useState(false);
  const submissionsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LS_MYPAGE_LAST_CONFIRM);
      if (!raw) return setMypageLocked(true);
      const last = new Date(raw);
      const days = (Date.now() - last.getTime()) / 86_400_000;
      setMypageLocked(!Number.isFinite(days) || days >= MYPAGE_CONFIRM_INTERVAL_DAYS);
    } catch { setMypageLocked(true); }
  }, []);

  async function unlock() {
    if (!/^\d{4}$/.test(code)) { setUnlockError(true); return; }
    setChecking(true); setUnlockError(false);
    try {
      const response = await fetch("/api/system/mypage/unlock", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }),
      });
      const result = await response.json() as { ok?: boolean; profile?: MyPageProfile };
      if (!response.ok || !result.ok || !result.profile) setUnlockError(true);
      else { onUnlocked(result.profile); setCode(""); }
    } catch { setUnlockError(true); }
    finally { setChecking(false); }
  }

  function confirmUnchanged() {
    setMypageLocked(false);
    try { window.localStorage.setItem(LS_MYPAGE_LAST_CONFIRM, new Date().toISOString()); } catch { /* ignore */ }
  }

  if (!profile && !birthdayRegistered && !registered) {
    return <section className={styles.comingSoon}><h2>従業員情報がありません</h2><p>従業員情報が登録されていません。管理者にご連絡ください。</p></section>;
  }

  if (!profile) return <section className={styles.unlockPanel} aria-label="本人確認">
    <span className={styles.lockIcon} aria-hidden="true">🔒</span><h2>本人確認</h2>
    <p>個人情報を閲覧するには、生年月日の月日4桁を入力してください。</p>
    <label>生年月日の月日4桁<input aria-label="生年月日の月日4桁" inputMode="numeric" autoComplete="off" type="password"
      value={code} maxLength={4} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 4))}
      onKeyDown={(event) => { if (event.key === "Enter") void unlock(); }} /></label>
    {unlockError && <p role="alert" className={styles.error}>4桁が一致しません。</p>}
    <button type="button" disabled={checking} onClick={() => void unlock()}>{checking ? "確認中…" : "認証してマイページを開く"}</button>
  </section>;

  const roleLabel = GARDEN_ROLE_LABELS[profile.gardenRole as GardenRole] ?? profile.gardenRole;
  return <div className={styles.profileContent}>
    {!birthdayRegistered && <p className={styles.unlockedNotice}>生年月日が未登録のため本人確認を省略しています。</p>}
    {mypageLocked && <section className={styles.confirmationBanner} aria-label="個人情報の定期確認">
      <div><h2>個人情報の定期確認中（3ヶ月に1度）</h2><p>登録内容に変更がないかご確認ください。変更がある場合は届出から申請できます。</p></div>
      <div className={styles.confirmationActions}><button type="button" onClick={confirmUnchanged}>変更はありません</button>
        <button type="button" className={styles.secondaryButton} onClick={() => submissionsRef.current?.scrollIntoView({ behavior: "smooth" })}>変更する</button></div>
    </section>}

    <section className={styles.card}><h2>基本情報</h2><dl className={styles.infoGrid}>
      <InfoRow label="氏名" value={profile.name} /><InfoRow label="氏名カナ" value={profile.nameKana} />
      <InfoRow label="社員番号" value={profile.employeeNumber} /><InfoRow label="雇用形態" value={profile.employmentType} />
      <InfoRow label="生年月日" value={profile.birthday ?? "（未登録）"} /><InfoRow label="Garden権限" value={roleLabel} />
      <InfoRow label="メール" value={profile.email} /><InfoRow label="マイナンバー" value="準備中" pending />
      <InfoRow label="交通費" value="準備中" pending /><InfoRow label="給与受取口座" value="準備中" pending />
    </dl></section>

    <section className={styles.card}><h2>緊急連絡先 <PendingLabel /></h2><dl className={styles.infoGrid}>
      {["氏名", "続柄", "郵便番号", "住所", "連絡先"].map((label) => <InfoRow key={label} label={label} value="準備中" pending />)}
    </dl></section>

    <section className={styles.card}><h2>パフォーマンス推移（6ヶ月） <PendingLabel /></h2>
      <div className={styles.performancePending}><span>ポイント</span><span>架電数</span><span>有効率</span><span>順位</span></div><p className={styles.pending}>準備中</p>
    </section>

    <section className={styles.card} ref={submissionsRef}><h2>提出・登録情報</h2><div className={styles.actionGrid}>
      {[["📞", "緊急連絡先変更"], ["🚃", "通勤経路変更"], ["📄", "退職届"], ["🔒", "秘密保持誓約書"]].map(([icon, label]) =>
        <button type="button" key={label}><span aria-hidden="true">{icon}</span>{label}</button>)}
    </div></section>

    <section className={styles.card}><h2>設定</h2><div className={styles.settings}>
      <div><strong>パスワード変更</strong><button type="button">変更する</button></div>
      <div><strong>通知音</strong><span className={styles.pending}>準備中</span></div>
      <div><strong>音量</strong><span className={styles.pending}>準備中</span></div>
    </div></section>
  </div>;
}

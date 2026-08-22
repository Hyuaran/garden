"use client";

import { useState } from "react";
import { evaluateGardenCheck } from "../_lib/zenkaku-check";
import type { GardenCheckIssue, GardenCheckResult } from "../_lib/zenkaku-check";
import { loadZenkakuCheckSource } from "../_lib/zenkaku-source";
import type { ZenkakuCheckSource } from "../_lib/zenkaku-source";
import styles from "../mypage.module.css";

function IssueList({ issues }: { issues: GardenCheckIssue[] }) {
  return <ul className={styles.issueList}>{issues.map((issue, index) => <li key={`${issue.ruleId}-${index}`}>
    <p>{issue.message}</p>{issue.missingFields?.length ? <ul>{issue.missingFields.map((field) => <li key={field}>{field}</li>)}</ul> : null}
  </li>)}</ul>;
}

export default function ZenkakuTab({ loadSource = loadZenkakuCheckSource, now = () => new Date() }: { loadSource?: (salesId: string) => Promise<ZenkakuCheckSource>; now?: () => Date }) {
  const [salesId, setSalesId] = useState("");
  const [checking, setChecking] = useState(false);
  const [inputError, setInputError] = useState("");
  const [result, setResult] = useState<GardenCheckResult | null>(null);
  async function check() {
    const trimmed = salesId.trim();
    if (!trimmed) { setInputError("営業IDを入力してください。"); setResult(null); return; }
    setChecking(true); setInputError(""); setResult(null);
    try {
      const source = await loadSource(trimmed);
      setResult(evaluateGardenCheck(source.record, source.duplicates, now()));
    } catch {
      setInputError("確認できませんでした。時間をおいてもう一度お試しください。");
    } finally { setChecking(false); }
  }
  const canProceed = result !== null && result.blocking.length === 0;
  return <section className={styles.zenkakuContent} aria-labelledby="zenkaku-title">
    <div className={styles.card}><h2 id="zenkaku-title">前確依頼</h2><p className={styles.zenkakuLead}>営業IDを入力して、前確依頼に必要な項目を確認します。</p>
      <div className={styles.checkForm}><label htmlFor="zenkaku-sales-id">営業ID</label><input id="zenkaku-sales-id" value={salesId} onChange={(event) => setSalesId(event.target.value)} disabled={checking}/>
        <button type="button" onClick={() => void check()} disabled={checking}>{checking ? "チェック中…" : "連携チェック"}</button></div>
      {checking ? <p role="status" className={styles.checking}>営業マスタを確認しています。</p> : null}
      {inputError ? <p role="alert" className={styles.error}>{inputError}</p> : null}
    </div>
    {result?.blocking.length ? <section className={`${styles.card} ${styles.blockingResult}`} aria-labelledby="blocking-title"><h2 id="blocking-title">修正が必要です</h2><p className={styles.error}>次の項目を確認してください。修正するまで前確依頼へ進めません。</p><IssueList issues={result.blocking}/></section> : null}
    {result?.notices.length ? <section className={`${styles.card} ${styles.noticeResult}`} aria-labelledby="notice-title"><h2 id="notice-title">ご確認ください</h2><IssueList issues={result.notices}/></section> : null}
    {result?.warnings.length ? <section className={styles.confirmationBanner} aria-labelledby="warning-title"><div><h2 id="warning-title">警告</h2><IssueList issues={result.warnings}/></div></section> : null}
    {canProceed ? <section className={`${styles.card} ${styles.successResult}`} aria-labelledby="success-title"><h2 id="success-title">確認できました</h2><p>前確依頼に必要な項目が入力されています。</p><button type="button" disabled>次へ進む（次段階で利用できます）</button></section> : null}
  </section>;
}

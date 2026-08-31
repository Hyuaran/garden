"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NDA_FULL_TEXT } from "../mypage/_lib/nda-content";
import { DEPENDENT_FIELDS, DEPENDENT_LABELS, emptyDependent, FIELD_LABELS, formatWarnings, POSTAL_NOT_FOUND, STEP_FIELDS, STEPS, type OnboardingRecord, type TextField } from "./_lib/onboarding";
import OnboardingReview from "./_components/OnboardingReview";
import styles from "./onboarding.module.css";

type Address = { address: string; addressKana: string };

export default function OnboardingClient({ initial }: { initial: OnboardingRecord }) {
  const router = useRouter();
  const [values, setValues] = useState(initial.values);
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(initial.status === "submitted");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const [notice, setNotice] = useState("");
  const [hasFamily, setHasFamily] = useState(initial.values.dependents.length > 0);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [postalNotice, setPostalNotice] = useState("");
  const addressRevision = useRef(0);
  const postalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const postalRequest = useRef<AbortController | null>(null);
  const warnings = formatWarnings(values);

  useEffect(() => () => { if (postalTimer.current) clearTimeout(postalTimer.current); postalRequest.current?.abort(); }, []);
  useEffect(() => { heading.current?.focus(); }, [step, submitted]);

  function change(key: TextField, value: string) {
    if (key === "address" || key === "address_kana") addressRevision.current++;
    setValues(previous => ({ ...previous, [key]: value }));
  }
  function applyAddress(address: Address) {
    addressRevision.current++;
    setValues(previous => ({ ...previous, address: address.address, address_kana: address.addressKana }));
    setPostalNotice("住所を入れました。番地や建物名を足してください。");
  }
  function changePostal(code: string) {
    change("postal_code", code);
    if (postalTimer.current) clearTimeout(postalTimer.current);
    postalRequest.current?.abort();
    setAddresses([]); setPostalNotice("");
    if (!/^[0-9]{7}$/.test(code)) return;
    const controller = new AbortController(); postalRequest.current = controller;
    const revision = addressRevision.current;
    postalTimer.current = setTimeout(async () => {
      setPostalNotice("住所を調べています。");
      try {
        const response = await fetch(`/api/system/onboarding/postal?code=${encodeURIComponent(code)}`, { signal: controller.signal, cache: "no-store" });
        const body = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok) { setPostalNotice(body.error ?? "住所を取得できませんでした。住所を直接入れてください。"); return; }
        const candidates = body.addresses as Address[];
        setAddresses(candidates);
        if (!candidates.length) { setPostalNotice(POSTAL_NOT_FOUND); return; }
        // 検索中に本人が番地等を書いた場合、その入力を非同期応答で上書きしない。
        if (candidates.length === 1 && revision === addressRevision.current) applyAddress(candidates[0]);
        else setPostalNotice("住所の候補を選ぶか、住所を直接入れてください。");
      } catch {
        if (!controller.signal.aborted) setPostalNotice("住所を取得できませんでした。住所を直接入れてください。");
      }
    }, 300);
  }

  async function save(nextStep?: number, submit = false) {
    if (saving.current) return;
    if (postalTimer.current) clearTimeout(postalTimer.current);
    postalRequest.current?.abort();
    setPostalNotice(previous => previous === "住所を調べています。" ? "" : previous);
    saving.current = true; setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/system/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: submit ? "submit" : "save", values }) });
      const result = await response.json();
      if (!response.ok) { setNotice(result.error ?? "保存できませんでした。もう一度お試しください。"); return; }
      if (result.status === "submitted") {
        setSubmitted(true);
        // 別タブで先に提出された場合も、保存済みの内容で見返せるようにする。
        router.refresh();
        return;
      }
      setNotice("保存しました。");
      if (nextStep != null) setStep(nextStep);
    } catch { setNotice("保存できませんでした。入力内容はこの画面に残っています。もう一度保存してください。"); }
    finally { saving.current = false; setBusy(false); }
  }

  function field(key: TextField) {
    const date = ["birth_date", "previous_employer_from", "previous_employer_to"].includes(key);
    return <div key={key} className={styles.field}><label htmlFor={`field-${key}`}>{FIELD_LABELS[key]}</label>
      {key === "gender" ? <select id={`field-${key}`} value={values[key]} onChange={event => change(key, event.target.value)}><option value="">選んでください</option>{["男性", "女性", "回答しない"].map(label => <option key={label}>{label}</option>)}</select>
        : key === "employment_insurance_status" ? <select id={`field-${key}`} value={values[key]} onChange={event => change(key, event.target.value)}><option value="">選んでください</option><option value="yes">あり</option><option value="no">なし</option><option value="unknown">わからない</option></select>
        : <input id={`field-${key}`} type={date ? "date" : "text"} inputMode={key.includes("phone") ? "tel" : key === "postal_code" || key.includes("number") ? "numeric" : undefined} maxLength={2000} value={values[key]}
          onChange={event => key === "postal_code" ? changePostal(event.target.value) : change(key, event.target.value)} aria-describedby={warnings[key] ? `warning-${key}` : undefined} />}
      {warnings[key] && <span id={`warning-${key}`} className={styles.warning}>{warnings[key]}</span>}
      {key === "postal_code" && <>
        {postalNotice && <span className={styles.hint} role="status">{postalNotice}</span>}
        {addresses.length > 0 && <select aria-label="住所の候補" value="" onChange={event => { const address = addresses[Number(event.target.value)]; if (event.target.value && address) applyAddress(address); }}><option value="">住所の候補</option>{addresses.map((address, index) => <option value={String(index)} key={`${address.address}-${index}`}>{address.address}</option>)}</select>}
      </>}
    </div>;
  }

  if (submitted) return <section className={styles.panel}>
    <h2 ref={heading} tabIndex={-1}>入社手続きを提出しました</h2>
    <p>ご入力ありがとうございました。提出した内容をご確認いただけます。</p>
    {/* 強制遷移せず、ホームは新しい状態を取得して案内を消す。 */}
    <a className={styles.button} href="/system">Systemのホームへ</a>
    <OnboardingReview values={values} />
  </section>;

  return <section className={styles.panel}>
    <p className={styles.progress}>8つのうち {step + 1}番目</p>
    <h2 ref={heading} tabIndex={-1}>{STEPS[step]}</h2>
    <p className={styles.hint}>空欄のままでも進めます。分かる範囲で入力してください。</p>
    <form noValidate onSubmit={event => { event.preventDefault(); void save(step < 7 ? step + 1 : undefined, step === 7); }}>
      <fieldset disabled={busy} className={styles.fields}>
        {step !== 2 && step !== 6 && step !== 7 && STEP_FIELDS[step].filter(key => key !== "employment_insurance_number" || values.employment_insurance_status === "yes").map(field)}
        {step === 2 && <>
          <label className={styles.field}>扶養している家族はいますか<select value={hasFamily ? "yes" : "no"} onChange={event => { const yes = event.target.value === "yes"; setHasFamily(yes); setValues(previous => ({ ...previous, dependents: yes ? previous.dependents.length ? previous.dependents : [emptyDependent()] : [] })); }}><option value="no">いいえ</option><option value="yes">はい</option></select></label>
          {hasFamily && <>
            {values.dependents.map((person, index) => <fieldset className={styles.dependent} key={index}><legend>扶養家族 {index + 1}人目</legend>
              {DEPENDENT_FIELDS.map(key => <label className={styles.field} key={key}>{DEPENDENT_LABELS[key]}<input value={person[key]} maxLength={2000} type={key === "birth_date" ? "date" : "text"} inputMode={key === "annual_income" ? "numeric" : undefined}
                onChange={event => setValues(previous => ({ ...previous, dependents: previous.dependents.map((entry, i) => i === index ? { ...entry, [key]: event.target.value } : entry) }))} /></label>)}
              <button type="button" onClick={() => setValues(previous => ({ ...previous, dependents: previous.dependents.filter((_, i) => i !== index) }))}>{index + 1}人目を消す</button>
            </fieldset>)}
            <button type="button" disabled={values.dependents.length >= 30} onClick={() => setValues(previous => ({ ...previous, dependents: [...previous.dependents, emptyDependent()] }))}>もう1人ふやす</button>
          </>}
        </>}
        {step === 3 && <p>番号が分からないときは、次の画面で前の勤務先を教えてください。こちらで調べます。</p>}
        {step === 4 && <p>雇用保険の番号を調べるために使います。分かる範囲で大丈夫です。</p>}
        {step === 5 && <p>災害や急なご病気のときの連絡先です。</p>}
        {step === 6 && <><div className={styles.pledge}>{NDA_FULL_TEXT}</div><label className={styles.agree}><input type="checkbox" checked={values.nda_agreed} onChange={event => setValues(previous => ({ ...previous, nda_agreed: event.target.checked }))} />内容を確認しました</label></>}
        {step === 7 && <OnboardingReview values={values} onEdit={index => void save(index)} />}
        <div className={styles.actions}>
          {step > 0 && <button type="button" onClick={() => void save(step - 1)}>戻る</button>}
          <button type="button" onClick={() => void save()}>途中保存</button>
          <button className={styles.primary} type="submit">{step === 7 ? "提出する" : "次へ"}</button>
        </div>
      </fieldset>
      <p role="status" className={styles.saveStatus}>{busy ? "保存しています。" : notice}</p>
    </form>
    <p className={styles.hint}>画面を離れる前に「途中保存」を押してください。</p>
    <Link href="/system">Systemのホームへ戻る</Link>
  </section>;
}

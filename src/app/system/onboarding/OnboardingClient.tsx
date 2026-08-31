"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NDA_FULL_TEXT } from "../mypage/_lib/nda-content";
import { ACCOUNT_TYPE_OPTIONS, CODE_LOOKUP_NOT_FOUND, COMMUTE_METHOD_OPTIONS, COMMUTE_ROUTE_FIELDS, COMMUTE_ROUTE_KIND_OPTIONS, COMMUTE_ROUTE_LABELS, commuteTotals, emptyCommuteRoute, DEPENDENT_FIELDS, DEPENDENT_LABELS, emptyDependent, FIELD_LABELS, formatWarnings, formatYen, isMaskedMyNumber, LOOKUP_NOT_FOUND, POSTAL_NOT_FOUND, RELATIONSHIP_OPTIONS, STEP_FIELDS, STEPS, type CommuteRoute, type Dependent, type OnboardingRecord, type TextField } from "./_lib/onboarding";
import OnboardingReview from "./_components/OnboardingReview";
import styles from "./onboarding.module.css";

type Address = { address: string; addressKana: string };
type BankChoice = { bankName: string; bankCode: string };
type BranchChoice = { branchName: string; branchCode: string };

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
  const [commuteNotices, setCommuteNotices] = useState<string[]>([]);
  const [bankNotice, setBankNotice] = useState("");
  const [branchNotice, setBranchNotice] = useState("");
  const [bankChoices, setBankChoices] = useState<BankChoice[]>([]);
  const [branchChoices, setBranchChoices] = useState<BranchChoice[]>([]);
  const addressRevision = useRef(0);
  const postalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const postalRequest = useRef<AbortController | null>(null);
  const warnings = formatWarnings(values);

  useEffect(() => () => { if (postalTimer.current) clearTimeout(postalTimer.current); postalRequest.current?.abort(); }, []);
  useEffect(() => { heading.current?.focus(); }, [step, submitted]);

  function change(key: TextField, value: string) {
    if (key === "address" || key === "address_kana") addressRevision.current++;
    if (key === "bank_name" || key === "bank_code") { setBranchChoices([]); setBranchNotice(""); }
    if (key === "my_number" && isMaskedMyNumber(values.my_number)) value = "";
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
  async function lookupCommute(index: number) {
    setCommuteNotices(previous => previous.map((notice, i) => i === index ? "" : notice));
    const route = values.commute_routes[index] ?? emptyCommuteRoute();
    const station = route.from_station.trim();
    if (!station) { setCommuteNotices(previous => commuteRoutes().map((_, i) => i === index ? LOOKUP_NOT_FOUND : previous[i] ?? "")); return; }
    try {
      const response = await fetch(`/api/system/onboarding/lookup/commute?station=${encodeURIComponent(station)}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok || !body.fare) { setCommuteNotices(previous => commuteRoutes().map((_, i) => i === index ? LOOKUP_NOT_FOUND : previous[i] ?? "")); return; }
      setValues(previous => ({ ...previous, commute_routes: commuteRoutes(previous.commute_routes).map((entry, i) => i === index ? { ...entry, line: body.fare.line ?? entry.line, pass_monthly: String(body.fare.passMonthly ?? ""), fare_oneway: String(body.fare.fareOneway ?? "") } : entry) }));
    } catch { setCommuteNotices(previous => commuteRoutes().map((_, i) => i === index ? LOOKUP_NOT_FOUND : previous[i] ?? "")); }
  }
  async function lookupBank() {
    setBankNotice(""); setBankChoices([]);
    const bankName = values.bank_name.trim();
    if (!bankName) { setBankNotice(CODE_LOOKUP_NOT_FOUND); return; }
    try {
      const response = await fetch(`/api/system/onboarding/lookup/bank?name=${encodeURIComponent(bankName)}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok || !Array.isArray(body.banks) || body.banks.length === 0) { setBankNotice(CODE_LOOKUP_NOT_FOUND); return; }
      if (body.banks.length === 1) applyBank(body.banks[0]);
      else { setBankChoices(body.banks); setBankNotice("候補を選ぶか、コードを直接入れてください。"); }
    } catch { setBankNotice(CODE_LOOKUP_NOT_FOUND); }
  }
  function applyBank(choice: BankChoice) {
    setValues(previous => ({ ...previous, bank_name: choice.bankName, bank_code: choice.bankCode }));
    setBankChoices([]); setBankNotice("銀行コードを入れました。");
  }
  async function lookupBranch() {
    setBranchNotice(""); setBranchChoices([]);
    const branchName = values.branch_name.trim();
    const bankCode = values.bank_code.trim();
    if (!branchName || !bankCode) { setBranchNotice(CODE_LOOKUP_NOT_FOUND); return; }
    try {
      const response = await fetch(`/api/system/onboarding/lookup/branch?bankCode=${encodeURIComponent(bankCode)}&name=${encodeURIComponent(branchName)}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok || !Array.isArray(body.branches) || body.branches.length === 0) { setBranchNotice(CODE_LOOKUP_NOT_FOUND); return; }
      if (body.branches.length === 1) applyBranch(body.branches[0]);
      else { setBranchChoices(body.branches); setBranchNotice("候補を選ぶか、コードを直接入れてください。"); }
    } catch { setBranchNotice(CODE_LOOKUP_NOT_FOUND); }
  }
  function applyBranch(choice: BranchChoice) {
    setValues(previous => ({ ...previous, branch_name: choice.branchName, branch_code: choice.branchCode }));
    setBranchChoices([]); setBranchNotice("支店コードを入れました。");
  }
  function changeDependentRelation(index: number, value: string) {
    setValues(previous => ({ ...previous, dependents: previous.dependents.map((entry, i) => i === index ? { ...entry, relation: value } : entry) }));
  }
  function relationSelectValue(value: string) {
    if (!value) return "";
    return (RELATIONSHIP_OPTIONS as readonly string[]).includes(value) ? value : "その他";
  }
  function relationshipSelect(value: string, onSelect: (value: string) => void, id?: string) {
    return <select id={id} value={relationSelectValue(value)} onChange={event => onSelect(event.target.value)}>
      <option value="">選んでください</option>{RELATIONSHIP_OPTIONS.map(label => <option key={label}>{label}</option>)}
    </select>;
  }
  function commuteRoutes(routes = values.commute_routes) {
    return routes.length ? routes : [emptyCommuteRoute()];
  }
  function changeCommuteRoute(index: number, key: keyof CommuteRoute, value: string) {
    setValues(previous => ({ ...previous, commute_routes: commuteRoutes(previous.commute_routes).map((entry, i) => i === index ? { ...entry, [key]: value } : entry) }));
  }
  function removeCommuteRoute(index: number) {
    setValues(previous => ({ ...previous, commute_routes: commuteRoutes(previous.commute_routes).filter((_, i) => i !== index) }));
    setCommuteNotices(previous => previous.filter((_, i) => i !== index));
  }
  function addCommuteRoute() {
    setValues(previous => ({ ...previous, commute_routes: [...commuteRoutes(previous.commute_routes), emptyCommuteRoute()] }));
  }
  function routeInput(route: CommuteRoute, index: number, key: keyof CommuteRoute) {
    const id = `commute-${index}-${key}`;
    if (key === "kind") return <select id={id} value={route[key]} onChange={event => changeCommuteRoute(index, key, event.target.value)}>
      <option value="">選んでください</option>{COMMUTE_ROUTE_KIND_OPTIONS.map(label => <option key={label}>{label}</option>)}
    </select>;
    const input = <input id={id} value={route[key]} maxLength={2000} inputMode={key === "pass_monthly" || key === "fare_oneway" ? "numeric" : undefined} onChange={event => changeCommuteRoute(index, key, event.target.value)} />;
    if (key !== "from_station") return input;
    return <div className={styles.inputWithButton}>{input}<button type="button" onClick={() => void lookupCommute(index)}>調べる</button></div>;
  }
  function commuteRouteFields() {
    const routes = commuteRoutes();
    const totals = commuteTotals(routes);
    return <>
      {routes.map((route, index) => <fieldset className={styles.dependent} key={index}>
        <legend>{index + 1}区間目</legend>
        {COMMUTE_ROUTE_FIELDS.map(key => <label className={styles.field} key={key} htmlFor={`commute-${index}-${key}`}>{COMMUTE_ROUTE_LABELS[key]}{routeInput(route, index, key)}</label>)}
        {commuteNotices[index] && <span className={styles.hint} role="status">{commuteNotices[index]}</span>}
        <button type="button" onClick={() => removeCommuteRoute(index)}>{index + 1}区間目を消す</button>
      </fieldset>)}
      <button type="button" disabled={routes.length >= 10} onClick={addCommuteRoute}>もう1区間ふやす</button>
      <dl className={styles.totals}>
        <div><dt>定期代の合計</dt><dd>{totals.hasAnyAmount ? `${formatYen(totals.passMonthly)} ／ 月` : <span className={styles.empty}>未入力</span>}</dd></div>
        <div><dt>片道の運賃の合計</dt><dd>{totals.hasAnyAmount ? formatYen(totals.fareOneway) : <span className={styles.empty}>未入力</span>}</dd></div>
      </dl>
    </>;
  }
  function lookupField(key: TextField, button: string, onClick: () => void, disabled = false) {
    return <div className={styles.inputWithButton}>
      <input id={`field-${key}`} type="text" inputMode={key.includes("code") || key.includes("fare") || key.includes("pass") ? "numeric" : undefined} maxLength={2000} value={values[key]} onChange={event => change(key, event.target.value)} aria-describedby={warnings[key] ? `warning-${key}` : undefined} />
      <button type="button" onClick={onClick} disabled={disabled}>{button}</button>
    </div>;
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
        : key === "commute_method" ? <select id={`field-${key}`} value={values[key]} onChange={event => change(key, event.target.value)}><option value="">選んでください</option>{COMMUTE_METHOD_OPTIONS.map(label => <option key={label}>{label}</option>)}</select>
        : key === "account_type" ? <select id={`field-${key}`} value={values[key]} onChange={event => change(key, event.target.value)}><option value="">選んでください</option>{ACCOUNT_TYPE_OPTIONS.map(label => <option key={label}>{label}</option>)}</select>
        : key === "emergency_relation" ? relationshipSelect(values[key], value => change(key, value), `field-${key}`)
        : key === "emergency_relation_other" && relationSelectValue(values.emergency_relation) !== "その他" ? null
        : key === "bank_name" ? lookupField(key, "調べる", lookupBank)
        : key === "branch_name" ? lookupField(key, "調べる", lookupBranch, !values.bank_code.trim())
        : <input id={`field-${key}`} type={date ? "date" : "text"} inputMode={key.includes("phone") ? "tel" : key === "postal_code" || key.includes("number") ? "numeric" : undefined} maxLength={2000} value={values[key]}
          onChange={event => key === "postal_code" ? changePostal(event.target.value) : change(key, event.target.value)} aria-describedby={warnings[key] ? `warning-${key}` : undefined} />}
      {warnings[key] && <span id={`warning-${key}`} className={styles.warning}>{warnings[key]}</span>}
      {key === "postal_code" && <>
        {postalNotice && <span className={styles.hint} role="status">{postalNotice}</span>}
        {addresses.length > 0 && <select aria-label="住所の候補" value="" onChange={event => { const address = addresses[Number(event.target.value)]; if (event.target.value && address) applyAddress(address); }}><option value="">住所の候補</option>{addresses.map((address, index) => <option value={String(index)} key={`${address.address}-${index}`}>{address.address}</option>)}</select>}
      </>}
      {key === "bank_name" && bankNotice && <span className={styles.hint} role="status">{bankNotice}</span>}
      {key === "bank_name" && bankChoices.length > 0 && <select aria-label="銀行の候補" value="" onChange={event => { const choice = bankChoices[Number(event.target.value)]; if (event.target.value && choice) applyBank(choice); }}><option value="">銀行の候補</option>{bankChoices.map((choice, index) => <option value={String(index)} key={`${choice.bankCode}-${index}`}>{choice.bankName}（{choice.bankCode}）</option>)}</select>}
      {key === "branch_name" && branchNotice && <span className={styles.hint} role="status">{branchNotice}</span>}
      {key === "branch_name" && branchChoices.length > 0 && <select aria-label="支店の候補" value="" onChange={event => { const choice = branchChoices[Number(event.target.value)]; if (event.target.value && choice) applyBranch(choice); }}><option value="">支店の候補</option>{branchChoices.map((choice, index) => <option value={String(index)} key={`${choice.branchCode}-${index}`}>{choice.branchName}（{choice.branchCode}）</option>)}</select>}
      {key === "my_number" && isMaskedMyNumber(values.my_number) && <button type="button" onClick={() => change("my_number", "")}>入れ直す</button>}
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
    <p className={styles.progress}>{STEPS.length}のうち {step + 1}番目</p>
    <h2 ref={heading} tabIndex={-1}>{STEPS[step]}</h2>
    <p className={styles.hint}>空欄のままでも進めます。分かる範囲で入力してください。</p>
    <form noValidate onSubmit={event => { event.preventDefault(); void save(step < STEPS.length - 1 ? step + 1 : undefined, step === STEPS.length - 1); }}>
      <fieldset disabled={busy} className={styles.fields}>
        {step !== 2 && step !== 9 && step !== 10 && STEP_FIELDS[step].filter(key => (key !== "employment_insurance_number" || values.employment_insurance_status === "yes") && (key !== "emergency_relation_other" || relationSelectValue(values.emergency_relation) === "その他")).map(field)}
        {step === 2 && <>
          <label className={styles.field}>扶養している家族はいますか<select value={hasFamily ? "yes" : "no"} onChange={event => { const yes = event.target.value === "yes"; setHasFamily(yes); setValues(previous => ({ ...previous, dependents: yes ? previous.dependents.length ? previous.dependents : [emptyDependent()] : [] })); }}><option value="no">いいえ</option><option value="yes">はい</option></select></label>
          {hasFamily && <>
            {values.dependents.map((person, index) => <fieldset className={styles.dependent} key={index}><legend>扶養家族 {index + 1}人目</legend>
              {DEPENDENT_FIELDS.map(key => <label className={styles.field} key={key}>{DEPENDENT_LABELS[key]}{key === "relation" ? relationshipSelect(person.relation, value => changeDependentRelation(index, value)) : <input value={person[key]} maxLength={2000} type={key === "birth_date" ? "date" : "text"} inputMode={key === "annual_income" ? "numeric" : undefined}
                onChange={event => setValues(previous => ({ ...previous, dependents: previous.dependents.map((entry, i) => i === index ? { ...entry, [key]: event.target.value } : entry) }))} />}{key === "relation" && relationSelectValue(person.relation) === "その他" && <input aria-label="続柄（その他）" value={person.relation === "その他" ? "" : person.relation} maxLength={2000} onChange={event => setValues(previous => ({ ...previous, dependents: previous.dependents.map((entry: Dependent, i) => i === index ? { ...entry, relation: event.target.value } : entry) }))} />}</label>)}
              <button type="button" onClick={() => setValues(previous => ({ ...previous, dependents: previous.dependents.filter((_, i) => i !== index) }))}>{index + 1}人目を消す</button>
            </fieldset>)}
            <button type="button" disabled={values.dependents.length >= 30} onClick={() => setValues(previous => ({ ...previous, dependents: [...previous.dependents, emptyDependent()] }))}>もう1人ふやす</button>
          </>}
        </>}
        {step === 5 && commuteRouteFields()}
        {step === 3 && <p>番号が分からないときは、次の画面で前の勤務先を教えてください。こちらで調べます。</p>}
        {step === 4 && <p>雇用保険の番号を調べるために使います。分かる範囲で大丈夫です。</p>}
        {step === 5 && <p>金額は分かる範囲で大丈夫です。こちらで確認して決めます。</p>}
        {step === 6 && <p>お給料の振込先です。通帳やアプリの表示どおりに入れてください。</p>}
        {step === 7 && <p className={styles.noticeLines}>税と社会保険の手続きにだけ使います。{"\n"}それ以外の目的では使いません。{"\n"}入力後は、下4桁だけが表示されます。</p>}
        {step === 8 && <p>災害や急なご病気のときの連絡先です。</p>}
        {step === 9 && <><div className={styles.pledge}>{NDA_FULL_TEXT}</div><label className={styles.agree}><input type="checkbox" checked={values.nda_agreed} onChange={event => setValues(previous => ({ ...previous, nda_agreed: event.target.checked }))} />内容を確認しました</label></>}
        {step === 10 && <OnboardingReview values={values} onEdit={index => void save(index)} />}
        <div className={styles.actions}>
          {step > 0 && <button type="button" onClick={() => void save(step - 1)}>戻る</button>}
          <button type="button" onClick={() => void save()}>途中保存</button>
          <button className={styles.primary} type="submit">{step === STEPS.length - 1 ? "提出する" : "次へ"}</button>
        </div>
      </fieldset>
      <p role="status" className={styles.saveStatus}>{busy ? "保存しています。" : notice}</p>
    </form>
    <p className={styles.hint}>画面を離れる前に「途中保存」を押してください。</p>
    <Link href="/system">Systemのホームへ戻る</Link>
  </section>;
}

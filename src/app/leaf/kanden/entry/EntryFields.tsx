"use client";

import { useState, type ReactNode } from "react";
import { ActionButton, CheckboxField, FieldGrid, FieldLabel, RadioGroup,
  ResultMessage, SelectField, TextArea, TextField } from "@/app/system/forms/_components/form-kit";
import { nextSupplyDay, supplyPoint, type CalendarDay } from "@/lib/leaf-kanden/supply-point";
import { performanceMonth } from "@/lib/leaf-kanden/status";
import { choiceFields, type EntryDraft, type EntryList } from "./entry";
import styles from "./entry.module.css";

type Field = readonly [key: keyof EntryDraft, label: string];
const sections: { number: number; label: string; fields: readonly Field[]; flag?: keyof EntryDraft }[] = [
  { number: 1, label: "関西電力の電気のお申込み情報（共通）", fields: [
    ["customer_kana", "フリガナ"], ["customer_name", "ご契約名義"], ["rep_kana", "代表者フリガナ"],
    ["rep_name", "代表者名"], ["phone", "電話番号"], ["address", "ご使用場所住所"],
    ["pay_address", "お支払先住所"], ["apply_date", "申込日"], ["plan", "ご希望契約"], ["usage", "用途区分"],
  ] },
  { number: 2, label: "お申込者情報", fields: [
    ["applicant_kana", "フリガナ"], ["applicant_name", "役職名・お名前"], ["applicant_tel", "電話番号"],
  ] },
  { number: 3, label: "現在の小売電気事業者（電灯）のご契約情報", fields: [
    ["prev_provider", "電気事業者名"], ["prev_kana", "フリガナ（名義）"], ["prev_name", "名義"],
    ["prev_customer_no", "電気お客様番号（14桁）"], ["prev_supply_22", "供給地点特定番号（22桁）"],
  ] },
  { number: 4, label: "請求書・振込用紙のご希望", fields: [["invoice", "請求書送付"], ["paper", "振込用紙"]] },
  { number: 5, label: "同意事項", fields: [
    ["consent_terms", "関西電力の供給約款に同意します"], ["consent_privacy", "個人情報の取扱いに同意します"],
    ["consent_cancel", "解約手続きを当社に委任します"],
  ] },
  { number: 6, label: "契約種別フラグ", fields: [["has_denki", "電灯"], ["has_douryoku", "動力"], ["has_gas", "ガス"]] },
  { number: 7, label: "電灯", flag: "has_denki", fields: [
    ["denki_supply_point", "供給地点特定番号（22桁）"], ["denki_customer_no", "お客様番号（14桁）"], ["capacity", "契約容量"],
  ] },
  { number: 8, label: "動力", flag: "has_douryoku", fields: [
    ["douryoku_supply_point", "供給地点特定番号（22桁）"], ["douryoku_customer_no", "お客様番号（14桁）"], ["capacity_douryoku", "契約容量（kW）"],
  ] },
  { number: 9, label: "ガス", flag: "has_gas", fields: [
    ["gas_customer_no", "ガスお客様番号"], ["gas_meter_no", "ガスメーター番号"], ["gas_supply_point", "ガス供給地点特定番号"],
  ] },
  { number: 0, label: "受注情報", fields: [
    ["kanri_no", "管理番号"], ["postal_code", "郵便番号"], ["acquisition", "区分"], ["urgent_sw", "至急SW"],
    ["sw_month", "至急SWの希望月"], ["jisseki_month", "実績月"], ["apply_code", "申込コード"],
    ["sales_name", "獲得営業担当"], ["clerk_name", "事務担当"],
    ...choiceFields.filter(([key]) => key !== "plan"), ["is_direct", "直営"], ["note", "備考"],
  ] },
];

const radioChoices: Partial<Record<keyof EntryDraft, string[]>> = {
  usage: ["家庭用", "工業用", "商業用", "その他"],
  invoice: ["紙請求書", "WEB明細"],
  paper: ["希望する", "希望しない"],
  acquisition: ["奪還", "囲込"],
};
const checkboxes = new Set(["consent_terms", "consent_privacy", "consent_cancel", "has_denki", "has_douryoku", "has_gas", "urgent_sw", "is_direct"]);
const requiredFields = new Set(["customer_kana", "customer_name", "phone", "address", "denki_supply_point",
  "denki_customer_no", "douryoku_supply_point", "douryoku_customer_no", "gas_customer_no"]);

export const searchSections = sections.map(({ label, fields }) => ({ label, fields }));

export function compareEntryField(current: EntryDraft[keyof EntryDraft], source: EntryDraft[keyof EntryDraft] | undefined) {
  if (source == null || source === "") return "new";
  const normalize = (value: unknown) => String(value ?? "").normalize("NFKC").trim();
  return normalize(current) === normalize(source) ? "match" : "different";
}

export function CopyIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d="M9 4H6a2 2 0 0 0-2 2v14h14v-3m-6-14h5v3h-5zM9 6h12v11H9z" />
  </svg>;
}

export function CheckIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="m5 12 4 4L19 6" />
  </svg>;
}

export const comparisonLabels = { match: "一致", different: "リスト≠申込書", new: "新規" };
export const comparisonSymbols = { match: "✓", different: "！", new: "＋" };

export default function EntryFields({ draft, setDraft, listValues, options, calendar, today, duplicateNumbers, specsAlert }: {
  draft: EntryDraft;
  setDraft: (draft: EntryDraft) => void;
  listValues: Partial<EntryDraft> | null;
  options?: EntryList["options"];
  calendar: CalendarDay[];
  today: string;
  duplicateNumbers: (middle: string) => string[];
  specsAlert: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState<number[]>([]);
  function change<K extends keyof EntryDraft>(key: K, value: EntryDraft[K]) {
    setDraft({ ...draft, [key]: value });
  }

  function field([key, label]: Field) {
    const value = draft[key];
    const source = listValues?.[key];
    const comparison = compareEntryField(value, source);
    const supplied = source != null && source !== "";
    const isSupply = key === "denki_supply_point" || key === "douryoku_supply_point" || key === "prev_supply_22";
    const point = isSupply && value ? supplyPoint(String(value)) : null;
    const date = point?.schedule ? nextSupplyDay(calendar, point.schedule, draft.entered_on ?? today) : null;
    const duplicates = point?.middle ? duplicateNumbers(point.middle) : [];
    const update = (next: string) => change(key, next || null);
    const choices = radioChoices[key];
    const lookup = options?.[key as typeof choiceFields[number][0]] ?? [];
    const planChoices = key === "plan" ? ["eおとくプラン", "eスマート10", "ビジネス電灯", "ビジネス動力", "-"] : [];
    const selectOptions = [...new Set([...planChoices, ...lookup, ...(value ? [String(value)] : []), ...(source ? [String(source)] : [])])];
    const required = requiredFields.has(key);
    let control: ReactNode;
    if (choices) {
      control = <RadioGroup name={key} label={label} options={choices} value={String(value ?? "")} onChange={update} />;
    } else if (checkboxes.has(key)) {
      control = <CheckboxField checked={key.startsWith("consent_") ? value === "true" : !!value}
        onChange={event => change(key, key.startsWith("consent_") ? String(event.target.checked) : event.target.checked)}>{label}</CheckboxField>;
    } else if (key === "note") {
      control = <TextArea aria-label={label} value={String(value ?? "")} onChange={event => update(event.target.value)} />;
    } else if (key === "sw_month") {
      control = <SelectField aria-label={label} value={String(value ?? "")}
        onChange={event => change(key, Number(event.target.value) || null)}>
        {Array.from({ length: 12 }, (_, index) => <option key={index} value={index + 1}>{index + 1}月</option>)}
      </SelectField>;
    } else if (planChoices.length || lookup.length) {
      control = <SelectField aria-label={label} value={String(value ?? "")} onChange={event => update(event.target.value)}>
        {selectOptions.map(choice => <option key={choice} value={choice}>{choice}</option>)}
      </SelectField>;
    } else {
      control = <TextField aria-label={label} aria-required={required || undefined} aria-invalid={!!point?.error}
        type={key === "apply_date" ? "date" : key === "jisseki_month" ? "month" : "text"}
        inputMode={isSupply ? "numeric" : undefined}
        value={String(key === "jisseki_month" ? (performanceMonth(draft) ?? "") : (value ?? ""))}
        onChange={event => update(event.target.value)} />;
    }
    return <div key={key} className={styles.field} data-comparison={comparison}>
      <FieldLabel label={checkboxes.has(key) ? "" : label} required={required}>
        {control}
        {point?.schedule && <small>日程 {point.schedule} ／ 供給開始予定 {date?.replaceAll("-", "/") ?? "該当日なし"}</small>}
        <ResultMessage>{point?.error}</ResultMessage>
        {!!duplicates.length && <ResultMessage>同じ供給地点の受注があります（管理番号 {duplicates.join("、")}）</ResultMessage>}
      </FieldLabel>
      <span className={styles.comparison} role="img" aria-label={comparisonLabels[comparison]}
        title={supplied ? `${comparisonLabels[comparison]}（リスト：${String(source)}）` : comparisonLabels[comparison]}>{comparisonSymbols[comparison]}</span>
      <ActionButton aria-label={`${label}をリストから転記`} title="リストから転記"
        disabled={!supplied} onClick={() => change(key, source!)}><CopyIcon /></ActionButton>
    </div>;
  }

  return sections.filter(section => !section.flag || draft[section.flag] || section.fields.some(([key]) => !!(draft[key] || listValues?.[key])))
    .map(({ number, label, fields, flag }) => <section className={styles.entrySection} key={number} id={flag ? `entry-${flag}` : undefined}>
      <header className={styles.sectionHead}>
        <h2>{number > 0 && <span className={styles.sectionNumber}>{number}</span>}{label}</h2>
        <div className={styles.sectionTools}>
          {flag && <ActionButton aria-expanded={!collapsed.includes(number)} onClick={() =>
            setCollapsed(current => current.includes(number) ? current.filter(value => value !== number) : [...current, number])}>
            {collapsed.includes(number) ? "開く" : "折りたたむ"}
          </ActionButton>}
          <ActionButton disabled={!fields.some(([key]) => listValues?.[key] != null && listValues?.[key] !== "")}
            onClick={() => setDraft({ ...draft, ...Object.fromEntries(fields.flatMap(([key]) => {
              const value = listValues?.[key];
              return value == null || value === "" ? [] : [[key, value]];
            })) })}><CopyIcon />セクション転記</ActionButton>
        </div>
      </header>
      <div className={styles.sectionBody} hidden={collapsed.includes(number)}>
        {number === 1 && specsAlert}
        <FieldGrid columns={2}>
          {fields.filter(([key]) => key !== "sw_month" || draft.urgent_sw).map(field)}
        </FieldGrid>
      </div>
    </section>);
}

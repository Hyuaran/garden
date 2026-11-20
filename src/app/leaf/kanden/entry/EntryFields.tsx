"use client";

import { ActionRow, CheckboxField, FieldGrid, FieldLabel, FormRow, RadioGroup,
  ResultMessage, SelectField, TextArea, TextField } from "@/app/system/forms/_components/form-kit";
import BoxSelect from "@/app/system/_components/BoxSelect/BoxSelect";
import { nextSupplyDay, supplyPoint, type CalendarDay } from "@/lib/leaf-kanden/supply-point";
import { choiceFields, dateFields, serviceFields, type EntryDraft, type EntryList, type TextKey } from "./entry";

type Props = {
  draft: EntryDraft;
  setDraft: (draft: EntryDraft) => void;
  options?: EntryList["options"];
  calendar: CalendarDay[];
  today: string;
  duplicateNumbers: (middle: string) => string[];
};

export default function EntryFields({ draft, setDraft, options, calendar, today, duplicateNumbers }: Props) {
  function change<K extends keyof EntryDraft>(key: K, value: EntryDraft[K]) {
    setDraft({ ...draft, [key]: value });
  }
  function text(key: TextKey, label: string, type = "text") {
    return <FieldLabel key={key} label={label}><TextField aria-label={label} type={type}
      value={draft[key] ?? ""} onChange={event => change(key, event.target.value || null)} /></FieldLabel>;
  }

  const serviceOptions = serviceFields.map(([value, label]) => ({ value, label }));
  return <>
    <FormRow label="受付内容" grouped>
      <FieldLabel label="区分"><RadioGroup name="acquisition" label="区分" options={["奪還", "囲込"]}
        value={draft.acquisition ?? ""} onChange={value => change("acquisition", value)} /></FieldLabel>
      <FieldLabel label="至急SW">
        <ActionRow>
          <RadioGroup name="urgent_sw" label="至急SW" options={["なし", "あり"]}
            value={draft.urgent_sw ? "あり" : "なし"} onChange={value => change("urgent_sw", value === "あり")} />
          {draft.urgent_sw && <SelectField aria-label="至急SWの希望月" value={draft.sw_month ?? ""}
            onChange={event => change("sw_month", Number(event.target.value) || null)}>
            {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1}月</option>)}
          </SelectField>}
        </ActionRow>
      </FieldLabel>
      <FieldGrid columns={2}>{text("kanri_no", "管理番号")}{text("ordered_on", "受注日", "date")}</FieldGrid>
      <BoxSelect label="獲得内容" value={serviceFields.filter(([field]) => draft[`has_${field}`]).map(([field]) => field)}
        options={serviceOptions} onChange={values => setDraft({ ...draft, has_denki: values.includes("denki"),
          has_douryoku: values.includes("douryoku"), has_gas: values.includes("gas") })} />
    </FormRow>
    <FormRow label="お客様情報" grouped>
      <FieldGrid columns={2}>{text("customer_name", "お客様名")}{text("customer_kana", "カナ")}</FieldGrid>
      <FieldGrid columns={2}>{text("postal_code", "郵便番号")}{text("phone", "電話", "tel")}</FieldGrid>
      {text("address", "住所")}
    </FormRow>
    {serviceFields.map(([service, label]) => {
      const key = `${service}_supply_point` as const;
      const point = draft[key];
      const result = point ? supplyPoint(point) : null;
      const duplicates = result?.middle ? [...new Set(duplicateNumbers(result.middle))] : [];
      const date = result?.schedule && service !== "gas"
        ? nextSupplyDay(calendar, result.schedule, draft.entered_on ?? today) : null;
      return <FormRow key={service} label={label} grouped>
        <FieldGrid columns={2}>
          {text(`${service}_customer_no`, `${label}のお客様番号`)}
          <FieldLabel label="供給地点特定番号"><TextField aria-label={`${label}の供給地点特定番号`}
            aria-invalid={service !== "gas" && !!result?.error} inputMode="numeric" value={point ?? ""}
            onChange={event => change(key, event.target.value || null)} />
            {service !== "gas" && <ResultMessage>{result?.error}</ResultMessage>}
          </FieldLabel>
        </FieldGrid>
        {service !== "gas" && result?.schedule && <small>日程 {result.schedule} ／ 供給開始予定 {date?.replaceAll("-", "/") ?? "該当日なし"}</small>}
        {!!duplicates.length && <ResultMessage>同じ供給地点の受注があります（管理番号 {duplicates.join("、")}）</ResultMessage>}
      </FormRow>;
    })}
    <FormRow label="契約と担当" grouped>
      <FieldGrid columns={2}>{choiceFields.map(([key, label]) => {
        const choices = [...new Set([...(options?.[key] ?? []), ...(draft[key] ? [draft[key]] : [])])];
        return <FieldLabel key={key} label={label}>
          {choices.length ? <SelectField aria-label={label} value={draft[key] ?? ""}
            onChange={event => change(key, event.target.value || null)}>
            {choices.map(value => <option key={value} value={value}>{value}</option>)}
          </SelectField> : <TextField aria-label={label} value={draft[key] ?? ""}
            onChange={event => change(key, event.target.value || null)} />}
        </FieldLabel>;
      })}</FieldGrid>
      <FieldGrid columns={2}>{text("sales_name", "受注者")}{text("clerk_name", "事務担当")}</FieldGrid>
      <CheckboxField checked={!!draft.is_direct} onChange={event => change("is_direct", event.target.checked)}>直営</CheckboxField>
    </FormRow>
    <FormRow label="管理日付" grouped>
      <FieldGrid columns={2}>{dateFields.filter(([key]) => key !== "ordered_on").map(([key, label]) => text(key, label, "date"))}</FieldGrid>
      <FieldLabel label="備考"><TextArea aria-label="備考" value={draft.note ?? ""}
        onChange={event => change("note", event.target.value || null)} /></FieldLabel>
    </FormRow>
  </>;
}

"use client";

import { ActionButton, ActionRow, FieldGrid, FieldLabel, FormRow, TextField } from "@/app/system/forms/_components/form-kit";
import SystemTabs from "@/app/system/_components/SystemTabs/SystemTabs";
import { dateFields, type SearchRefinement } from "./entry";
import { searchSections } from "./EntryFields";

export default function EntrySearch({ requests, setRequests, active, setActive, busy, canRefine, onSearch, onClose }: {
  requests: Record<string, string>[];
  setRequests: (requests: Record<string, string>[]) => void;
  active: number;
  setActive: (active: number) => void;
  busy: boolean;
  canRefine: boolean;
  onSearch: (scope: "all" | "tab" | SearchRefinement["mode"]) => void;
  onClose: () => void;
}) {
  const fields = [...searchSections, { label: "業務ステータス", fields: [...dateFields,
    ["paid_on", "入金日"], ["completed_on", "完了日"], ["status", "ステータス"], ["reason", "理由"]] }];
  return <form aria-label="案件の条件検索" onSubmit={event => { event.preventDefault(); onSearch("all"); }}>
    <ActionRow>
      <ActionButton type="submit" disabled={busy}>全案件を検索</ActionButton>
      <ActionButton disabled={busy} onClick={() => onSearch("tab")}>このタブを検索</ActionButton>
      {canRefine && <>
        <ActionButton disabled={busy} onClick={() => onSearch("constrain")}>検索結果を絞り込む</ActionButton>
        <ActionButton disabled={busy} onClick={() => onSearch("extend")}>検索結果に追加</ActionButton>
      </>}
      <ActionButton disabled={busy || requests.length >= 20} onClick={() => {
        setRequests([...requests, {}]);
        setActive(requests.length);
      }}>検索条件を追加</ActionButton>
      <ActionButton disabled={busy} onClick={() => {
        setRequests(requests.length === 1 ? [{}] : requests.filter((_, index) => index !== active));
        setActive(Math.max(0, active - 1));
      }}>検索条件を削除</ActionButton>
      <ActionButton disabled={busy} onClick={onClose}>検索を閉じる</ActionButton>
    </ActionRow>
    <p>同じ条件内はすべて一致、複数の条件はどれかに一致する案件を表示します。</p>
    <p>前方一致、==（完全一致）、*（任意の文字列）、&gt;・&lt;・&gt;=・&lt;=、...（範囲）、!（除外）、//（今日）を指定できます。</p>
    {requests.length > 1 && <SystemTabs aria-label="検索条件" pageActions={false}>
      {requests.map((_, index) => <button key={index} type="button" role="tab" aria-selected={index === active}
        onClick={() => setActive(index)}>検索条件 {index + 1}</button>)}
    </SystemTabs>}
    {fields.map(({ label, fields }) => <FormRow key={label} label={label} grouped>
      <FieldGrid columns={2}>{fields.map(([key, title]) => <FieldLabel key={key} label={title}>
        <TextField aria-label={title} value={requests[active]?.[key] ?? ""} maxLength={300}
          onChange={event => setRequests(requests.map((request, index) => index === active
            ? { ...request, [key]: event.target.value } : request))} />
      </FieldLabel>)}</FieldGrid>
    </FormRow>)}
  </form>;
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isRoleAtLeast, type GardenRole } from "@/app/root/_constants/types";
import { groupSitesByCompany, type CorporateSitesData } from "../_lib/sites-registry";
import styles from "../sites.module.css";

export type SiteNewsItem = {
  id: string;
  company_id: string;
  published_on: string;
  title: string;
  body: string;
  kind: "auto" | "manual";
  source_field: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

type FormState = {
  id?: string;
  published_on: string;
  title: string;
  body: string;
  is_published: boolean;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(): FormState {
  return { published_on: today(), title: "", body: "", is_published: true };
}

export function companiesForNews(data: CorporateSitesData) {
  return groupSitesByCompany(data)
    .map((group) => {
      const withId = group.sites.find((site) => site.company_id);
      return withId?.company_id ? { company_id: withId.company_id, company: group.company } : null;
    })
    .filter((item): item is { company_id: string; company: string } => Boolean(item));
}

async function fetchNews(companyId: string): Promise<SiteNewsItem[]> {
  const response = await fetch(`/api/system/sites/news?company_id=${encodeURIComponent(companyId)}`);
  const body = await response.json().catch(() => null) as { news?: SiteNewsItem[]; error?: string } | null;
  if (!response.ok) throw new Error(body?.error ?? "お知らせを読み込めませんでした");
  return body?.news ?? [];
}

function kindLabel(item: SiteNewsItem) {
  if (item.kind === "manual") return "手動";
  if (item.source_field === "address") return "自動（住所）";
  if (item.source_field === "representative") return "自動（代表者）";
  if (item.source_field === "company_name") return "自動（社名）";
  return "自動";
}

export default function SiteNewsPanel({ data, role }: { data: CorporateSitesData; role: GardenRole }) {
  const companies = useMemo(() => companiesForNews(data), [data]);
  const [companyId, setCompanyId] = useState(companies[0]?.company_id ?? "");
  const [items, setItems] = useState<SiteNewsItem[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canEdit = isRoleAtLeast(role, "manager");

  const load = useCallback(async (targetCompanyId = companyId) => {
    if (!targetCompanyId) return;
    try {
      setLoading(true);
      setError(null);
      setItems(await fetchNews(targetCompanyId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    load(companyId);
  }, [companyId, load]);

  async function save() {
    if (!form || !canEdit) return;
    const editing = Boolean(form.id);
    try {
      setSaving(true);
      setError(null);
      const response = await fetch(editing ? `/api/system/sites/news/${form.id}` : "/api/system/sites/news", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editing ? form : { ...form, company_id: companyId }),
      });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "保存できませんでした");
      setForm(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return <section className={styles.newsPanel} data-testid="site-news-panel">
    <div className={styles.newsToolbar}>
      <label>
        <span>会社</span>
        <select value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
          {companies.map((company) => <option key={company.company_id} value={company.company_id}>{company.company}</option>)}
        </select>
      </label>
      {canEdit ? <button type="button" className={styles.primaryButton} onClick={() => setForm(emptyForm())}>+ 追加</button> : null}
    </div>

    {error ? <p className={styles.errorText}>{error}</p> : null}
    <div className={styles.tableWrap}>
      <table>
        <thead>
          <tr><th>日付</th><th>題名</th><th>種別</th><th>公開</th><th></th></tr>
        </thead>
        <tbody>
          {loading ? <tr><td colSpan={5}>読込中...</td></tr> : null}
          {!loading && items.length === 0 ? <tr><td colSpan={5}>お知らせはありません</td></tr> : null}
          {!loading && items.map((item) => <tr key={item.id}>
            <td>{item.published_on}</td>
            <td>{item.is_published ? item.title : `（非公開）${item.title}`}</td>
            <td>{kindLabel(item)}</td>
            <td>{item.is_published ? "公開" : "非公開"}</td>
            <td>{canEdit ? <button type="button" className={styles.secondaryButton} onClick={() => setForm({
              id: item.id,
              published_on: item.published_on,
              title: item.title,
              body: item.body,
              is_published: item.is_published,
            })}>編集</button> : null}</td>
          </tr>)}
        </tbody>
      </table>
    </div>

    {form ? <div className={styles.modalBackdrop} role="presentation">
      <div className={styles.newsModal} role="dialog" aria-modal="true" aria-label={form.id ? "お知らせを編集" : "お知らせを追加"}>
        <h2>{form.id ? "お知らせを編集" : "お知らせを追加"}</h2>
        <label>日付<input type="date" value={form.published_on} onChange={(event) => setForm({ ...form, published_on: event.target.value })} /></label>
        <label>題名<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <label>本文<textarea rows={6} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></label>
        <label className={styles.checkLabel}><input type="checkbox" checked={form.is_published} onChange={(event) => setForm({ ...form, is_published: event.target.checked })} />公開する</label>
        <div className={styles.modalActions}>
          <button type="button" className={styles.secondaryButton} onClick={() => setForm(null)} disabled={saving}>キャンセル</button>
          <button type="button" className={styles.primaryButton} onClick={save} disabled={saving}>{saving ? "保存中..." : "保存"}</button>
        </div>
      </div>
    </div> : null}
  </section>;
}

"use client";
import { useEffect, useState } from "react";
import Modal from "../Modal/Modal";
import { useRouter } from "next/navigation";
import { TabActionButton } from "../SystemTabs/SystemTabs";
import ViewerPicker, { type ViewerEmployee } from "@/app/bud/_components/ViewerPicker/ViewerPicker";
import { GARDEN_ROLE_LABELS, GARDEN_ROLE_ORDER } from "@/app/root/_constants/types";
import { effectivePermission, type ViewPermission } from "@/lib/auth/view-permission";
import styles from "./view-permission.module.css";

type Settings = { settings: ViewPermission[]; employees: ViewerEmployee[]; updaters: {employee_id: string; name: string}[]; defaults: Record<string, string[]> };
export default function ViewPermissionButton({ pageKey, tabKey, tabLabel, admin, canAdd = false }: { pageKey: string; tabKey: string; tabLabel: string; admin: boolean; canAdd?: boolean }) {
  const moneyPage = pageKey.startsWith("bud-") || pageKey.startsWith("sprout-") || pageKey.startsWith("rill-") || pageKey.startsWith("bloom-");
  const router = useRouter();
  const [open, setOpen] = useState(false), [target, setTarget] = useState(tabKey);
  const [data, setData] = useState<Settings | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [roles, setRoles] = useState<string[]>([]), [people, setPeople] = useState<string[]>([]), [allowAdd, setAllowAdd] = useState(false);
  const [picking, setPicking] = useState(false);
  useEffect(() => {
    if (!data) return;
    const setting = effectivePermission(data.settings, pageKey, target);
    setRoles(setting?.roles ?? data.defaults[target] ?? []);
    setPeople(setting?.employee_ids ?? []);
    setAllowAdd(!moneyPage && (setting?.viewers_can_add ?? false));
  }, [data, target, pageKey, moneyPage]);
  if (!admin && (moneyPage || !canAdd)) return null;
  async function show() {
    setTarget(tabKey); setData(null); setError(""); setPicking(false); setOpen(true);
    try {
      const response = await fetch(`/api/system/view-permissions?page=${encodeURIComponent(pageKey)}&tab=${encodeURIComponent(tabKey)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setData(result);
    } catch (e) { setError(e instanceof Error ? e.message : "読み込めませんでした。"); }
  }
  async function change(action: "save" | "reset" | "add", employeeId?: string) {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/system/view-permissions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ page: pageKey, tab: target, action, roles, employeeIds: people, viewersCanAdd: allowAdd, employeeId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      router.refresh();
      window.dispatchEvent(new Event('garden:view-permissions-updated'));
      if (result.warning) setError(result.warning); else setOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : "保存できませんでした。"); }
    finally { setBusy(false); }
  }
  const stamp = data && effectivePermission(data.settings, pageKey, target);
  return <>
    {admin ? <TabActionButton icon="settings" label="見られる人の設定" onClick={() => void show()} /> : <button type="button" onClick={() => void show()}>＋ 人を追加</button>}
    {open && <Modal className={styles.dialog} title={admin ? "見られる人の設定" : "人を追加"} onClose={() => { if (!busy) setOpen(false); }}>
      {admin && <fieldset disabled={busy}><legend>対象</legend><label><input type="radio" name="scope" checked={target === ""} onChange={() => setTarget("")} />画面全体</label>{tabKey && <label><input type="radio" name="scope" checked={target === tabKey} onChange={() => setTarget(tabKey)} />このタブ「{tabLabel}」</label>}</fieldset>}
      {!data ? !error && <p role="status">読み込み中…</p> : <>
        {admin && <fieldset disabled={busy}><legend>役職</legend>{[...GARDEN_ROLE_ORDER].reverse().map(role => <label key={role}><input type="checkbox" checked={role === "super_admin" || roles.includes(role)} disabled={role === "super_admin"} onChange={event => setRoles(event.target.checked ? [...roles, role] : roles.filter(item => item !== role))} />{role === "manager" ? "責任者" : role === "staff" ? "社員" : GARDEN_ROLE_LABELS[role]}{role === "super_admin" && "（外せない）"}</label>)}</fieldset>}
        <h3>個人</h3>
        {admin ? <>
          <button type="button" disabled={busy} onClick={() => setPicking(value => !value)}>＋ 人を追加</button>
          <div className={styles.selected}>{people.map(id => <span key={id}>{data.employees.find(employee => employee.employee_id === id)?.name ?? id}<button type="button" aria-label={`${data.employees.find(employee => employee.employee_id === id)?.name ?? id}を外す`} disabled={busy} onClick={() => setPeople(values => values.filter(value => value !== id))}>×</button></span>)}</div>
          {picking && <ViewerPicker employees={data.employees} value={people} onChange={setPeople} disabled={busy} />}
        </> : <ViewerPicker employees={data.employees.filter(employee => !people.includes(employee.employee_id))} value={[]} onChange={ids => { if (ids[0]) void change("add", ids[0]); }} disabled={busy} />}
        {admin && <label><input type="checkbox" checked={allowAdd} disabled={busy || moneyPage} onChange={event => setAllowAdd(event.target.checked)} />見られる人が人を追加できる{moneyPage && (pageKey.startsWith("bud-") ? "（経理・収支はオフ）" : "（この画面ではオフ）")}</label>}
        {stamp && <p>最終変更：{data.updaters.find(person => person.employee_id === stamp.updated_by)?.name ?? stamp.updated_by} {new Date(stamp.updated_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>}
      </>}
      {error && <p role="alert">{error}</p>}
      <div className={styles.actions} data-modal-actions>{admin && <button disabled={!data || busy} onClick={() => void change("reset")}>既定に戻す</button>}<button disabled={busy} onClick={() => setOpen(false)} data-modal-action="secondary">閉じる</button>{admin && <button disabled={!data || busy} onClick={() => void change("save")} data-modal-action="primary">{busy ? "保存中…" : "保存"}</button>}</div>
    </Modal>}
  </>;
}

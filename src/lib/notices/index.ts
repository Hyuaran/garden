import type { SupabaseClient } from "@supabase/supabase-js";
import type { GardenRole } from "@/app/root/_constants/types";
export const NOTICE_KINDS = { feature: "新しい機能", improvement: "使い勝手の改善", fix: "不具合の修正" };
export type Notice = {
    id: string;
    kind: keyof typeof NOTICE_KINDS;
    title: string;
    body: string;
    before_text: string | null;
    after_text: string | null;
    manual_href: string | null;
    module: string;
    visible_roles: GardenRole[];
    status: "draft" | "published";
    published_at: string | null;
    created_at: string;
};
export type NoticeSnapshot = {
    employeeId: string;
    hireDate: string | null;
    notices: Notice[];
    readIds: string[];
    snoozedOn: string | null;
};
export function japanDate(now = new Date()): string { return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now); }
export function excludedNoticePath(path: string) { return path === "/login" || path.startsWith("/login/") || path === "/p" || path.startsWith("/p/") || path === "/access-denied" || path.includes("/present"); }
export function visibleNotices(notices: Notice[], role: GardenRole | null) { return notices.filter(n => n.status === "published" && (!n.visible_roles.length || (role !== null && n.visible_roles.includes(role)))).sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? "")); }
export function modalNotices(snapshot: NoticeSnapshot, role: GardenRole | null) { return visibleNotices(snapshot.notices, role).filter(n => !snapshot.readIds.includes(n.id) && (!snapshot.hireDate || (n.published_at && japanDate(new Date(n.published_at)) >= snapshot.hireDate))); }
export async function fetchNotices(client: SupabaseClient, userId: string): Promise<NoticeSnapshot> {
    const employee = await client.from("root_employees").select("employee_id, hire_date").eq("user_id", userId).is("deleted_at", null).maybeSingle();
    if (employee.error)
        throw employee.error;
    if (!employee.data)
        throw new Error("社員情報を確認できませんでした");
    const id = employee.data.employee_id as string;
    const [notices, reads, snooze] = await Promise.all([
        client.from("system_notices").select("*").order("published_at", { ascending: false, nullsFirst: false }),
        client.from("system_notice_reads").select("notice_id").eq("employee_id", id),
        client.from("system_notice_snoozes").select("snoozed_on").eq("employee_id", id).maybeSingle(),
    ]);
    for (const result of [notices, reads, snooze])
        if (result.error)
            throw result.error;
    return { employeeId: id, hireDate: employee.data.hire_date, notices: notices.data as Notice[], readIds: (reads.data ?? []).map(r => r.notice_id), snoozedOn: snooze.data?.snoozed_on ?? null };
}
export async function acknowledgeNotices(client: SupabaseClient, employeeId: string, ids: string[]) {
    if (!ids.length)
        return;
    const { error } = await client.from("system_notice_reads").upsert(ids.map(notice_id => ({ notice_id, employee_id: employeeId })), { onConflict: "notice_id,employee_id", ignoreDuplicates: true });
    if (error)
        throw error;
}
export async function snoozeNotices(client: SupabaseClient, employeeId: string, day = japanDate()) {
    const { error } = await client.from("system_notice_snoozes").upsert({ employee_id: employeeId, snoozed_on: day }, { onConflict: "employee_id" });
    if (error)
        throw error;
}
export async function publishNotice(client: SupabaseClient, id: string) {
    const { count, error } = await client.from("system_notices").update({ status: "published", published_at: new Date().toISOString() }, { count: "exact" }).eq("id", id).eq("status", "draft");
    if (error)
        throw error;
    if (count !== 1)
        throw new Error("公開できませんでした");
}

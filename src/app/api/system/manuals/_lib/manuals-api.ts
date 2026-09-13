import { NextResponse } from "next/server";

import { createServerClient } from "@/app/_lib/supabase/server";
import { GARDEN_ROLE_ORDER, isRoleAtLeast, type GardenRole } from "@/app/root/_constants/types";
import { findManual, findManualDoc, type ManualDefinition, type ManualDoc } from "@/app/system/manuals/_lib/manuals-registry";
import { isEmployeeActive } from "@/lib/auth/employee-access";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const MANUAL_BUCKET = "system-manuals";
export const MANUAL_SECURITY_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

export type ManualVersionRecord = {
  id: string;
  module: string;
  slug: string;
  file: string;
  storage_path: string;
  size: number | null;
  uploaded_by: string | null;
  uploaded_at: string;
  note?: string | null;
};

export function jsonError(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status, headers: MANUAL_SECURITY_HEADERS });
}

export function contentTypeForDoc(doc: ManualDoc) {
  return doc.kind === "html" ? "text/html; charset=utf-8" : "text/markdown; charset=utf-8";
}

export function currentStoragePath(manual: ManualDefinition, doc: ManualDoc) {
  return `${manual.storagePrefix}/${doc.file}`;
}

export function archivedStoragePath(manual: ManualDefinition, doc: ManualDoc, timestamp: string) {
  return `${manual.storagePrefix}/_versions/${doc.file}.${timestamp}`;
}

export function isSafeRegisteredFile(file: string) {
  return file.length > 0 && !file.includes("/") && !file.includes("\\") && !file.includes("..");
}

function validRole(value: unknown): GardenRole {
  return GARDEN_ROLE_ORDER.includes(value as GardenRole) ? value as GardenRole : "staff";
}

function displayName(employee: { name?: unknown } | null, user: { id: string; email?: string | null }) {
  const name = typeof employee?.name === "string" ? employee.name.trim() : "";
  return name || user.email || user.id;
}

export async function requireManualDocAccess(
  params: { module: string; slug: string; file: string },
  options: { superAdminOnly?: boolean } = {},
): Promise<
  | { ok: true; manual: ManualDefinition; doc: ManualDoc; user: { id: string; name: string; role: GardenRole } }
  | { ok: false; response: NextResponse }
> {
  const { module: moduleSlug, slug, file } = params;
  if (!isSafeRegisteredFile(file)) return { ok: false, response: jsonError(404, "manual not found") };

  const manual = findManual(moduleSlug, slug);
  const doc = manual ? findManualDoc(manual, file) : null;
  if (!manual || !doc) return { ok: false, response: jsonError(404, "manual not found") };

  const session = await createServerClient();
  const { data: auth } = await session.auth.getUser();
  if (!auth.user) return { ok: false, response: jsonError(401, "login required") };

  const { data: employee, error } = await session
    .from("root_employees")
    .select("name,garden_role,is_active,termination_date,deleted_at")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return { ok: false, response: jsonError(500, "employee role lookup failed") };
  if (!employee || !isEmployeeActive(employee)) return { ok: false, response: jsonError(403, "manual access denied") };

  const role = validRole(employee.garden_role);
  const requiredRole = options.superAdminOnly ? "super_admin" : doc.minRole;
  if (!isRoleAtLeast(role, requiredRole)) return { ok: false, response: jsonError(403, "manual access denied") };

  return { ok: true, manual, doc, user: { id: auth.user.id, name: displayName(employee, auth.user), role } };
}

export function timestampForVersion(date = new Date()) {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}${parts.second}`;
}

export function formatVersion(record: ManualVersionRecord) {
  return {
    id: record.id,
    uploaded_at: record.uploaded_at,
    uploaded_by: record.uploaded_by,
    size: record.size,
    storage_path: record.storage_path,
    note: record.note ?? null,
  };
}

type ManualVersionSelect = {
  eq(column: string, value: unknown): ManualVersionSelect;
  order(column: string, options?: { ascending?: boolean }): { limit(count: number): Promise<{ data: ManualVersionRecord[] | null; error: { message?: string } | null }> };
  maybeSingle<T>(): Promise<{ data: T | null; error: { message?: string } | null }>;
};

export function getManualAdmin() {
  return getSupabaseAdmin() as unknown as {
    from(table: string): {
      select(columns: string): ManualVersionSelect;
      insert(values: Record<string, unknown>): {
        select(columns: string): { single<T>(): Promise<{ data: T | null; error: { message?: string } | null }> };
      };
    };
    storage: {
      from(bucket: string): {
        download(path: string): Promise<{ data: Blob | null; error: { message?: string } | null }>;
        copy(from: string, to: string): Promise<{ data: unknown; error: { message?: string } | null }>;
        upload(path: string, body: Blob | ArrayBuffer, options?: { contentType?: string; upsert?: boolean }): Promise<{ data: unknown; error: { message?: string } | null }>;
      };
    };
  };
}

export async function insertVersionRecord(input: {
  module: string;
  slug: string;
  file: string;
  storagePath: string;
  size: number | null;
  uploadedBy: string;
  note?: string;
}) {
  const admin = getManualAdmin();
  const { data, error } = await admin
    .from("system_manual_versions")
    .insert({
      module: input.module,
      slug: input.slug,
      file: input.file,
      storage_path: input.storagePath,
      size: input.size,
      uploaded_by: input.uploadedBy,
      note: input.note ?? null,
    })
    .select("id,module,slug,file,storage_path,size,uploaded_by,uploaded_at,note")
    .single<ManualVersionRecord>();
  if (error || !data) throw new Error(error?.message ?? "version insert failed");
  return data;
}

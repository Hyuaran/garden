import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { hikariFigures, type HikariFigure } from "../_data/hikari-basics";
import { requireDocsUser } from "./company-doc.server";

export const HIKARI_FIGURE_URL_LIFETIME = 60 * 60;

export async function loadHikariBasicsFigures(): Promise<HikariFigure[]> {
  await requireDocsUser("/system/docs/hikari-basics");
  const signed = await Promise.all(hikariFigures.map(async figure => {
    try {
      const { data, error } = await getSupabaseAdmin().storage.from("system-docs")
        .createSignedUrl(`docs/hikari-basics/${figure.id}.webp`, HIKARI_FIGURE_URL_LIFETIME);
      return !error && data?.signedUrl ? { ...figure, src: data.signedUrl } : undefined;
    } catch {
      // 挿絵が取得できなくても本文は表示し、取得できた挿絵だけを表示する。
      return undefined;
    }
  }));
  return signed.filter(figure => figure !== undefined);
}

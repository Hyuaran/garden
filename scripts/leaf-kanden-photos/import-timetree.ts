import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { parseArgs } from "node:util";
import { normalizeKanriNo } from "../../src/lib/leaf-kanden/kanri-no";
import { buildPdf, selectEvents, storagePaths, type TimeTreeEvent } from "./import-timetree.core";

const bucket = "leaf-kanden-photos";
const setsTable = "leaf_kanden_photo_sets";
const photosTable = "leaf_kanden_photos";
const pageSize = 1000;
const maxBytes = 30 * 1024 * 1024;

type Failure = { eventId: string; objectKey?: string; stage: string; reason: string };

function isDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

function readEvents(json: string): TimeTreeEvent[] {
  const events = JSON.parse(json) as TimeTreeEvent[];
  if (!Array.isArray(events)) throw new Error("一覧は配列で指定してください");
  for (const [index, event] of events.entries()) {
    if (!event || typeof event.id !== "string" || !/^[\w-]+$/.test(event.id) ||
        (event.d !== "" && !isDate(event.d)) || typeof event.no !== "string" ||
        !Array.isArray(event.imgs) || event.imgs.some((image) =>
          !Array.isArray(image) || image.length !== 3 || typeof image[0] !== "string" ||
          !image[0].split("/").every((part) => part && part !== "." && part !== ".." && !part.includes("\\")) ||
          !image.slice(1).every((value) => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 2147483647))) {
      throw new Error(`一覧の ${index + 1} 件目の形式が不正です`);
    }
  }
  return events;
}

function integer(value: string, name: string, min: number): number {
  const number = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < min) {
    throw new Error(`--${name} は ${min} 以上の整数で指定してください`);
  }
  return number;
}

async function* pages<T>(read: (from: number, to: number) => PromiseLike<{
  data: T[] | null;
  error: unknown;
}>, stage: string) {
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await read(from, from + pageSize - 1);
    if (error || !data) throw new Error(stage);
    yield* data;
    if (data.length < pageSize) break;
  }
}

async function download(key: string): Promise<Uint8Array> {
  const url = new URL("https://attachments.timetreeapp.com/");
  // Keep the destination fixed even if a list entry contains URL syntax.
  url.pathname = "/" + key.split("/").map(encodeURIComponent).join("/");
  for (let attempt = 0; ; attempt++) {
    let response: Response | undefined;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(30_000), redirect: "error" });
      if (response.ok) return new Uint8Array(await response.arrayBuffer());
    } catch {
      if (attempt === 3) throw new Error("画像取得がタイムアウトまたは通信エラーで失敗");
    }
    if (response && !response.ok) {
      await response.body?.cancel().catch(() => undefined);
      if (attempt === 3 || (response.status !== 429 && response.status < 500)) {
        throw new Error(`画像取得 HTTP ${response.status}`);
      }
    }
    await delay(500 * 2 ** attempt);
  }
}

function imageType(key: string): string | undefined {
  switch (key.split(".").at(-1)?.toLowerCase()) {
    case "jpeg":
    case "jpg": return "image/jpeg";
    case "png": return "image/png";
    case "heic": return "image/heic";
  }
}

// Only locally authored messages may appear in the failure log.
async function atStage<T>(reason: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch {
    throw new Error(reason);
  }
}

async function importEvent(db: SupabaseClient, event: TimeTreeEvent, failures: Failure[]) {
  const setKey = `timetree:${event.id}`;
  const kanriNo = normalizeKanriNo(event.no);
  const eventDate = event.d || null;
  const paths = storagePaths(event);
  const storage = db.storage.from(bucket);
  const set = await atStage("まとまりの保存に失敗", async () => {
    const { data, error } = await db.from(setsTable).upsert({
      set_key: setKey, source: "timetree", timetree_event_id: event.id,
      event_date: eventDate, kanri_no: kanriNo,
    }, { onConflict: "set_key" }).select("id").single();
    if (error || !data) throw error;
    return data;
  });

  let imported = 0;
  for (const [key, width, height] of event.imgs) {
    try {
      const contentType = imageType(key);
      if (!contentType) throw new Error("対応外の画像形式");
      const imagePath = paths.image(key);
      const bytes = await download(key);
      if (bytes.byteLength > maxBytes) throw new Error("画像が 30 MiB を超過");
      await atStage("画像の保存に失敗", async () => {
        const { error } = await storage.upload(imagePath, bytes, { contentType, upsert: false });
        if (error && error.status !== 409 && error.statusCode !== "409" &&
            error.statusCode !== "Duplicate" && error.statusCode !== "ResourceAlreadyExists") throw error;
      });
      imported += await atStage("写メの行の保存に失敗", async () => {
        const { error } = await db.from(photosTable).insert({
          id: randomUUID(), set_id: set.id, source: "timetree", source_key: key,
          kanri_no: kanriNo, event_date: eventDate, width, height,
          bytes: bytes.byteLength, image_path: imagePath,
        });
        // 同じ写メが既に入っている（重複）なら数えずに進む。
        if (error?.code === "23505") return 0;
        if (error) throw error;
        return 1;
      });
    } catch (error) {
      failures.push({ eventId: event.id, objectKey: key, stage: "image",
        reason: error instanceof Error ? error.message : "画像処理に失敗" });
    }
  }

  try {
    const photos: Array<{ source_key: string; image_path: string }> = [];
    for await (const photo of pages((from, to) => db.from(photosTable)
      .select("source_key,image_path").eq("set_id", set.id)
      .order("source_key").range(from, to), "PDF 用の写メ一覧の取得に失敗")) {
      photos.push(photo);
    }
    if (!photos.length) return imported;

    const pdf = await atStage("PDF の組み立てに失敗", () => buildPdf(photos, async (path) => {
      const { data, error } = await storage.download(path);
      if (error || !data) throw error;
      return new Uint8Array(await data.arrayBuffer());
    }));
    if (pdf.byteLength > maxBytes) throw new Error("PDF が 30 MiB を超過");
    await atStage("PDF の保存に失敗", async () => {
      const { error } = await storage.upload(paths.pdf, pdf, {
        contentType: "application/pdf", upsert: true,
      });
      if (error) throw error;
    });
    await atStage("まとまりの PDF 情報の更新に失敗", async () => {
      const { error } = await db.from(setsTable).update({
        pdf_path: paths.pdf, photo_count: photos.length, updated_at: new Date().toISOString(),
      }).eq("id", set.id);
      if (error) throw error;
    });
  } catch (error) {
    failures.push({ eventId: event.id, stage: "pdf",
      reason: error instanceof Error ? error.message : "PDF 処理に失敗" });
  }
  return imported;
}

async function main() {
  const { values } = parseArgs({ options: {
    list: { type: "string" },
    limit: { type: "string" },
    from: { type: "string" },
    to: { type: "string" },
    concurrency: { type: "string", default: "4" },
    "dry-run": { type: "boolean" },
  } });
  if (!values.list) throw new Error("--list <json のパス> は必須です");
  const { from, to } = values;
  if ((from !== undefined && !isDate(from)) || (to !== undefined && !isDate(to)) ||
      (from && to && from > to)) {
    throw new Error("--from / --to の日付範囲が不正です");
  }
  const limit = values.limit === undefined ? undefined : integer(values.limit, "limit", 0);
  const concurrency = integer(values.concurrency, "concurrency", 1);
  const events = readEvents(await readFile(values.list, "utf8"));
  const selection = { from, to, limit };
  const keys = new Set<string>();

  if (values["dry-run"]) {
    const selected = selectEvents(events, keys, selection);
    const count = selected.reduce((sum, event) => sum + event.imgs.length, 0);
    const gigabytes = (count * (27 / 80_000)).toFixed(3);
    console.log(`予定 ${selected.length} 件・写メ ${count} 枚・推定 ${gigabytes} GB（取り込み済みを含む）`);
    return;
  }

  loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw new Error("Supabase の環境変数が不足しています");
  const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

  const counts = new Map<string, number>();
  for await (const photo of pages((start, end) => db.from(photosTable)
    .select("source_key,set_id").eq("source", "timetree")
    .order("source_key").range(start, end), "取り込み済み写メ一覧の取得に失敗")) {
    keys.add(photo.source_key);
    counts.set(photo.set_id, (counts.get(photo.set_id) ?? 0) + 1);
  }
  const repairKeys = new Set<string>();
  for await (const set of pages((start, end) => db.from(setsTable)
    .select("id,set_key,pdf_path,photo_count").eq("source", "timetree")
    .order("id").range(start, end), "まとまり一覧の取得に失敗")) {
    const count = counts.get(set.id) ?? 0;
    if (count && (!set.pdf_path || count !== set.photo_count)) repairKeys.add(set.set_key);
  }

  const selected = selectEvents(events, keys, selection, repairKeys);
  const failures: Failure[] = [];
  let next = 0;
  let completed = 0;
  let imported = 0;
  const progress = () => `予定 ${completed}/${selected.length}・写メ ${imported} 枚・失敗 ${failures.length}`;
  const worker = async () => {
    while (next < selected.length) {
      const event = selected[next++];
      try {
        imported += await importEvent(db, event, failures);
      } catch {
        for (const [objectKey] of event.imgs) {
          failures.push({ eventId: event.id, objectKey, stage: "set", reason: "まとまりの処理に失敗" });
        }
        if (!event.imgs.length) failures.push({ eventId: event.id, stage: "set", reason: "まとまりの処理に失敗" });
      }
      completed++;
      if (completed % 20 === 0) console.log(progress());
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, selected.length) }, worker));
  console.log(`合計 ${progress()}`);
  if (failures.length) {
    const directory = resolve("scripts/leaf-kanden-photos/logs");
    await mkdir(directory, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    await writeFile(resolve(directory, `failed-${timestamp}.json`), JSON.stringify(failures, null, 2) + "\n");
    process.exitCode = 1;
  }
}

main().catch(() => {
  console.error("取り込みを開始または完了できませんでした。引数、一覧ファイル、接続設定、ログ保存先を確認してください。");
  process.exitCode = 1;
});

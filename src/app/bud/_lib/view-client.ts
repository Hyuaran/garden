"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@/app/_lib/supabase/browser";
import { budPageKey } from "@/lib/auth/bud-view-scopes";
import { BUD_READ_TABLES } from "@/lib/auth/bud-view-data";

async function legacyWrite<T>(run: () => PromiseLike<T>) {
  const allowed = await fetch("/api/bud/view-write-access", { cache: "no-store" });
  if (!allowed.ok) return { data: null, error: { message: "操作する権限がありません", code: "42501" }, status: allowed.status, statusText: "Forbidden", count: null };
  return run();
}
function guardWrite<T extends object>(builder: T): T {
  return new Proxy(builder, { get(target, operation) {
    if (operation === "then") return (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
      legacyWrite(() => Promise.resolve(target)).then(resolve, reject);
    const value = Reflect.get(target, operation);
    return typeof value === "function" ? (...args: unknown[]) => {
      const next = value.apply(target, args);
      return next && typeof next === "object" ? guardWrite(next) : next;
    } : value;
  } });
}

/** select だけを閲覧 API へ送る。insert/update/delete/RPC は元のユーザー接続のまま。 */
export function createBudViewClient(pageKey?: string, tabKey?: string): SupabaseClient {
  const user = createBrowserClient();
  const read = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    accessToken: async () => (await user.auth.getSession()).data.session?.access_token ?? null,
    global: { fetch: async (input, init) => {
      const source = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      const page = pageKey ?? (typeof window !== "undefined" ? budPageKey(window.location.pathname) : undefined);
      const table = source.pathname.split("/").pop() ?? "";
      if (!page || !BUD_READ_TABLES[page]?.includes(table)) return fetch(input, init);
      const params = new URLSearchParams({ page, table, query: source.searchParams.toString() });
      if (tabKey) params.set("tab", tabKey);
      else if (page === "bud-statements") {
        const segment = window.location.pathname.split("/")[3];
        params.set("tab", ["imports", "summary"].includes(segment) ? segment : "list");
      }
      const headers = new Headers(init?.headers);
      headers.delete("authorization"); headers.delete("apikey");
      return fetch(`/api/bud/view-data?${params}`, { method: "GET", headers, signal: init?.signal, cache: "no-store" });
    } },
  });
  return new Proxy(user, {
    get(target, property) {
      if (property === "rpc") return (name: string, args: Record<string, unknown>) => {
        if (name !== "bud_expense_done_summary") return legacyWrite(() => target.rpc(name, args));
        return fetch("/api/bud/expense-summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(args) }).then(async response => {
          const result = await response.json();
          return response.ok ? { data: result.data, error: null } : { data: null, error: result.error ?? "閲覧権限がありません" };
        });
      };
      if (property === "storage") return new Proxy(target.storage, { get(storage, operation) {
        if (operation !== "from") { const value = Reflect.get(storage, operation); return typeof value === "function" ? value.bind(storage) : value; }
        return (bucket: string) => {
          const original = storage.from(bucket);
          return new Proxy(original, { get(files, action) {
            if (action === "createSignedUrl" && bucket === "bud-receipts" && pageKey === "bud-expenses") return async (path: string) => {
              const response = await fetch(`/api/bud/view-receipt?${new URLSearchParams({ path })}`, { cache: "no-store" });
              const result = await response.json();
              return response.ok ? { data: result.data, error: null } : { data: null, error: result.error };
            };
            if (["upload", "update", "remove", "move", "copy", "createSignedUploadUrl"].includes(String(action))) return (...args: unknown[]) => legacyWrite(() => Reflect.get(files, action).apply(files, args));
            const value = Reflect.get(files, action); return typeof value === "function" ? value.bind(files) : value;
          } });
        };
      } });
      if (property === "from") return (table: string) => {
        const builder = target.from(table);
        return new Proxy(builder, { get(query, operation) {
          if (operation === "select") return read.from(table).select.bind(read.from(table));
          if (["insert", "update", "upsert", "delete"].includes(String(operation))) return (...args: unknown[]) => guardWrite(Reflect.get(query, operation).apply(query, args));
          const value = Reflect.get(query, operation);
          return typeof value === "function" ? value.bind(query) : value;
        } });
      };
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

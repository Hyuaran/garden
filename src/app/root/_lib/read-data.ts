import { rootPageKey } from "@/lib/auth/root-view-scopes";

/** テーブル名・列名をクライアントから指定させず、画面の必要なデータだけ読む。 */
export async function readRootData<T>(dataset: string, fallbackPage: string, params: Record<string, string> = {}): Promise<T> {
  const page = typeof window === "undefined" ? fallbackPage : rootPageKey(window.location.pathname) ?? fallbackPage;
  const query = new URLSearchParams({ page, dataset, ...params });
  const response = await fetch(`/api/root/view-data?${query}`, { cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "読み込めませんでした。");
  return body.data as T;
}

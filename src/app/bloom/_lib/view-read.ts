/** 読み取り専用のサーバー API。書き込みは従来のブラウザ接続を維持する。 */
export async function bloomRead<T>(operation: string, args: Record<string, unknown> = {}): Promise<T> {
  const page = typeof window === 'undefined' ? '' : window.location.pathname;
  const res = await fetch('/api/bloom/read?' + new URLSearchParams({operation,page,args:JSON.stringify(args)}), {cache:'no-store'});
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'データを取得できませんでした');
  return data;
}

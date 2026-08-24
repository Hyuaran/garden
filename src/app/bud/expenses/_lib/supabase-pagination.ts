export const SUPABASE_PAGE_SIZE = 1000;

export type PageResult<T> = { data: T[] | null; error: { message?: string | null } | null };

export async function readAllSupabasePages<T>(
  readPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = SUPABASE_PAGE_SIZE,
) {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const result = await readPage(from, from + pageSize - 1);
    if (result.error) return { data: rows, error: result.error };
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return { data: rows, error: null };
  }
}

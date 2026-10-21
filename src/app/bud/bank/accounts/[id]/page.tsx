import TransactionDetail from "../../TransactionDetail";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ period?: string }> }) {
  const { id } = await params;
  const { period } = await searchParams;
  // MF の口座 id は「%2B」「%3D」などを含む。リンク側で変換した分は、本番では Next.js が戻して渡すが、
  // 開発用の画面では戻さずに渡す（2026-10-21 実測）。変換の跡「%25」が残っているときだけ 1 回戻す
  return <TransactionDetail id={id.includes("%25") ? decodeURIComponent(id) : id} initialPeriod={period} />;
}

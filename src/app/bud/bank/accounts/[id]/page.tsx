import TransactionDetail from "../../TransactionDetail";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ period?: string }> }) {
  const { id } = await params;
  const { period } = await searchParams;
  // MF の口座 id は「%2B」などを含むため、リンク側で変換した分をここで 1 回だけ戻す（戻さないと「表示できません」になる）
  return <TransactionDetail id={decodeURIComponent(id)} initialPeriod={period} />;
}

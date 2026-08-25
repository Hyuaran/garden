export type PostalDatasetStatus = { sourceDate: string | null; importedAt: string | null };

export function isPostalDatasetStale(sourceDate: string | null, now = new Date()) {
  if (!sourceDate) return true;
  const source = new Date(`${sourceDate}T00:00:00Z`);
  if (Number.isNaN(source.getTime())) return true;
  const staleAt = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + 2, source.getUTCDate()));
  return now.getTime() >= staleAt.getTime();
}

export function formatPostalDatasetDate(sourceDate: string | null) {
  if (!sourceDate) return "未取得";
  const [year, month, day] = sourceDate.split("-").map(Number);
  return `${year}年${month}月${day}日 時点`;
}

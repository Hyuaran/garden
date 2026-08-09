const RECORDS_PAGE_SIZE = 500;

type IdRecord = { $id?: { value: unknown } };

export async function collectAllRecords<T extends IdRecord>(fetchPage: (query: string) => Promise<T[]>) {
  const allRecords: T[] = [];
  let lastId: string | null = null;

  while (true) {
    const condition = lastId === null ? "" : `$id > ${lastId} `;
    const records = await fetchPage(`${condition}order by $id asc limit ${RECORDS_PAGE_SIZE}`);
    allRecords.push(...records);
    if (records.length < RECORDS_PAGE_SIZE) break;

    const nextLastId = records.at(-1)?.$id?.value;
    const normalized = typeof nextLastId === "string" || typeof nextLastId === "number" ? String(nextLastId) : "";
    if (!/^\d+$/.test(normalized) || (lastId !== null && BigInt(normalized) <= BigInt(lastId))) {
      throw new Error("Kintone全件取得で$idが進みませんでした");
    }
    lastId = normalized;
  }

  return allRecords;
}

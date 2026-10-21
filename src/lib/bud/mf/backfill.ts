import { MfClient } from "./client";
import { mergeAccounts } from "./balances";
import { storedTransactions } from "./sync";
import { fiscalYearLabel } from "./transactions";

export async function backfillPastYears(client: Pick<MfClient, "accounts" | "transactions">, store: (since: string, until: string, card: unknown[], bank: unknown[]) => Promise<void>, options: { now?: Date; completed?: Set<string>; onComplete?: (key: string) => Promise<void>; log?: (line: string) => void } = {}) {
  const now = options.now ?? new Date();
  const currentYear = Number(fiscalYearLabel(null, now).slice(0,4));
  const accounts = mergeAccounts(await client.accounts(), [], [], now.toISOString());
  for (let year = 2019; year < currentYear; year++) {
    for (const [since, until] of [[year + "-04-01", year + "-09-30"], [year + "-10-01", (year+1) + "-03-31"]]) {
      if (options.completed?.has(since)) continue;
      const rows = await client.transactions(since, until);
      const { card, bank } = storedTransactions(accounts, rows, now.toISOString());
      await store(since, until, card, bank);
      await options.onComplete?.(since);
      options.log?.(year + "年度 " + since + "~" + until + " 銀行 " + bank.length + "件 / カード " + card.length + "件");
    }
  }
}

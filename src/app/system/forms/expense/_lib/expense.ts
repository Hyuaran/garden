export const BUSINESSES = { nhk: ['NHK'], 'nhk-kanden': ['関電', '関電トス', 'NHK'], ueda: ['関電トス', 'NHK', 'ブレーカー', '取引先打合せ'] } as const;
export type ExpenseForm = keyof typeof BUSINESSES;
export const FORM_LABELS = { nhk: 'NHK', 'nhk-kanden': '関電・NHK', ueda: '上田基人 専用' };
export const PAYMENTS = ['現金', '会社クレジットカード'] as const;
export const PURPOSES = ['交通費 電車(現金)', '駐車場代', '宿泊費', 'ETC/高速代', '交通費', 'ガソリン代', 'PITAPA', '交通費 自転車レンタル', '備品代', '郵送代', '会食費', 'その他'] as const;
export type ExpenseInput = { form: ExpenseForm; business: string; payment: string; paid_on: string; amount: number; purpose: string; purpose_detail: string; note: string };
export type ExpenseReport = ExpenseInput & { id: string; created_at: string };
export function isExpenseForm(value: unknown): value is ExpenseForm { return typeof value === 'string' && Object.hasOwn(BUSINESSES, value); }
export function validateExpense(body: unknown): ExpenseInput | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (!isExpenseForm(b.form) || !(BUSINESSES[b.form] as readonly unknown[]).includes(b.business)) return null;
  if (!(PAYMENTS as readonly unknown[]).includes(b.payment) || !(PURPOSES as readonly unknown[]).includes(b.purpose)) return null;
  if (typeof b.paid_on !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.paid_on)) return null;
  const date = new Date(`${b.paid_on}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== b.paid_on) return null;
  if (typeof b.amount !== 'number' || !Number.isInteger(b.amount) || b.amount < 1 || b.amount > 2147483647) return null;
  if (b.purpose_detail !== undefined && typeof b.purpose_detail !== 'string') return null;
  if (b.note !== undefined && typeof b.note !== 'string') return null;
  const purpose_detail = String(b.purpose_detail ?? '').trim();
  if (b.purpose === 'その他' && !purpose_detail) return null;
  return { form: b.form, business: String(b.business), payment: String(b.payment), paid_on: b.paid_on, amount: b.amount, purpose: String(b.purpose), purpose_detail, note: String(b.note ?? '').trim() };
}
export function jstTimestamp(date = new Date()) { return new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 19).replace('T', ' '); }
export function expenseRecord(input: ExpenseInput, employeeNumber: string, createdAt: string) {
  return {
    ルックアップ: { value: employeeNumber }, 事業選択: { value: input.business }, ラジオボタン: { value: input.payment },
    日付: { value: input.paid_on }, 数値: { value: input.amount }, ラジオボタン_0: { value: input.purpose },
    文字列__1行__5: { value: input.purpose_detail }, 文字列__複数行__0: { value: input.note },
    文字列__1行__6: { value: input.paid_on.slice(0, 4) }, 文字列__1行__4: { value: input.paid_on.slice(0, 7).replace('-', '') },
    文字列__1行_: { value: jstTimestamp(new Date(createdAt)) },
  };
}
export function recentCombinations<T extends ExpenseInput>(reports: T[]) {
  const seen = new Set<string>();
  return reports.filter(row => { const key = JSON.stringify([row.purpose, row.purpose_detail, row.amount]); if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 10);
}

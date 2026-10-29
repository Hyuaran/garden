import { describe, expect, it } from 'vitest';
import { validateExpense, expenseRecord, recentCombinations } from './expense';
const input = { form: 'nhk' as const, business: 'NHK', payment: '現金', paid_on: '2026-10-29', amount: 430, purpose: '交通費', purpose_detail: '帰宅', note: '' };
describe('expense validation and mapping', () => {
  it('validates required fields, real dates, amounts and business combinations', () => {
    expect(validateExpense(input)).toEqual(input);
    for (const key of ['form','business','payment','paid_on','amount','purpose']) expect(validateExpense({ ...input, [key]: '' })).toBeNull();
    for (const amount of [0,-1,1.5,NaN,Infinity,2147483648,'430']) expect(validateExpense({ ...input, amount })).toBeNull();
    expect(validateExpense({ ...input, paid_on: '2026-02-30' })).toBeNull();
    expect(validateExpense({ ...input, purpose: 'その他', purpose_detail: ' ' })).toBeNull();
    expect(validateExpense({ ...input, business: '関電' })).toBeNull();
    expect(validateExpense({ ...input, form: 'ueda', business: '関電' })).toBeNull();
    expect(validateExpense({ ...input, form: 'ueda', business: 'ブレーカー' })).not.toBeNull();
    expect(validateExpense({ ...input, form: 'nhk-kanden', business: '関電' })).not.toBeNull();
  });
  it('maps only writable fields and formats JST seconds and settlement year/month', () => {
    expect(expenseRecord(input, '1508', '2026-10-29T01:19:00Z')).toEqual({
      ルックアップ: { value: '1508' }, 事業選択: { value: 'NHK' }, ラジオボタン: { value: '現金' }, 日付: { value: '2026-10-29' }, 数値: { value: 430 }, ラジオボタン_0: { value: '交通費' }, 文字列__1行__5: { value: '帰宅' }, 文字列__複数行__0: { value: '' }, 文字列__1行__6: { value: '2026' }, 文字列__1行__4: { value: '202610' }, 文字列__1行_: { value: '2026-10-29 10:19:00' },
    });
  });
  it('deduplicates combinations in newest order and limits to ten', () => {
    const rows = [input, input, ...Array.from({ length: 15 }, (_, i) => ({ ...input, amount: i + 1 }))];
    expect(recentCombinations(rows)).toHaveLength(10);
    expect(recentCombinations(rows)[0]).toEqual(input);
  });
});

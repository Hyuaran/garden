# T-F4-02: TaxCalendar.tsx 新規実装指示書（ローリング 12 ヶ月）

- 対象: Garden-Forest F4 Tax Calendar
- 見積: **1.0d**（約 8 時間）
- 担当セッション: a-forest
- 作成: 2026-04-24（a-auto / Phase A 先行 batch2 #T-F4-02）
- 元資料: `docs/specs/2026-04-24-forest-nouzei-tables-design.md`（P09）, `docs/specs/2026-04-24-forest-v9-vs-tsx-comparison.md` §4.4

---

## 1. スコープ

### 作る
- 新規 `TaxCalendar.tsx` — **ローリング 12 ヶ月**（前 5 + 当月 + 後 6）× **6 法人**のグリッド
- 各セルに確定納税 pill / 予定納税 pill / extra pill を重ね表示（v9 L1573-1677 準拠）
- 年境界の縦線・当月ハイライト・年ラベル（奇数/偶数で背景色違い）
- pill クリックで `onPillClick(scheduleId)` を呼ぶ（T-F11-01 連動）
- 過去月の pill は自動的に `paid` スタイル（薄緑）で表示

### 作らない
- pill の編集 UI（admin 向け別 spec）
- カレンダーのスクロール・期間変更（ローリング固定）
- 年次サマリビュー（別画面）

---

## 2. 前提

| 依存 | 内容 |
|---|---|
| **P09 migration 投入済** | `forest_nouzei_schedules / _items` + サンプルデータ 7 件 |
| 既存 `companies` テーブル | 法人色・短縮名・表示順 |
| T-F11-01 `TaxDetailModal` | 本コンポーネントの子（pill クリックから起動）|
| CSS | Tailwind 利用、v9 L231-338 の CSS を Tailwind に置換 |

---

## 3. ファイル構成

### 新規
- `src/app/forest/_components/TaxCalendar.tsx` — メインコンポーネント
- `src/app/forest/_components/TaxPill.tsx` — pill 単体コンポーネント
- `src/app/forest/_lib/tax-calendar.ts` — ローリング 12 ヶ月計算、年ラベルグループ化

### 変更
- `src/app/forest/_lib/queries.ts` — `fetchNouzeiCalendar(fromYm, toYm)` 追加
- `src/app/forest/_state/ForestStateContext.tsx` — `nouzeiSchedules` state 追加、refreshData に組込
- `src/app/forest/dashboard/page.tsx` — `<TaxCalendar>` の配置 + selectedScheduleId 管理

---

## 4. 型定義

```typescript
// src/app/forest/_lib/types.ts — T-F11-01 で追加済の NouzeiSchedule / NouzeiItem を再利用
export type NouzeiScheduleWithItems = NouzeiSchedule & {
  items: NouzeiItem[];
};

// tax-calendar.ts 内部型
export type MonthYear = { y: number; m: number };

export type YearGroup = {
  year: number;
  startIdx: number;      // monthYears 配列内の開始 index
  span: number;          // 該当年の月数（1〜12）
  bgClass: 'bg-zebra-a' | 'bg-zebra-b';
  labelClass: 'label-zebra-a' | 'label-zebra-b';
};

// 1 セル分の pill 集約
export type CalendarCellPills = {
  month: MonthYear;
  pills: Array<{
    scheduleId: string;
    kind: 'kakutei' | 'yotei' | 'extra';
    label: string;         // '確定' | '予定' | '予定（消費税）' 等
    amount: number | null;
    isPaid: boolean;       // 過去月 OR status=paid
  }>;
};
```

---

## 5. 実装ステップ

### Step 1: tax-calendar.ts のユーティリティ
```typescript
// src/app/forest/_lib/tax-calendar.ts
export function buildRolling12Months(now: Date = new Date()): MonthYear[] {
  const result: MonthYear[] = [];
  for (let i = -5; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    result.push({ y: d.getFullYear(), m: d.getMonth() + 1 });
  }
  return result;
}

export function buildYearGroups(monthYears: MonthYear[]): YearGroup[] {
  const groups: YearGroup[] = [];
  let currentYear = -1;
  for (let i = 0; i < monthYears.length; i++) {
    const my = monthYears[i];
    if (my.y !== currentYear) {
      groups.push({
        year: my.y,
        startIdx: i,
        span: 1,
        bgClass: groups.length % 2 === 0 ? 'bg-zebra-a' : 'bg-zebra-b',
        labelClass: groups.length % 2 === 0 ? 'label-zebra-a' : 'label-zebra-b',
      });
      currentYear = my.y;
    } else {
      groups[groups.length - 1].span++;
    }
  }
  return groups;
}

export function isPastMonth(ym: MonthYear, now: Date = new Date()): boolean {
  if (ym.y < now.getFullYear()) return true;
  if (ym.y === now.getFullYear() && ym.m < now.getMonth() + 1) return true;
  return false;
}

export function isCurrentMonth(ym: MonthYear, now: Date = new Date()): boolean {
  return ym.y === now.getFullYear() && ym.m === now.getMonth() + 1;
}

export function pivotSchedulesToCells(
  schedules: NouzeiScheduleWithItems[],
  monthYears: MonthYear[],
  companyId: string,
  now: Date = new Date(),
): CalendarCellPills[] {
  return monthYears.map(my => {
    const matching = schedules.filter(s =>
      s.company_id === companyId && s.year === my.y && s.month === my.m
    );
    const pills = matching.map(s => ({
      scheduleId: s.id,
      kind: s.kind,
      label: s.label,
      amount: s.total_amount,
      isPaid: s.status === 'paid' || isPastMonth(my, now),
    }));
    return { month: my, pills };
  });
}
```

### Step 2: queries.ts に fetchNouzeiCalendar 追加
```typescript
export async function fetchNouzeiCalendar(
  from: MonthYear, to: MonthYear,
): Promise<NouzeiScheduleWithItems[]> {
  const { data, error } = await supabase
    .from('forest_nouzei_schedules')
    .select(`*, items:forest_nouzei_items(*)`)
    .gte('year', from.y).lte('year', to.y)
    .order('year').order('month').order('company_id');

  if (error) throw new Error(`fetchNouzeiCalendar: ${error.message}`);
  // クライアント側で from/to の月次範囲フィルタ
  return (data ?? []).filter((s: NouzeiScheduleWithItems) => {
    const afterFrom = s.year > from.y || (s.year === from.y && s.month >= from.m);
    const beforeTo  = s.year < to.y   || (s.year === to.y   && s.month <= to.m);
    return afterFrom && beforeTo;
  });
}
```

### Step 3: TaxPill コンポーネント
```typescript
// src/app/forest/_components/TaxPill.tsx
'use client';
import { fmtYen } from '../_lib/format';

type Props = {
  kind: 'kakutei' | 'yotei' | 'extra';
  label: string;
  amount: number | null;
  isPaid: boolean;
  onClick?: () => void;
};

export function TaxPill({ kind, label, amount, isPaid, onClick }: Props) {
  const bgClass = isPaid
    ? 'bg-[#a3b18a]'                                    // paid: 薄緑
    : kind === 'kakutei' ? 'bg-[#e07a7a]'               // 確定: 赤系
    : kind === 'yotei'   ? 'bg-[#c9a84c]'               // 予定: 黄系
    : 'bg-[#c9a84c]';                                   // extra: 予定と同色

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-label={`${label}${isPaid ? '（納付済）' : ''} ${amount ? fmtYen(amount) : ''}`}
      className={`inline-flex flex-col items-center justify-center text-[0.58rem] font-semibold px-2 py-1 rounded-[10px] text-white whitespace-nowrap min-w-[52px] min-h-[38px] ${bgClass} ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : 'cursor-default'}`}
    >
      <span>{label}</span>
      {amount != null && <span className="text-[0.54rem] font-normal mt-[1px]">{fmtYen(amount)}</span>}
    </button>
  );
}
```

### Step 4: TaxCalendar コンポーネント本体
```typescript
// src/app/forest/_components/TaxCalendar.tsx
'use client';
import { useMemo } from 'react';
import type { Company } from '../_constants/companies';
import type { NouzeiScheduleWithItems } from '../_lib/types';
import {
  buildRolling12Months,
  buildYearGroups,
  isCurrentMonth,
  pivotSchedulesToCells,
} from '../_lib/tax-calendar';
import { TaxPill } from './TaxPill';

type Props = {
  companies: Company[];
  schedules: NouzeiScheduleWithItems[];
  onPillClick: (scheduleId: string) => void;
};

export function TaxCalendar({ companies, schedules, onPillClick }: Props) {
  const now = useMemo(() => new Date(), []);
  const monthYears = useMemo(() => buildRolling12Months(now), [now]);
  const yearGroups = useMemo(() => buildYearGroups(monthYears), [monthYears]);

  // companies のうち実データがあるもの順、ただし Forest の既存表示順を優先
  const orderedCompanies = companies;

  return (
    <section className="bg-white/60 backdrop-blur-sm rounded-[18px] p-7 mb-7 border border-emerald-900/[0.08] shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
      <h2 className="text-xl font-bold text-emerald-900 flex items-center gap-2.5 mb-5 pb-3 border-b-2 border-[#d8f3dc]">
        納税カレンダー
      </h2>

      <div
        className="grid text-[0.72rem]"
        style={{
          gridTemplateColumns: '130px repeat(12, minmax(0, 1fr))',
        }}
      >
        {/* 年ラベル行 */}
        <div />
        {yearGroups.map(g => (
          <div
            key={`yl-${g.year}`}
            className={`text-center font-bold text-[0.75rem] text-emerald-900 py-1 ${g.labelClass === 'label-zebra-a' ? 'bg-emerald-900/[0.04]' : 'bg-emerald-900/[0.04] border-l border-emerald-900/[0.18]'}`}
            style={{ gridColumn: `span ${g.span}` }}
          >
            {g.year}年
          </div>
        ))}

        {/* 月ヘッダー行 */}
        <div />
        {monthYears.map((my, idx) => {
          const isCur = isCurrentMonth(my, now);
          const isYearStart = idx > 0 && monthYears[idx - 1].y !== my.y;
          return (
            <div
              key={`mh-${my.y}-${my.m}`}
              className={`text-center font-semibold text-[#5a7a5a] py-1 border-b-2 border-[#d8f3dc]
                ${isCur ? 'bg-[#daa520]/10 rounded-t-md' : ''}
                ${isYearStart ? 'border-l border-emerald-900/[0.18]' : ''}`}
            >
              {my.m}月
            </div>
          );
        })}

        {/* 法人行 */}
        {orderedCompanies.map(c => {
          const cells = pivotSchedulesToCells(schedules, monthYears, c.id, now);
          return (
            <CompanyRow
              key={c.id}
              company={c}
              cells={cells}
              yearGroups={yearGroups}
              onPillClick={onPillClick}
              now={now}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-3 text-[0.7rem] text-[#7a9a7a]">
        <LegendDot color="#a3b18a" label="納付済" />
        <LegendDot color="#c9a84c" label="予定納税" />
        <LegendDot color="#e07a7a" label="確定納税" />
      </div>
    </section>
  );
}

function CompanyRow({ company, cells, yearGroups, onPillClick, now }: any) {
  return (
    <>
      {/* 法人名セル */}
      <div className="font-semibold text-[#2c3e2c] px-3 py-2 flex items-center gap-1.5 border-b border-emerald-900/[0.06] whitespace-nowrap min-h-[52px]">
        <span className="w-2 h-2 rounded-full" style={{ background: company.color }} />
        {company.short}
      </div>
      {/* 12 セル */}
      {cells.map(({ month: my, pills }: CalendarCellPills, idx: number) => {
        const isCur = isCurrentMonth(my, now);
        const isYearStart = idx > 0 && cells[idx - 1].month.y !== my.y;
        return (
          <div
            key={`${company.id}-${my.y}-${my.m}`}
            className={`px-1 py-1.5 text-center border-b border-emerald-900/[0.06] flex flex-col items-center justify-center gap-1 min-h-[52px]
              ${isCur ? 'bg-[#daa520]/[0.05]' : ''}
              ${isYearStart ? 'border-l border-emerald-900/[0.18]' : ''}`}
          >
            {pills.map(pill => (
              <TaxPill
                key={pill.scheduleId}
                kind={pill.kind}
                label={pill.label === '確定' ? '確定' : pill.label === '予定' ? '予定' : pill.label}
                amount={pill.amount}
                isPaid={pill.isPaid}
                onClick={() => onPillClick(pill.scheduleId)}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
      {label}
    </div>
  );
}
```

### Step 5: dashboard/page.tsx に配置
```tsx
// dashboard/page.tsx に追加
const { nouzeiSchedules } = useForestState();
const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);

// SummaryCards の直後、MacroChart の前
<TaxCalendar
  companies={companies}
  schedules={nouzeiSchedules}
  onPillClick={(id) => setSelectedScheduleId(id)}
/>

{selectedScheduleId && (
  <TaxDetailModal
    scheduleId={selectedScheduleId}
    company={companies.find(c => c.id === /* ... */) ?? companies[0]}
    onClose={() => setSelectedScheduleId(null)}
  />
)}
```
※ `company` の解決は `nouzeiSchedules` から `scheduleId` で検索する補助関数が必要。

### Step 6: 手動テスト
1. 現在時刻ベースで 12 ヶ月表示、当月がハイライト
2. ヒュアラン 11月（予定 2,324,000）→ pill 表示、クリックで TaxDetailModal
3. ARATA 1月（確定 810,900、過去）→ paid スタイル（薄緑）
4. リンクサポート 4月（extra）→ pill 表示
5. データ無し法人（壱除く）→ 空セル
6. 年境界（2025 → 2026）で年ラベル + 縦線表示

---

## 6. データソース

| 種類 | 情報源 | 取得範囲 |
|---|---|---|
| Supabase | `forest_nouzei_schedules` + `items` | ローリング 12 ヶ月の期間に合致する行 |
| 既存 state | `companies` | 表示順・色・短縮名 |

---

## 7. UI 仕様

### レイアウト（v9 準拠）
- Grid: `130px repeat(12, 1fr)` = 法人名列 + 12 月列
- 年ラベル行（gridColumn span で年ごと）
- 月ヘッダー行（当月は黄色ハイライト）
- 法人行（6 法人、各セル min-height 52px）

### 色（Tailwind 化）
| 要素 | v9 | Tailwind |
|---|---|---|
| 背景ストライプ | `rgba(45,106,79,0.02)` | `bg-emerald-900/[0.02]` or `[0.04]` |
| 年境界 | `1.5px solid rgba(45,106,79,0.18)` | `border-l border-emerald-900/[0.18]` |
| 当月 | `rgba(218,165,32,0.1)` | `bg-[#daa520]/10` |
| 確定 pill | `#e07a7a` | `bg-[#e07a7a]` |
| 予定 pill | `#c9a84c` | `bg-[#c9a84c]` |
| paid pill | `#a3b18a` | `bg-[#a3b18a]` |

### レスポンシブ
- 768px 以下: カレンダー全体を `overflow-x-auto` でラップ（T-F9 の scroll-sync は本 spec 範囲外）
- モバイルでは最小幅を確保（`min-w-[900px]`）

---

## 8. エラーハンドリング

| # | 想定 | 対応 |
|---|---|---|
| E1 | `fetchNouzeiCalendar` 失敗 | `nouzeiSchedules=[]` で空カレンダー表示、他 section は影響なし |
| E2 | 当月境界を跨ぐタイムゾーン不一致 | `new Date()` は UTC 基準なので JST の日付計算に注意。必要なら `getJSTNow()` 補助関数 |
| E3 | pill 重複（同月に確定と予定が同時）| 縦並びで両方表示（v9 準拠）|
| E4 | 存在しない company_id | companies に含まれないため表示されない |

---

## 9. 権限・RLS

P09 準拠:
- **SELECT**: `forest_is_user()`
- 本 spec は read-only

---

## 10. テスト観点（§16 7種テスト）

| # | テスト種別 | 観点 |
|---|---|---|
| 1 | 機能網羅 | 6 シナリオ（Step 6）|
| 2 | エッジケース | 月初・月末・年末年始の境界、12月→1月 |
| 3 | 権限 | forest_user のみ閲覧可 |
| 4 | データ境界 | pill 0/1/2/3 個、極大金額、長い label |
| 5 | パフォーマンス | 6 法人 × 12 ヶ月 = 72 セル、200ms 以内レンダリング |
| 6 | Console | 警告なし（key 重複注意）|
| 7 | a11y | 表構造を `role="table"` / `role="row"` / `role="cell"` で補強推奨 |

---

## 11. 関連参照

- **P09 テーブル設計**: [docs/specs/2026-04-24-forest-nouzei-tables-design.md](2026-04-24-forest-nouzei-tables-design.md)
- **T-F11-01 TaxDetailModal**: 本コンポーネントの子モーダル（同 Batch 2）
- **v9 HTML L1573-1677** `renderTaxCalendar()` 関数 / **L231-338** CSS
- **P07 §4.4**: F4 Tax Calendar 差分
- **既存 `_constants/companies.ts`** — companies 型・色定数

---

## 12. 判断保留

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判1 | 年月範囲を props で変更可能にするか | **当面固定**（ローリング 12 ヶ月のみ）、将来画面右上に prev/next 矢印追加可 |
| 判2 | カレンダー内 drag-and-drop で pill 移動 | **非対応**（移動は admin UI で）|
| 判3 | スクロールで過去年表示 | **未対応**（Phase A 後の検討。history タブで代替）|
| 判4 | モバイル時に縦並びレイアウトに切替 | **横スクロール維持**（情報量を優先）|
| 判5 | Tailwind の任意値（`bg-[#xxx]`）を theme に抽出 | Phase B 以降で共通化 |

— end of T-F4-02 spec —

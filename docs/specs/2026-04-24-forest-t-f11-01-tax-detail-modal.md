# T-F11-01: TaxDetailModal 新規実装指示書

- 対象: Garden-Forest F11 Tax Detail Modal
- 見積: **0.5d**（約 4 時間）
- 担当セッション: a-forest
- 作成: 2026-04-24（a-auto / Phase A 先行 batch2 #T-F11-01）
- 元資料: `docs/specs/2026-04-24-forest-nouzei-tables-design.md`（P09）, `docs/specs/2026-04-24-forest-v9-vs-tsx-comparison.md` §4.11

---

## 1. スコープ

### 作る
- 新規 `TaxDetailModal.tsx` コンポーネント
- 納税スケジュール 1 件（`forest_nouzei_schedules` 1 行 + `forest_nouzei_items` N 行）を表示
- 法人色ドット + 法人名 + 種別ラベル（確定/予定/extra）+ 済/未納バッジ
- サブ行: `YYYY年M月末 期限`
- 税目内訳テーブル（label ×  amount）+ **2 件以上なら合計行**
- 添付ファイル（`forest_nouzei_files`）があればリンク一覧（signedURL）

### 作らない
- 編集 UI（本 spec は表示専用。編集は別 spec）
- 新規作成 UI（`create_nouzei_schedule()` 直接呼出は別タスク）
- 税目の追加・並替

---

## 2. 前提

| 依存 | 内容 |
|---|---|
| **P09 migration 投入済** | `forest_nouzei_schedules / _items / _files` + サンプルデータ 7 件 |
| **P09 関数投入済** | `create_nouzei_schedule()`, `mark_nouzei_paid()` PL/pgSQL |
| T-F4-02 `TaxCalendar` | 本モーダルの呼出元。カレンダーの pill クリックで起動 |
| 既存 `companies` テーブル | 法人名・色の取得元 |
| 既存スタイル | Forest 流用（グリーン系、インラインスタイル or Tailwind）|

---

## 3. ファイル構成

### 新規
- `src/app/forest/_components/TaxDetailModal.tsx`

### 変更
- `src/app/forest/_lib/queries.ts` — `fetchNouzeiDetail` 関数追加
- `src/app/forest/_lib/types.ts` — `NouzeiSchedule` / `NouzeiItem` / `NouzeiFile` 型追加
- `src/app/forest/dashboard/page.tsx` — TaxDetailModal のマウント（open state 管理、T-F4-02 と連動）

---

## 4. 型定義

```typescript
// src/app/forest/_lib/types.ts 追加
export type NouzeiKind = 'kakutei' | 'yotei' | 'extra';
export type NouzeiStatus = 'pending' | 'paid' | 'postponed' | 'deferred';

export type NouzeiItem = {
  id: string;
  schedule_id: string;
  label: string;
  amount: number;
  sort_order: number;
  created_at: string;
};

export type NouzeiFile = {
  id: string;
  schedule_id: string;
  doc_name: string;
  storage_path: string;
  uploaded_by: string | null;
  uploaded_at: string;
};

export type NouzeiSchedule = {
  id: string;
  company_id: string;
  kind: NouzeiKind;
  label: string;                // '確定' / '予定' / '予定（消費税）' 等
  year: number;
  month: number;
  due_date: string;             // YYYY-MM-DD
  total_amount: number | null;
  status: NouzeiStatus;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type NouzeiScheduleDetail = NouzeiSchedule & {
  items: NouzeiItem[];
  files: NouzeiFile[];
};

// ステータスの日本語ラベル
export const NOUZEI_STATUS_LABELS: Record<NouzeiStatus, string> = {
  pending:   '未納',
  paid:      '納付済',
  postponed: '猶予',
  deferred:  '延納',
};
```

---

## 5. 実装ステップ

### Step 1: queries.ts に fetchNouzeiDetail 追加
```typescript
// src/app/forest/_lib/queries.ts
export async function fetchNouzeiDetail(scheduleId: string): Promise<NouzeiScheduleDetail | null> {
  const { data, error } = await supabase
    .from('forest_nouzei_schedules')
    .select(`
      *,
      items:forest_nouzei_items(*),
      files:forest_nouzei_files(*)
    `)
    .eq('id', scheduleId)
    .maybeSingle();

  if (error) throw new Error(`fetchNouzeiDetail(${scheduleId}): ${error.message}`);
  if (!data) return null;

  const withSorted = {
    ...data,
    items: [...(data.items ?? [])].sort((a: NouzeiItem, b: NouzeiItem) => a.sort_order - b.sort_order),
    files: [...(data.files ?? [])].sort((a: NouzeiFile, b: NouzeiFile) => b.uploaded_at.localeCompare(a.uploaded_at)),
  };
  return withSorted as NouzeiScheduleDetail;
}

// Storage 署名 URL（添付ファイルのプレビュー）
export async function createNouzeiFileSignedUrl(storagePath: string, expiresInSec = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from('forest-tax').createSignedUrl(storagePath, expiresInSec);
  if (error) throw new Error(`createNouzeiFileSignedUrl: ${error.message}`);
  return data.signedUrl;
}
```

### Step 2: TaxDetailModal の骨組
```typescript
// src/app/forest/_components/TaxDetailModal.tsx
'use client';

import { useEffect, useState } from 'react';
import type { Company, NouzeiScheduleDetail } from '../_lib/types';
import { fetchNouzeiDetail, createNouzeiFileSignedUrl } from '../_lib/queries';
import { fmtYen } from '../_lib/format';
import { NOUZEI_STATUS_LABELS } from '../_lib/types';
import { C } from '../_constants/colors';

type Props = {
  scheduleId: string;
  company: Company;        // 法人色・短縮名のため
  onClose: () => void;
};

export function TaxDetailModal({ scheduleId, company, onClose }: Props) {
  const [detail, setDetail] = useState<NouzeiScheduleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchNouzeiDetail(scheduleId)
      .then(async result => {
        if (cancelled) return;
        setDetail(result);
        // ファイルがあれば signedUrl をまとめて取得
        if (result?.files.length) {
          const urls: Record<string, string> = {};
          for (const f of result.files) {
            try {
              urls[f.id] = await createNouzeiFileSignedUrl(f.storage_path, 3600);
            } catch (e) {
              console.error('[TaxDetailModal] signedUrl for', f.id, e);
            }
          }
          if (!cancelled) setSignedUrls(urls);
        }
      })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [scheduleId]);

  // Esc で閉じる
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  if (loading || !detail) {
    return (
      <div onClick={onClose} style={overlayStyle}>
        <div onClick={e => e.stopPropagation()} style={{ ...boxStyle, maxWidth: 340 }}>
          {error ? `エラー: ${error}` : '読み込み中…'}
        </div>
      </div>
    );
  }

  const isPaid = detail.status === 'paid';
  const yen = (v: number | null) => fmtYen(v);

  return (
    <div onClick={onClose} style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby={`tax-title-${detail.id}`}>
      <div onClick={e => e.stopPropagation()} style={{ ...boxStyle, maxWidth: 340 }}>
        {/* タイトル行 */}
        <div id={`tax-title-${detail.id}`} style={titleStyle}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: company.color, display: 'inline-block', flexShrink: 0 }} />
          {company.short}　{detail.label}
          {isPaid && <span style={{ color: '#d63031', marginLeft: 6 }}>済み</span>}
        </div>
        <div style={subStyle}>{detail.year}年{detail.month}月末 期限</div>

        {/* 税目内訳テーブル */}
        <div style={gridStyle}>
          {detail.items.map(item => (
            <>
              <div key={item.id + '-l'} style={labelStyle}>{item.label}</div>
              <div key={item.id + '-v'} style={valStyle}>{item.amount.toLocaleString()}円</div>
            </>
          ))}
          {detail.items.length > 1 && (
            <>
              <div key="divider" style={{ gridColumn: '1 / -1', borderTop: '1px solid #e0e0e0', margin: '2px 0' }} />
              <div style={totalLabelStyle}>合計</div>
              <div style={totalValStyle}>{(detail.total_amount ?? 0).toLocaleString()}円</div>
            </>
          )}
          {detail.items.length === 0 && (
            <div style={{ gridColumn: '1 / -1', fontSize: 12, color: FOREST_THEME.textMuted, padding: '12px 0' }}>
              税目内訳未入力（金額未確定）
            </div>
          )}
        </div>

        {/* 添付ファイル */}
        {detail.files.length > 0 && (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #e0e0e0' }}>
            <div style={{ fontSize: 12, color: FOREST_THEME.textMuted, fontWeight: 600, marginBottom: 6 }}>添付</div>
            {detail.files.map(f => (
              <a key={f.id} href={signedUrls[f.id] ?? '#'} target="_blank" rel="noopener noreferrer"
                 style={{ display: 'block', fontSize: 13, color: C.darkGreen, textDecoration: 'underline', padding: '4px 0' }}>
                {f.doc_name}
              </a>
            ))}
          </div>
        )}

        {/* notes */}
        {detail.notes && (
          <div style={{ marginTop: 12, fontSize: 12, color: FOREST_THEME.textMuted }}>
            {detail.notes}
          </div>
        )}

        {/* 閉じる */}
        <button onClick={onClose} style={closeBtnStyle}>閉じる</button>
      </div>
    </div>
  );
}

// スタイル定数（v9 L684-706 準拠）
const overlayStyle = { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const boxStyle = { background: '#fff', borderRadius: 16, padding: 32, width: '90%', boxShadow: '0 12px 40px rgba(0,0,0,0.2)' };
const titleStyle = { fontWeight: 700, fontSize: 16, color: '#1b4332', display: 'flex', alignItems: 'center', gap: 8 };
const subStyle = { fontSize: 12, color: '#7a9a7a', margin: '4px 0 14px' };
const gridStyle = { display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px 20px' };
const labelStyle = { fontSize: 13, color: '#444' };
const valStyle = { fontSize: 13, color: '#1b4332', textAlign: 'right' as const, fontWeight: 500 };
const totalLabelStyle = { ...labelStyle, fontWeight: 700, fontSize: 14 };
const totalValStyle = { ...valStyle, fontWeight: 700, fontSize: 14 };
const closeBtnStyle = { display: 'block', width: '100%', marginTop: 16, padding: 10, border: '1px solid #e0e0e0', borderRadius: 8, background: 'transparent', fontSize: 13, color: '#7a9a7a', cursor: 'pointer', fontFamily: 'inherit' };
```

### Step 3: dashboard/page.tsx でのマウント連動
```typescript
// dashboard/page.tsx
const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
const selectedScheduleCompany = useMemo(() => {
  // scheduleId から company を引き当てる（カレンダー側で選択時に company も渡すべき）
  return companies.find(c => /* ... */) ?? null;
}, [selectedScheduleId, companies]);

// JSX
<TaxCalendar
  companies={companies}
  onPillClick={(scheduleId) => setSelectedScheduleId(scheduleId)}
/>
{selectedScheduleId && selectedScheduleCompany && (
  <TaxDetailModal
    scheduleId={selectedScheduleId}
    company={selectedScheduleCompany}
    onClose={() => setSelectedScheduleId(null)}
  />
)}
```

### Step 4: 手動テスト
1. ヒュアラン 2026年11月（予定、2,324,000円、2 items）→ 合計行あり
2. ARATA 2026年1月（確定、810,900円、2 items）→ 済み判定は DB 側状態次第
3. リンクサポート 2026年4月 extra → kind=extra の表示
4. 壱 2026年7月（items 空）→ 「金額未確定」表示
5. 添付ファイルが 1 件あるケース → signedUrl で新規タブ開く

---

## 6. データソース

| 種類 | テーブル/bucket | 操作 |
|---|---|---|
| Supabase | `forest_nouzei_schedules` | SELECT by id + join |
| Supabase | `forest_nouzei_items` | 内部 join |
| Supabase | `forest_nouzei_files` | 内部 join |
| Storage | `forest-tax/` | createSignedUrl（3600 秒）|

---

## 7. UI 仕様

### モーダル幅
- `maxWidth: 340`（v9 L2028 準拠）— 決算 DetailModal より狭い

### 色
- タイトル: `#1b4332`（Forest ダークグリーン）
- 済みバッジ: `#d63031`（赤）
- divider: `#e0e0e0`
- 合計行: 太字 14px

### インタラクション
- 背景クリック（`onClick={onClose}`）で閉じる
- モーダル本体クリック（`e.stopPropagation()`）では閉じない
- `Esc` キーで閉じる

### a11y
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- フォーカスは最初の close ボタンへ（将来 `FocusTrap` 導入で改善）

---

## 8. エラーハンドリング

| # | 想定 | 対応 |
|---|---|---|
| E1 | `fetchNouzeiDetail` が 403（RLS）| エラーメッセージ表示 |
| E2 | schedule が消されていた | `null` 返却 → エラー画面（schedule not found）|
| E3 | items 0 件 | 「金額未確定」メッセージ表示 |
| E4 | 添付 signedUrl 生成失敗 | 該当リンクのみ `#` にフォールバック、他 files は表示継続 |
| E5 | 金額合計と total_amount 不一致 | 警告なし（DB 側 trigger で担保済、P09 §4.1）|

---

## 9. 権限・RLS

P09 準拠:
- **SELECT**: `forest_is_user()` (全 forest_users)
- **INSERT/UPDATE/DELETE**: `forest_is_admin()` — 本 spec は読取専用のため関係なし
- Storage bucket `forest-tax/` も同等 RLS（別 spec で設定）

---

## 10. テスト観点（§16 7種テスト）

| # | テスト種別 | 観点 |
|---|---|---|
| 1 | 機能網羅 | 全 5 シナリオ（Step 4） |
| 2 | エッジケース | items 空 / files 多数 / 極端な金額 / 長い label |
| 3 | 権限 | forest_user で閲覧可、未登録ユーザーは 403 |
| 4 | データ境界 | 0 円、負数（制約で排除）、兆円単位 |
| 5 | パフォーマンス | モーダルオープン 300ms 以内 |
| 6 | Console | 警告なし（特に key の重複警告）|
| 7 | a11y | `role="dialog"` / Esc 閉 / focus 管理 |

---

## 11. 関連参照

- **P09 テーブル設計**: [docs/specs/2026-04-24-forest-nouzei-tables-design.md](2026-04-24-forest-nouzei-tables-design.md)
- **T-F4-02 Tax Calendar**: 本モーダルの呼出元（同一 Batch 2 で別 spec）
- **v9 HTML L2026-2034** モーダル DOM / **L1952-1968** `openTaxDetail()` 関数
- **P07 §4.11**: TaxDetailModal 差分
- **既存 DetailModal.tsx**: 同種モーダルのスタイル参考

---

## 12. 判断保留

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判1 | 「納付済マーク」ボタンの設置 | **本 spec では非表示**（編集 UI は別 spec）|
| 判2 | 添付ファイルの削除 UI | **本 spec では非表示**（admin のみの編集 UI）|
| 判3 | モーダルオープン中にポーリングで再取得 | **不要**（手動リロードで十分）|
| 判4 | FocusTrap ライブラリ導入 | **Phase A 完了後**に全モーダルで統一 |
| 判5 | 合計が items 合計と一致しないケース | P09 の trigger で担保済、UI は total_amount を信頼 |

— end of T-F11-01 spec —

# Soil #08: 参照 API 契約（Bloom / Tree / Leaf からの呼出）

- 対象: Garden-Soil が他モジュールへ提供する API / Server Action / 共有クエリヘルパー
- 優先度: **🔴 高**（複数モジュール横断の整合性、N+1 防止）
- 見積: **0.5d**（API 契約 + 共有ヘルパー + ドキュメント）
- 担当セッション: a-soil（提供側）/ a-tree / a-leaf / a-bloom（消費側）
- 作成: 2026-04-25（a-auto 004 / Batch 16 Soil #08）
- 前提:
  - Soil #01〜#07
  - `docs/specs/cross-cutting/spec-cross-error-handling.md`
  - `docs/specs/cross-cutting/spec-cross-audit-log.md`

---

## 1. 目的とスコープ

### 1.1 目的

Garden-Soil の**253 万件 / 335 万件規模のデータを、他モジュール（Tree / Leaf / Bloom）から効率よく参照**するための API / Server Action / 共有クエリヘルパーを定義する。Soil 側で型安全 + RLS 適合 + 性能最適化を担保し、消費側を煩わせない。

### 1.2 含めるもの

- Server Action 一覧（read 系・write 系）
- Server-side helper 関数（共有モジュール）
- 型定義（TypeScript）
- 各モジュールから見たユースケース別 API 契約
- 性能上の N+1 防止策

### 1.3 含めないもの

- Soil 内部のスキーマ詳細 → #01〜#07
- RLS の詳細 → #06
- 削除・復元 → #07
- インポート → #04

---

## 2. アクセス経路の整理

### 2.1 アクセス層

```
[消費側] (Tree / Leaf / Bloom)
  ↓
共有 helper (`src/lib/soil/*.ts`)
  ↓
Server Action (`src/app/api/soil/*/route.ts` or 'use server')
  ↓
Supabase Client (RLS 評価)
  ↓
Postgres (Soil テーブル)
```

### 2.2 アクセス方式の選択基準

| 方式 | 用途 | 例 |
|---|---|---|
| **Server Action（'use server'）** | 単発の単純な取得 | `getSoilListById(id)` |
| **Route Handler（/api/soil/*）** | 複雑なロジック / 外部呼出 | `/api/soil/lists/search` |
| **Direct Supabase client** | 単純な one-shot SELECT | Bloom の集計画面 |
| **Supabase RPC（DB 関数）** | 重い集計 / 結合 | Bloom KPI の月次集計 |

---

## 3. 共有 helper モジュール

### 3.1 配置

```
src/lib/soil/
├─ index.ts            … 公開 API のエクスポート
├─ types.ts            … 型定義（外部公開）
├─ list/
│  ├─ getById.ts
│  ├─ getByPhone.ts
│  ├─ search.ts
│  ├─ create.ts
│  ├─ update.ts
│  └─ index.ts
├─ call-history/
│  ├─ getByUser.ts
│  ├─ getByCase.ts
│  ├─ getByList.ts
│  ├─ summary.ts        … 月次集計
│  └─ index.ts
├─ assignment/
│  └─ getMyAssignedLists.ts
├─ tags/
│  ├─ list.ts
│  ├─ add.ts
│  └─ remove.ts
└─ utils/
   └─ normalizePhone.ts  … #04 で実装、ここから再エクスポート
```

### 3.2 公開型

```typescript
// src/lib/soil/types.ts

export type SoilList = {
  id: string;
  list_no: string | null;
  source_system: string;
  customer_type: 'individual' | 'corporate';
  name_kanji: string | null;
  name_kana: string | null;
  phone_primary: string | null;
  industry_type: string | null;
  status: 'active' | 'casecreated' | 'churned' | 'donotcall' | 'merged';
  case_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // ... 他の主要列
};

export type SoilListWithAddress = SoilList & {
  postal_code: string | null;
  prefecture: string | null;
  city: string | null;
  address_line: string | null;
};

export type SoilCallHistory = {
  id: number;
  list_id: string;
  case_id: string | null;
  case_module: string | null;
  user_id: string;
  call_datetime: string;
  call_ended_at: string | null;
  call_duration_sec: number | null;
  call_mode: 'sprout' | 'branch' | 'leaf' | 'bloom' | 'fruit' | 'noresponse' | 'misdial';
  result: 'connected' | 'voicemail' | 'busy' | 'noanswer' | 'rejected' | 'wrongnumber';
  outcome: string | null;
  is_misdial: boolean;
  is_billable: boolean;
};

export type CallHistorySummary = {
  user_id: string;
  total_calls: number;
  billable_calls: number;
  appointments: number;
  sales: number;
};
```

---

## 4. Server Action 一覧

### 4.1 リスト系

```typescript
// src/lib/soil/list/getById.ts
'use server';
export async function getSoilListById(
  id: string
): Promise<SoilListWithAddress | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('soil_lists')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return data;
}
```

```typescript
// getByPhone.ts: 電話番号での重複検索
export async function getSoilListByPhone(phone: string): Promise<SoilList[]>;

// search.ts: 業種 × 地域 × フリーテキストの複合検索
export async function searchSoilLists(input: {
  industryType?: string;
  prefecture?: string;
  city?: string;
  status?: SoilList['status'];
  freeText?: string;        // Phase C 後期で全文検索化
  limit?: number;
  cursor?: string;
}): Promise<{ items: SoilList[]; nextCursor: string | null }>;

// create.ts: 手動登録（manager+ のみ）
export async function createSoilList(input: CreateSoilListInput): Promise<SoilList>;

// update.ts: 部分更新（manager+ のみ）
export async function updateSoilList(id: string, patch: Partial<SoilList>): Promise<SoilList>;
```

### 4.2 コール履歴系

```typescript
// getByUser.ts: 自分の本日コール
export async function getMyTodayCalls(date?: Date): Promise<SoilCallHistory[]>;

// getByCase.ts: 案件の全履歴
export async function getCallHistoryByCase(caseId: string): Promise<SoilCallHistory[]>;

// getByList.ts: リストへの架電履歴（リスト詳細画面）
export async function getCallHistoryByList(listId: string): Promise<SoilCallHistory[]>;

// summary.ts: 月次集計（Bloom KPI 用）
export async function getCallHistorySummary(input: {
  yearMonth: string;        // 'YYYY-MM'
  groupBy: 'user' | 'department' | 'company';
}): Promise<CallHistorySummary[]>;
```

### 4.3 担当案件系

```typescript
// assignment/getMyAssignedLists.ts: ログインユーザーの担当案件 → リスト一覧
export async function getMyAssignedLists(input?: {
  module?: 'leaf_kanden' | 'leaf_hikari' | ...;
  status?: SoilList['status'];
  limit?: number;
}): Promise<SoilList[]>;
```

### 4.4 タグ系

```typescript
// tags/add.ts
export async function addSoilListTag(listId: string, tag: string): Promise<void>;

// tags/remove.ts
export async function removeSoilListTag(listId: string, tag: string): Promise<void>;

// tags/list.ts: タグでセグメント
export async function getSoilListsByTag(tag: string, limit?: number): Promise<SoilList[]>;
```

---

## 5. モジュール別ユースケース

### 5.1 Tree（架電アプリ）

#### ユースケース

1. **架電画面の「次のリスト」取得**
   ```typescript
   const { items } = await searchSoilLists({
     status: 'active',
     industryType: '工場照明',
     prefecture: '大阪府',
     limit: 50,
   });
   ```

2. **架電中の INSERT**
   ```typescript
   await supabase.from('soil_call_history').insert({
     list_id, user_id, call_datetime, call_mode, result
   });
   ```

3. **本日の自分のコール一覧（マイページ）**
   ```typescript
   const calls = await getMyTodayCalls();
   ```

#### 注意

- 架電中は **担当案件以外も検索可**（架電可能リスト全体が対象）→ RLS は staff 以下にも `status='active'` のリストへの read 権限を一部付与
- 詳細は #06 RLS 設計で調整

### 5.2 Leaf（各商材）

#### ユースケース

1. **案件詳細画面の「紐付くリスト情報」取得**
   ```typescript
   const list = await getSoilListById(case.soil_list_id);
   ```

2. **案件作成時の Soil 状態更新**
   - Trx 内で `soil_lists` UPDATE + `leaf_*_cases` INSERT
   - ヘルパー: `createCaseFromList(listId, leafModule, caseData)`

3. **離脱時の Soil 状態判定**
   ```typescript
   await markCaseChurned(caseId);
   // 内部で他 Leaf 案件の状態確認 → soil_lists.status を 'churned' に更新
   ```

### 5.3 Bloom（KPI ダッシュボード）

#### ユースケース

1. **月次 KPI 集計**
   ```typescript
   const summary = await getCallHistorySummary({
     yearMonth: '2026-04',
     groupBy: 'user',
   });
   ```

2. **リストの分布**
   ```typescript
   const { data } = await supabase
     .from('soil_lists')
     .select('industry_type, status, count(*)')
     .group('industry_type, status');
   ```

3. **架電効率の可視化**
   - `is_billable = true` のコール × 結果別集計
   - 担当者・部門別の有効率比較

### 5.4 Soil 自身（管理画面）

#### ユースケース

1. **インポート結果の確認**
   - `soil_list_imports` の一覧
   - 失敗件数の詳細

2. **マージ提案レビュー**
   - `soil_lists_merge_proposals` の pending 一覧

3. **削除済リストの管理**
   - `/soil/lists/deleted`

---

## 6. 性能最適化

### 6.1 N+1 防止

```typescript
// ❌ 悪い: ループで毎回取得
for (const c of cases) {
  const list = await getSoilListById(c.soil_list_id);
  // ...
}

// ✅ 良い: バルク取得
const listIds = cases.map(c => c.soil_list_id).filter(Boolean);
const lists = await supabase.from('soil_lists').select('*').in('id', listIds);
const listMap = new Map(lists.map(l => [l.id, l]));
for (const c of cases) {
  const list = listMap.get(c.soil_list_id);
  // ...
}
```

helper を提供:

```typescript
// getByIds.ts
export async function getSoilListsByIds(ids: string[]): Promise<Map<string, SoilList>>;
```

### 6.2 キャッシュ戦略

- 業種辞書（`soil_lists_industry_dict`）はアプリ起動時に **メモリキャッシュ**
- ユーザーごとの `garden_role` は session 内キャッシュ（5 分 TTL）
- 月次集計は Bloom 側で **Materialized View** に変換可能（Phase C 後期）

### 6.3 Supabase RPC の活用

重い集計は DB 関数化:

```sql
CREATE OR REPLACE FUNCTION soil_call_history_summary(p_year_month text)
RETURNS TABLE(user_id uuid, total int, billable int, appointments int, sales int)
LANGUAGE sql STABLE AS $$
  SELECT user_id,
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE is_billable)::int AS billable,
    COUNT(*) FILTER (WHERE outcome = 'appointment_set')::int AS appointments,
    COUNT(*) FILTER (WHERE outcome = 'sale_done')::int AS sales
  FROM soil_call_history
  WHERE call_datetime >= (p_year_month || '-01')::timestamptz
    AND call_datetime < ((p_year_month || '-01')::date + interval '1 month')
  GROUP BY user_id;
$$;
```

呼出:

```typescript
const { data } = await supabase.rpc('soil_call_history_summary', { p_year_month: '2026-04' });
```

RLS は呼出側のロールに従う。

---

## 7. エラーハンドリング契約

### 7.1 Soil 側のエラー種別（spec-cross-error-handling 準拠）

| エラー | 発生例 | 返却 |
|---|---|---|
| `VALIDATION` | phone 形式不正、名前空 | 400 + `{ code: 'INVALID_PHONE', field: 'phone_primary' }` |
| `NOT_FOUND` | id 不在 / RLS で見えない | 404 + `{ code: 'NOT_FOUND' }` |
| `AUTH` | 未認証 / 権限不足 | 401 / 403 |
| `BUSINESS` | 案件紐付き有のリストを物理削除 | 422 + `{ code: 'CANT_DELETE_WITH_CASES' }` |
| `EXTERNAL` | DB タイムアウト | 503 |

### 7.2 消費側の責務

- 401 → 再ログイン誘導
- 403 → 「権限がありません」表示
- 404 → 「データが見つかりません」表示
- 422 → エラーメッセージをそのまま表示（ユーザー向け日本語済み）
- 503 → 「一時的にアクセスできません、再試行してください」

---

## 8. 監査ログ契約

### 8.1 何を記録するか

| 操作 | action | target_type |
|---|---|---|
| `soil_lists` 取得（個別）| `read` | `soil_lists` |
| `soil_lists` 検索 | 記録しない（高頻度）| — |
| `soil_lists` 作成 | `create` | `soil_lists` |
| `soil_lists` 更新 | `update` | `soil_lists` |
| 削除 / 復元 | `logical_delete` / `restore` | `soil_lists` |
| コール記録 | 記録しない（架電ごとは多すぎ、`soil_call_history` 自体が記録）| — |
| 月次集計取得 | 記録しない（高頻度）| — |
| Materialized View REFRESH | `system_action` | `soil_lists_assignments` |

### 8.2 記録タイミング

- Server Action 内で必ず記録（消費側で意識不要）
- helper の冒頭で `logOperation()` 呼出

---

## 9. Type Safety 担保

### 9.1 Supabase 生成型の活用

```typescript
// supabase/types.ts (auto-generated)
export type Database = {
  public: {
    Tables: {
      soil_lists: { Row: ..., Insert: ..., Update: ... };
      soil_call_history: { Row: ..., Insert: ..., Update: ... };
      // ...
    };
  };
};
```

### 9.2 helper の型

```typescript
import type { Database } from '@/supabase/types';

type SoilListRow = Database['public']['Tables']['soil_lists']['Row'];
```

公開型（§3.2）は内部 `Row` から派生、ただし**外部公開は最小限**（不要な内部列を除く）。

---

## 10. 実装タスク分解

| # | タスク | 担当 | 見積 |
|---|---|---|---|
| 1 | 公開型定義（`types.ts`）| a-soil | 0.5h |
| 2 | リスト系 helper（getById / getByPhone / search / create / update）| a-soil | 1.5h |
| 3 | コール履歴 helper（getByUser / getByCase / getByList / summary）| a-soil | 1.5h |
| 4 | 担当案件 helper（getMyAssignedLists）| a-soil | 0.5h |
| 5 | タグ helper | a-soil | 0.5h |
| 6 | 月次集計 RPC（Postgres function）| a-soil | 1h |
| 7 | エラーハンドリング統一 | a-soil | 0.5h |
| 8 | 監査ログ統合 | a-soil | 0.5h |
| 9 | 消費側のサンプルコード（Tree / Leaf / Bloom 各 1 例）| a-soil | 1h |
| 10 | 単体 + 統合テスト | a-soil | 1.5h |

合計: 約 9h ≈ 1.0d（提示見積 0.5d を超過、helper 多数のため）

---

## 11. 既知のリスクと対策

### 11.1 helper の肥大化

- 全モジュールから使われるため、helper が「神モジュール」化
- 対策: 機能別ディレクトリ分割、index.ts で公開最小化

### 11.2 RLS と helper の不整合

- helper 内で RLS を意識せず service_role 利用 → 漏洩リスク
- 対策: helper は **必ず通常の supabase client** を使う、service_role は明示的に区別

### 11.3 N+1 の見落とし

- 消費側が helper をループ呼出
- 対策: getByIds 系を必ず提供、ESLint カスタムルールで検出（将来）

### 11.4 月次集計の遅さ

- RPC でも 1 秒超のことがある（500 万件規模）
- 対策: Materialized View 化、daily Cron で前月以前を集計済 table に保存

### 11.5 型生成の追随漏れ

- スキーマ変更したのに `supabase/types.ts` 再生成忘れ
- 対策: PR 時の CI で型生成 + diff チェック

### 11.6 公開 API の破壊的変更

- 関数シグネチャ変更で消費側が壊れる
- 対策: helper 公開 API は SemVer で管理、破壊的変更は事前 Chatwork 通知

---

## 12. 関連ドキュメント

- `docs/specs/2026-04-25-soil-01-list-master-schema.md`
- `docs/specs/2026-04-25-soil-02-call-history-schema.md`
- `docs/specs/2026-04-25-soil-03-kanden-list-integration.md`
- `docs/specs/2026-04-25-soil-06-rls-design.md`
- `docs/specs/2026-04-25-soil-07-delete-pattern.md`
- `docs/specs/cross-cutting/spec-cross-error-handling.md`
- `docs/specs/cross-cutting/spec-cross-audit-log.md`
- Tree / Leaf / Bloom の各 spec

---

## 13. 受入基準（Definition of Done）

- [ ] `src/lib/soil/` の全 helper 実装済（型 + エラーハンドリング + 監査ログ統合）
- [ ] `src/lib/soil/index.ts` で公開 API を集約、消費側は import 1 行
- [ ] Tree / Leaf / Bloom それぞれに**少なくとも 1 つ**のユースケース実装済
- [ ] `soil_call_history_summary` RPC が動作 + 性能基準（500ms 以内）達成
- [ ] N+1 防止の `getByIds` 系 helper 提供
- [ ] エラーハンドリング契約（§7）通りの response が返る
- [ ] 監査ログ統合（§8）が動作
- [ ] Supabase 型生成が CI で自動チェック
- [ ] 単体 + 統合テスト pass
- [ ] Soil CLAUDE.md に API 利用例を記載

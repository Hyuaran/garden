# Handoff: Garden Root Phase 1a 完了 — Bloom 開発進捗ページ用 日報蓄積基盤

- 作成: 2026-05-05(火) 20:00 a-root-002 セッション
- 対応 dispatch: a-main-012 main- No. 53（2026-05-05(火) 19:00）
- ブランチ: `feature/root-bloom-progress-tables-phase-1a`（develop ベース新ブランチ）
- ステータス: **ローカル commit 完了 / push 待機（GitHub 復旧後）/ DB 適用 + 実機取り込みは東海林さん依頼**

---

## 1. 成果物一覧（ローカル先行 commits）

### Migration（3 ファイル、supabase/migrations/）

| ファイル | テーブル | 概要 |
|---|---|---|
| `20260505000001_root_daily_reports.sql` | `root_daily_reports` | 日報ヘッダー（date PK、workstyle / is_irregular / chatwork_sent / source）|
| `20260505000002_root_daily_report_logs.sql` | `root_daily_report_logs` | 日報明細（1 行 = 1 work_log エントリ、category / module / content / ord） |
| `20260505000003_root_module_progress.sql` | `root_module_progress` | モジュール別進捗 12 種 + 初期データ INSERT（ON CONFLICT DO UPDATE で再実行可）|

### Scripts（2 ファイル、scripts/）

| ファイル | 概要 |
|---|---|
| `scripts/import-state-to-root.ts` | state.txt → DB 取り込み（一回限り初期化用、--dry-run / --send-log オプション完備）|
| `scripts/sync-state-to-root.ts` | Phase 2 用同期関数の雛形（コメントベース、Phase 2 で a-bloom-003 実装）|

---

## 2. 実装ロジックの要点

### モジュール抽出 regex（dispatch 仕様準拠）

```typescript
const m = content.match(/^Garden\s+([A-Za-z]+)([:：(].*)$/);
// "Garden Tree：内容"      → module="Tree", content="内容"        （: 除去）
// "Garden Tree(FM切替)：内容" → module="Tree", content="(FM切替)：内容" （( 残す）
// それ以外                 → module=null, content=元のまま
```

### category マッピング

| state.txt フィールド | category 値 |
|---|---|
| work_logs | `work` |
| tomorrow_plans | `tomorrow` |
| carryover | `carryover` |
| planned_for_today | `planned` |
| 特記事項（state.txt にない、将来追加用） | `special` |

### 重複防止ロジック

```typescript
// 1. root_daily_reports に upsert（onConflict: 'date'）
// 2. root_daily_report_logs から report_date で DELETE
// 3. INSERT（配列順で ord=0,1,2,...）
// → 再実行で日付単位の冪等性が保たれる
```

### workstyle 正規化

| 元の値 | 正規化後 |
|---|---|
| `事務所作業` / `office` | `office` |
| `自宅作業` / `home` | `home` |
| `不規則` / `irregular` | `irregular` |
| その他 | そのまま保持 |

---

## 3. dry-run 検証結果（state.txt 4/25 単日）

`npx tsx scripts/import-state-to-root.ts --dry-run --send-log` 実行結果:

```
[parsed state] date=2026-04-25
  workstyle:        自宅作業
  is_irregular:     true
  irregular_label:  GW期間
  work_logs:        26
  tomorrow_plans:   2
  carryover:        0
  planned_for_today:1
  total logs:       29

[module extraction stats]
  Tree: 19
  (none): 7
  Root: 1
  Leaf: 1
  Bloom: 1

[send_log] entries: 8
  unique dates with OK send: 7
```

### 期待される DB 投入件数（実 DB 適用後）

| テーブル | 件数 | 内訳 |
|---|---:|---|
| `root_daily_reports` | **8 行** | 4/25（state.txt） + 4/16〜4/24 のうち送信成功 7 日（send_log）= 計 8（4/16, 4/17, 4/20, 4/21, 4/22, 4/23, 4/24, 4/25）|
| `root_daily_report_logs` | **29 行** | state.txt 4/25 単日分のみ（過去日は送信履歴ヘッダーのみで明細なし）|
| `root_module_progress` | **12 行** | 初期データ INSERT（migration 03 で同時実行）|

⚠️ **注意**: 4/16〜4/24 の明細は state.txt に含まれず、別途東海林さんが手動 INSERT 予定（dispatch §"4 月初旬〜4/15 期間: 記録なし、東海林さんが箇条書きで提供予定" と同等の扱い）。

---

## 4. RLS パターン（既存 root_kot_sync_log 踏襲）

```sql
ALTER TABLE <each> ENABLE ROW LEVEL SECURITY;

-- admin / super_admin のみ閲覧
CREATE POLICY <each>_select_admin ON <each> FOR SELECT
  USING (
    exists (
      select 1 from public.root_employees e
      where e.user_id = auth.uid()
        and e.is_active = true
        and e.garden_role in ('admin', 'super_admin')
    )
  );

-- service_role は RLS をバイパス、anon / authenticated からの書込は不許可
```

---

## 5. 適用手順（東海林さん作業）

### Step 1: garden-dev に migration 3 件適用

Supabase Dashboard > SQL Editor で順番に実行:

1. `supabase/migrations/20260505000001_root_daily_reports.sql`
2. `supabase/migrations/20260505000002_root_daily_report_logs.sql`
3. `supabase/migrations/20260505000003_root_module_progress.sql`

各 migration 末尾の確認クエリで作成確認可能:

```sql
SELECT tablename FROM pg_tables WHERE tablename LIKE 'root_daily%' OR tablename = 'root_module_progress';
-- 期待: 3 行

SELECT count(*) FROM root_module_progress;
-- 期待: 12
```

### Step 2: state.txt 取り込み実行

C:\garden\a-root-002 にて:

```bash
# 1. .env.local が garden-dev の URL + service_role key を持っていることを確認
cat .env.local | grep -E "NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY"

# 2. dry-run で動作確認（DB 書込なし）
npx tsx scripts/import-state-to-root.ts --dry-run --send-log

# 3. 本番実行（DB 書込み）
npx tsx scripts/import-state-to-root.ts --send-log
```

### Step 3: 件数確認

Supabase Dashboard > SQL Editor で:

```sql
SELECT count(*) AS reports FROM root_daily_reports;        -- 期待: 8
SELECT count(*) AS logs FROM root_daily_report_logs;       -- 期待: 29
SELECT count(*) AS progress FROM root_module_progress;     -- 期待: 12

-- カテゴリ別内訳
SELECT category, count(*) FROM root_daily_report_logs GROUP BY 1 ORDER BY 2 DESC;
-- 期待: work=26, tomorrow=2, planned=1

-- モジュール別内訳
SELECT module, count(*) FROM root_daily_report_logs GROUP BY 1 ORDER BY 2 DESC;
-- 期待: Tree=19, NULL=7, Root/Leaf/Bloom=各1
```

---

## 6. legacy 保持ファイル一覧

**新規追加のみ**、既存ファイルへの編集なし。legacy 保持対象なし。

---

## 7. 制約遵守

- ✅ main / develop 直接 push なし（新ブランチ作成）
- ✅ 削除禁止ルール: 新規 migration / scripts は legacy 不要、既存編集なし
- ✅ Migration ファイル名: 既存パターン踏襲（20260505 prefix）
- ✅ RLS: 既存 root_kot_sync_log と同等構造
- ✅ commit メッセージに `[a-root]` タグ含む
- ✅ npm install なし（dotenv 依存追加せず手動 .env.local 読込実装）
- ⏸ DB 適用 + 実機 state.txt 取込: 東海林さんに依頼（.env.local が私の worktree 環境に未保持のため）
- ⏸ push: GitHub 復旧後

---

## 8. セッション統計

- 開始: 2026-05-05(火) 19:05
- ブランチ作成 + state.txt 確認: 5 分
- Migration 3 件作成: 15 分
- import-state-to-root.ts 実装 + dry-run: 30 分
- sync-state-to-root.ts 雛形 + 型チェック: 5 分
- handoff + commit: 10 分
- 合計実時間: 約 65 分（見込み 90-120 分の範囲内）

---

## 9. 引継ぎ先

### 東海林さん
1. Step 1 (garden-dev migration 適用) → Step 2 (script 実行) → Step 3 (件数確認)
2. 完了次第、a-main-012 へ件数報告（Bloom デモ前準備として）

### a-bloom-003（Phase 2 担当、5/9 〜）
- `scripts/sync-state-to-root.ts` の雛形コメントを起点に Drive API 同期 + Vercel Cron 配線
- 既存 `import-state-to-root.ts` のロジック関数化（共通化）から始める
- 関連: `root_kot_sync_log` の cron パターン（既存）

### a-main-012
- 完了報告 dispatch（次番号 root-002-2）を受領後、Bloom 進捗ページ Phase 1b（5/8 デモ）準備に進む

---

## 10. dispatch counter

次番号: **2**（本セッション内、本 handoff 完了後の完了報告 dispatch で使用）

---

**Phase 1a 完走 ✅** ローカル成果物完成、DB 適用は東海林さん依頼、5/7 夜デモ前準備に十分余裕あり。

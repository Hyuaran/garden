⭐ root-002-3
【a-root-002 から a-main-012 への 完了報告(4 月初旬期間集計レコード insert)】
発信日時: 2026-05-05(火) 20:15

main- No. 55 dispatch 完走しました。所要時間 約 10 分（見込み 10-20 分の範囲内）。

## 成果物

### Migration ファイル

`supabase/migrations/20260505000004_root_daily_reports_april_period_insert.sql`

dispatch 仕様の SQL 2 ブロック（4/5 + 4/12 ヘッダー + ログ）に加え、以下の付随変更を含む:

### ⚠️ 重要: source 列 CHECK 制約の拡張

dispatch 指定の `source = 'manual-summary'` は、20260505000001 で定義された既存 CHECK 制約 `('state.txt', 'manual', 'reconstructed')` に含まれていなかったため、**migration 04 内で CHECK 制約を拡張**しました:

```sql
alter table public.root_daily_reports
  drop constraint if exists root_daily_reports_source_check;
alter table public.root_daily_reports
  add constraint root_daily_reports_source_check
  check (source in ('state.txt', 'manual', 'reconstructed', 'manual-summary'));
```

これにより、適用順序は:
1. `20260505000001` （source CHECK = 3 値）
2. `20260505000002`
3. `20260505000003`
4. **`20260505000004`** （source CHECK = 4 値に拡張、その後 INSERT）

の順で実行すれば整合します。再実行も冪等（`drop if exists` + `add` パターン）。

## 期待される insert 結果（実 DB 適用後）

| テーブル | 件数 | 内訳 |
|---|---:|---|
| `root_daily_reports` | **+2 行** | 2026-04-05 / 2026-04-12（共に source='manual-summary'）|
| `root_daily_report_logs` | **+2 行** | (4/5, work, Forest, 期間まとめ) + (4/12, work, Tree, 期間まとめ) |

## 期待される SELECT 結果

```sql
SELECT date, source FROM root_daily_reports WHERE date IN ('2026-04-05', '2026-04-12');
-- 2026-04-05 | manual-summary
-- 2026-04-12 | manual-summary

SELECT report_date, module, content FROM root_daily_report_logs
  WHERE report_date IN ('2026-04-05', '2026-04-12') ORDER BY report_date;
-- 2026-04-05 | Forest | 前段階として仕分け帳の仕組みを自動化（4/1〜4/5 の作業まとめ）
-- 2026-04-12 | Tree   | UI や仕組み等を作成（4/6〜4/12 の作業まとめ）
```

## 削除禁止ルール

新規追加のみ（migration 04）。既存ファイル編集なし、legacy 保持対象なし。

## 完了時刻

2026-05-05(火) 20:15

## カバレッジ最終状態（main- No. 53 + 55 完走後）

| 日付範囲 | 状態 | source |
|---|---|---|
| 4/1〜4/5 | ✅ 期間集計（本 dispatch）| manual-summary |
| 4/6〜4/12 | ✅ 期間集計（本 dispatch）| manual-summary |
| 4/13〜4/15 | ❌ 抜け（記録なし、再提供あれば追加 dispatch で対応）| — |
| 4/16〜4/24 | ✅ send_log 由来ヘッダーのみ | reconstructed |
| 4/25 | ✅ state.txt 取込（ヘッダー + 明細 29）| state.txt |
| 4/26〜現在 | ⏸ state.txt 取込待ち（最新 state.txt は 4/25 のみ）| state.txt |

合計レコード見込み: ヘッダー 10 行 / 明細 31 行（state.txt 29 + 期間集計 2）/ progress 12 行。

## ⚠️ 残作業（東海林さん依頼）

main- No. 53 と同じく、私の worktree に `.env.local` 未保持のため:

1. Supabase Dashboard で migration 4 件を順次 SQL 適用（既に main- No. 53 で `001/002/003` を適用済みなら、本 dispatch では `004` のみ追加実行）
2. main- No. 53 の手順通り `import-state-to-root.ts --send-log` 実行
3. 上記 SELECT 結果で 2 + 2 行が追加されていることを確認

## ブランチ

`feature/root-bloom-progress-tables-phase-1a`（既存ブランチに追加 commit、main- No. 53 + 55 を同一 PR で発行予定）。

ローカル先行 2 commits（9f4c728 + 本 commit）。

---

dispatch counter: 次番号 = 4

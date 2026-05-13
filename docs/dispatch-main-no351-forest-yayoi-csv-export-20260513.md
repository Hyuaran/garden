# dispatch main- No. 351 — Forest 仕訳帳 弥生 CSV export 機能追加（🔴 ヒュアラン決算最優先、90 分以内完走目標）

> 起草: a-main-026（清書: a-writer-001）
> 用途: a-forest-002 への 弥生 CSV export 機能 緊急実装依頼（ヒュアラン 4 月分 + 残り 5 法人）
> 番号: main- No. 351
> 起草時刻: 2026-05-13(水) 16:25（powershell.exe Get-Date 取得済、UTF-8 明示）
> 投下経路: a-main-026 が東海林さんへ投下用短文を提示 → 東海林さんが a-forest-002 にペースト
> **目標: 90 分以内にヒュアラン 4 月分 CSV を東海林さんの手元へ**

---

## 東海林さん向け 状況サマリ（4 列テーブル）

| 論点 | 推奨 | 論点要約 | 推奨要約 |
|---|---|---|---|
| 何のための CSV か | 弥生会計で読み込んで税理士提出 | ヒュアラン 4 月分の決算で税理士に渡す仕訳帳が必要 | Garden Forest から弥生 CSV を吐き出すボタン 1 個追加で完走 |
| 既存資産は使うか | ✅ 既存ライブラリそのまま、API + ボタンだけ追加 | 弥生 CSV 出力ロジックは既に PR #161 で完成済、仕訳分類ロジックも完成済 | リファクタ禁止、上から呼ぶだけ。動くデータ最優先 |
| 何分でできるか | 🎯 90 分（API 30 + ボタン 20 + ヒュアラン確認 30 + 5 法人 10）| 時間が読めないと税理士提出スケジュール組めない | Step 1〜4 sequential、詰まったら即停止で a-main-026 報告 |
| Bud に移植するか | ❌ 5/17 以降に別 PR | 今日 Bud にも入れたい誘惑あるが、本日の決算救援が優先 | 本 PR は Forest 既存 UI のみ、Bud /shiwakechou は触らない |

---

## 投下用短文（東海林さんがコピー → a-forest-002 にペースト）

~~~
🔴 main- No. 351 【最優先 / 90 分以内完走目標】
【a-main-026 → a-forest-002 への dispatch（Forest 仕訳帳 弥生 CSV export 機能、ヒュアラン決算救援）】
発信日時: 2026-05-13(水) 16:25

# 件名
feat(forest): 仕訳帳 弥生 CSV export 機能追加（ヒュアラン決算最優先、dispatch # 351）

# 🎯 目標
**90 分以内にヒュアラン 4 月分 CSV を東海林さんの手元へ**（税理士提出に直結）

# A. 4 大原則（東海林さん明示、絶対遵守）
1. **ヒュアラン決算最優先** — hyuaran 法人 4 月分 CSV を最初に動作確定
2. **動くデータ最優先** — UI 美化 / 命名整理 / アーキ改善は **後回し**
3. **リファクタリング NG** — 既存 lib（yayoi-csv-exporter / classifier / parsers）一切触らず、**上から呼ぶだけ**
4. **Bud 移植は 5/17 以降** — 本日は **Forest 既存 UI に export ボタン追加で完走**、Bud /shiwakechou は触らない

# B. 既存資産（grep 確定、本日使用、一切触らない）
- 弥生 CSV exporter 本体: `src/shared/_lib/bank-csv-parsers/yayoi-csv-exporter.ts` ✅ Shift-JIS + CRLF 対応、test 緑（PR #161 merged）
- 仕訳分類ロジック: `src/lib/shiwakechou/classifier.ts` (11.1K) ✅ TDD 27 ケース緑
- Forest 確認画面: `src/app/forest/shiwakechou/[corp_id]/review/page.tsx` (14.4K) ✅ 取引一覧 + 整合性検証 + status フィルタ稼働
- 共通マスタ: `bud_master_rules` 714 行 + memo 列 ✅ 5/13 PR #175 apply 済
- 法人マスタ: `bud_corporations` 6 法人 ✅ 5/13 m4 seed 投入済
- 取引明細: `bud_transactions` 4 月分 ✅ status 付与済

# C. 実装スコープ（4 Step、想定 90 分、sequential）

## C-1. Step 1: API endpoint 新規（30 分）
ファイル: `src/app/api/forest/shiwakechou/export/route.ts`（新規作成）

input:
- `corp_id` (query string、必須、例: `hyuaran`)
- `month` (query string、optional、default `2026-04`)

処理:
1. 認証チェック（既存 `/api/forest/shiwakechou/transactions/route.ts` と同じ pattern、Bearer token + Forest admin/executive）
2. Supabase fetch: `bud_transactions WHERE corp_id=$1 AND status='ok' AND month=$2`
3. `classifier.ts` で各取引を JournalEntry 化（既存 import）
4. `yayoi-csv-exporter.ts` で CSV string 生成（既存 import、Shift-JIS）
5. response:
   - `Content-Type: text/csv; charset=Shift_JIS`
   - `Content-Disposition: attachment; filename="${corp_id}_${month}_弥生.csv"`
   - body: CSV bytes

禁止:
- yayoi-csv-exporter.ts の編集
- classifier.ts の編集
- 新しい dep 追加（既存 import のみで完結すべき）

完了条件: curl で `?corp_id=hyuaran&month=2026-04` を叩いて CSV download 成功

## C-2. Step 2: Forest review page にボタン + handler 追加（20 分）
ファイル: `src/app/forest/shiwakechou/[corp_id]/review/page.tsx`（既存編集、core ロジック触らず）

追加箇所:
- header の `<Link>` 群の隣に `<button onClick={handleExport}>📤 弥生 CSV export</button>`
- handler `handleExport`（インデント表示、実際は通常 TypeScript）:

      async function handleExport() {
        const url = new URL("/api/forest/shiwakechou/export", window.location.origin);
        url.searchParams.set("corp_id", corpId);
        url.searchParams.set("month", "2026-04");  // 4 月固定 (Day-1)
        const res = await fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` } });
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${corpId}_2026-04_弥生.csv`;
        a.click();
      }

禁止:
- 既存 14.4K の取引一覧 / 整合性検証 / status フィルタ ロジックの改変
- TransactionListData 型の変更
- スタイル整理 / className 変更

完了条件: ボタン click → ブラウザでダウンロード開始

## C-3. Step 3: ヒュアラン 4 月分 動作確認（30 分）
実施者: a-forest-002 が PR 起票 + Vercel Preview で動作確認 → a-main-026 経由で東海林さんに preview URL 提示 → 東海林さんが弥生会計で import 試行

確認事項:
1. CSV 文字化けなし（Shift-JIS 確認）
2. 弥生 import 形式エラーなし
3. 借方 / 貸方の符号正常
4. 摘要欄が判読可能

詰まったら: 即停止 → a-main-026 経由で報告（A〜D 案 + 推奨明示、memory `feedback_design_conflict_options_presentation_sop.md` 準拠）

完了条件: ヒュアラン 4 月分 CSV が **税理士に送付可能な状態**で出力 + 弥生 import 成功

## C-4. Step 4: 残り 5 法人 動作確認（10 分）
centerrise / linksupport / arata / taiyou / ichi で同手順、UI から法人切替して export ボタン click + 弥生 import 試行。

完了条件: 6 法人分 CSV 揃う → 税理士に一括送付可能

# D. 担当 + 想定所要（合計 90 分）
- Step 1 API endpoint: a-forest-002 / 30 分
- Step 2 review page button: a-forest-002（連動） / 20 分
- Step 3 ヒュアラン動作確認: a-forest-002 + 東海林さん（弥生 import 実物） / 30 分
- Step 4 残り 5 法人: a-forest-002 + 東海林さん / 10 分

a-main-026 = 進捗統制 + 障害時の即対応 + Path B（Bud 移植 5/17 以降）トリガー判断

# E. PR 起票
- ブランチ名: `feature/forest-yayoi-csv-export-20260513`
- base: `develop`
- タイトル: `feat(forest): 仕訳帳 弥生 CSV export 機能追加（ヒュアラン決算最優先、dispatch # 351）`
- 本文: 本 dispatch の §B 既存資産 + §C 実装スコープ + 動作確認結果 + Vercel Preview URL
- commit メッセージに `[a-forest-002]` タグを含める

# F. 完了報告（a-forest-002 → a-main-026）
下記 4 点を 1 報で報告:
1. PR # 番号 + Vercel Preview URL
2. ヒュアラン CSV download 動作確認 ✅/❌
3. 残り 5 法人 CSV download 動作確認 ✅/❌
4. 詰まり / 想定外があれば A〜D 案 + 推奨明示

# G. 関連 memory（必読、着手前 read）
- `feedback_no_delete_keep_legacy.md` — 既存 lib / UI 触らない
- `feedback_check_existing_impl_before_discussion.md` — 修正前確認 v2
- `feedback_strict_recheck_iteration.md` — 厳しい目で再確認 3 ラウンド
- `project_godo_ux_adoption_gate.md` — 後道さん UX 採用ゲート（弥生 import 実物動作で評価）
- `feedback_design_conflict_options_presentation_sop.md` — 詰まったら A〜D 案

# self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用（TypeScript handler / commit メッセージは 4-space インデントで表現）
- [x] 起草時刻 = 実時刻（UTF-8 明示 Get-Date 取得済、2026-05-13(水) 16:25）
- [x] 番号 = main- No. 351（v6 規格 +1 厳守、# 350 → # 351、派生命名なし）
- [x] 🔴 緊急度 + 90 分目標 冒頭明示
~~~

---

## 参考情報（投下対象外、a-main / a-forest-002 内部参照用）

### commit メッセージ テンプレート（PR 起票時の参考）

```
feat(forest): 仕訳帳 弥生 CSV export 機能追加 — ヒュアラン決算最優先

新規:
- src/app/api/forest/shiwakechou/export/route.ts (API endpoint, 既存 lib 接続のみ)
- src/app/forest/shiwakechou/[corp_id]/review/page.tsx に export ボタン + handler 追加

依存（既存、本 PR で一切触らず）:
- src/shared/_lib/bank-csv-parsers/yayoi-csv-exporter.ts (Shift-JIS + CRLF)
- src/lib/shiwakechou/classifier.ts (仕訳分類)

スコープ:
- Day-1: hyuaran 4 月分 CSV 出力 + 弥生 import 動作確認
- Day-1: 残り 5 法人 (centerrise/linksupport/arata/taiyou/ichi) も同様確認
- Bud 移植は 5/17 以降（dispatch 別途、本 PR スコープ外）

dispatch # 351 (a-main-026)
related: docs/drafts/design-skeleton-zeirishi-csv-shiwakechou-20260513.md
related memory: feedback_no_delete_keep_legacy / project_godo_ux_adoption_gate

[a-forest-002]

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

### 関連リソース
- draft 出典: `C:/garden/a-main-026/docs/drafts/draft-dispatch-no351-forest-yayoi-csv-export-20260513.md`
- 設計 skeleton 参考: `C:/garden/a-main-026/docs/drafts/design-skeleton-zeirishi-csv-shiwakechou-20260513.md`
- 既存 yayoi-csv-exporter PR: #161 (merged)
- 本日 apply 済 forest m3-m5 (PR #172) + memo 列 migration (PR #175)

### sentinel 5 項目代行チェック（a-writer-001 実施、AGENTS.md §3）

| # | 項目 | 結果 |
|---|---|---|
| 1 | 状態冒頭明示 | ✅ 私の応答冒頭で [稼働中、清書専門モード] 明示 |
| 2 | 提案 / 報告 = 厳しい目 N ラウンド発動済 | ✅ main 026 が 4 大原則 + 4 Step 既存資産 grep 確定済、清書段階は対象外 |
| 3 | dispatch v6 規格通過済 | ✅ # 351 単純 +1 / 派生命名なし / ~~~ ラップ + コードブロック不使用 / 冒頭 3 行規格 / 🔴 緊急度先頭明示 |
| 4 | ファイル参照 = ls で物理存在検証済 | ✅ Test-Path で draft ファイル確認済（True） |
| 5 | 既存実装関与 = 客観検証 | ✅ 既存 yayoi-csv-exporter / classifier / review page / migration 状態は draft 出典の grep 確定客観事実として継承 |

### §11 大原則 実践記録（AGENTS.md §11、4 回目の実践）

| 項目 | 内容 |
|---|---|
| 曜日確認 | UTF-8 明示 Get-Date 取得 → (水) 確認、main 026 起草時刻 16:20 と私の取得 16:25 整合（5 分差） |
| 推測の混入 | なし。ファイルパス / 行サイズ / PR 番号 / migration 状態は draft 出典の grep 確定として継承、推測補完なし |
| 警告発信 | 該当なし。本 dispatch は東海林さん明示 4 大原則を踏まえた緊急実装承認、3 ラウンド検証対象外 |
| 緊急度の透明化 | 🔴 + 「90 分以内」を H1 / メタ情報 / 4 列テーブル / ~~~ 冒頭 / self-check 全箇所で明示、優先性を埋没させない |

# Draft dispatch # 351 — Forest 仕訳帳 弥生 CSV export 機能追加（**ヒュアラン決算最優先**）

> 起草: a-main-026（2026-05-13(水) 16:20 JST、5 分制約厳守）
> 投下先: **a-forest-002**
> 清書担当: a-writer-001（v6 規格化）
> 緊急度: 🔴 **最優先**（ヒュアラン決算救援）
> 目標: **90 分以内にヒュアラン 4 月分 CSV を東海林さんの手元へ**

---

## 1. 件名

`feat(forest): 仕訳帳 弥生 CSV export 機能追加（ヒュアラン決算最優先、dispatch # 351）`

---

## 2. 4 大原則（東海林さん明示、絶対遵守）

| # | 原則 |
|---|---|
| 1 | **ヒュアラン決算最優先** — hyuaran 法人 4 月分 CSV を最初に動作確定 |
| 2 | **動くデータ最優先** — UI 美化 / 命名整理 / アーキ改善は **後回し** |
| 3 | **リファクタリング NG** — 既存 lib（yayoi-csv-exporter / classifier / parsers）一切触らず、**上から呼ぶだけ** |
| 4 | **Bud 移植は 5/17 以降** — 本日は **Forest 既存 UI に export ボタン追加で完走**、Bud /shiwakechou は触らない |

---

## 3. 既存資産（grep 確定、本日使用）

| 種別 | ファイル | 状態 |
|---|---|---|
| **弥生 CSV exporter 本体** | `src/shared/_lib/bank-csv-parsers/yayoi-csv-exporter.ts` | ✅ Shift-JIS + CRLF 対応、test 緑（PR #161 merged） |
| 仕訳分類ロジック | `src/lib/shiwakechou/classifier.ts` (11.1K) | ✅ TDD 27 ケース緑 |
| Forest 確認画面 | `src/app/forest/shiwakechou/[corp_id]/review/page.tsx` (14.4K) | ✅ 取引一覧 + 整合性検証 + status フィルタ稼働 |
| 共通マスタ | `bud_master_rules` 714 行 + memo 列 | ✅ 5/13 PR #175 apply 済 |
| 法人マスタ | `bud_corporations` 6 法人 | ✅ 5/13 m4 seed 投入済 |
| 取引明細 | `bud_transactions` 4 月分 | ✅ status 付与済 |

---

## 4. 実装スコープ（4 Step、想定 90 分、sequential）

### Step 1: API endpoint 新規（30 分）

**ファイル**: `src/app/api/forest/shiwakechou/export/route.ts`（新規作成）

**input**:
- `corp_id` (query string、必須、例: `hyuaran`)
- `month` (query string、optional、default `2026-04`)

**処理**:
1. 認証チェック（既存 `/api/forest/shiwakechou/transactions/route.ts` と同じ pattern、Bearer token + Forest admin/executive）
2. Supabase fetch: `bud_transactions WHERE corp_id=$1 AND status='ok' AND month=$2`
3. `classifier.ts` で各取引を JournalEntry 化（既存 import）
4. `yayoi-csv-exporter.ts` で CSV string 生成（既存 import、Shift-JIS）
5. response:
   - `Content-Type: text/csv; charset=Shift_JIS`
   - `Content-Disposition: attachment; filename="${corp_id}_${month}_弥生.csv"`
   - body: CSV bytes

**禁止**:
- yayoi-csv-exporter.ts の編集
- classifier.ts の編集
- 新しい dep 追加（既存 import のみで完結すべき）

**完了条件**: curl で `?corp_id=hyuaran&month=2026-04` を叩いて CSV download 成功

### Step 2: Forest review page にボタン + handler 追加（20 分）

**ファイル**: `src/app/forest/shiwakechou/[corp_id]/review/page.tsx`（既存編集、core ロジック触らず）

**追加箇所**:
- header の `<Link>` 群の隣に `<button onClick={handleExport}>📤 弥生 CSV export</button>`
- handler `handleExport`:
  ```typescript
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
  ```

**禁止**:
- 既存 14.4K の取引一覧 / 整合性検証 / status フィルタ ロジックの改変
- TransactionListData 型の変更
- スタイル整理 / className 変更

**完了条件**: ボタン click → ブラウザでダウンロード開始

### Step 3: ヒュアラン 4 月分 動作確認（30 分）

**実施者**: a-forest-002 が PR 起票 + Vercel Preview で動作確認 → a-main-026 経由で東海林さんに preview URL 提示 → 東海林さんが弥生会計で import 試行

**確認事項**:
1. CSV 文字化けなし（Shift-JIS 確認）
2. 弥生 import 形式エラーなし
3. 借方 / 貸方の符号正常
4. 摘要欄が判読可能

**詰まったら**: 即停止 → a-main-026 経由で報告（A〜D 案 + 推奨明示、memory `feedback_design_conflict_options_presentation_sop.md` 準拠）

**完了条件**: ヒュアラン 4 月分 CSV が **税理士に送付可能な状態**で出力 + 弥生 import 成功

### Step 4: 残り 5 法人 動作確認（10 分）

centerrise / linksupport / arata / taiyou / ichi で同手順、UI から法人切替して export ボタン click + 弥生 import 試行。

**完了条件**: 6 法人分 CSV 揃う → 税理士に一括送付可能

---

## 5. 担当 + 想定所要

| Step | 担当 | 想定 |
|---|---|---|
| Step 1 API endpoint | **a-forest-002** | 30 分 |
| Step 2 review page button | a-forest-002（連動） | 20 分 |
| Step 3 ヒュアラン動作確認 | a-forest-002 + 東海林さん（弥生 import 実物） | 30 分 |
| Step 4 残り 5 法人 | a-forest-002 + 東海林さん | 10 分 |
| **合計** | | **90 分** |

a-main-026 = 進捗統制 + 障害時の即対応 + Path B（Bud 移植 5/17 以降）トリガー判断

---

## 6. PR 起票

- ブランチ名: `feature/forest-yayoi-csv-export-20260513`
- base: `develop`
- タイトル: `feat(forest): 仕訳帳 弥生 CSV export 機能追加（ヒュアラン決算最優先、dispatch # 351）`
- 本文: 本 dispatch の §3 既存資産 + §4 実装スコープ + 動作確認結果 + Vercel Preview URL

---

## 7. commit メッセージ

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

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 8. 完了報告（a-forest-002 → a-main-026）

下記 4 点を 1 報で報告:
1. PR # 番号 + Vercel Preview URL
2. ヒュアラン CSV download 動作確認 ✅/❌
3. 残り 5 法人 CSV download 動作確認 ✅/❌
4. 詰まり / 想定外があれば A〜D 案 + 推奨明示

---

## 9. 関連 memory（必読）

- `feedback_no_delete_keep_legacy.md` — 既存 lib / UI 触らない
- `feedback_check_existing_impl_before_discussion.md` — 修正前確認 v2
- `feedback_strict_recheck_iteration.md` — 厳しい目で再確認 3 ラウンド
- `project_godo_ux_adoption_gate.md` — 後道さん UX 採用ゲート（弥生 import 実物動作で評価）
- `feedback_design_conflict_options_presentation_sop.md` — 詰まったら A〜D 案

---

EOF

# Codex-447：Root の銀行口座マスタを今の表の形に合わせて直す（2026-10-27）

## 目的
`/root/bank-accounts`（銀行口座マスタ）が 2026-05-13 から**一覧が空・追加もできない**。開発ボードの回答「直す」。
原因：`root_bank_accounts` は Bud の口座表（旧 `bud_bank_accounts`）を改名したもので、列は Bud の形（`id` uuid・`corp_code`・`bank_code` が `mizuho` などの英字）。Root の画面・型・API は古い形（`account_id` の ACC-001・`company_id` の COMP-001・`account_holder`・`purpose`）を見ているので、読み込みの並び替え（`order("company_id")`）で失敗している。表には 12 口座ある。
この表は**仕訳帳（`/forest/shiwakechou`・`src/app/api/forest/shiwakechou/*`）と振込管理（`BankPicker`）が使う**。画面からの書き換えで仕訳・CSV 取り込みが壊れないようにすること。

## 表の実際の形（本番・変えない）
- 列：`id`(uuid・既定 gen_random_uuid)・`corp_code`・`bank_code`・`bank_name`・`branch_name`・`branch_code`・`account_type`・`account_number`・`is_active`・`has_csv_export`・`needs_manual_balance`・`notes`・`sub_account_label`（弥生会計の補助科目名）・`manual_balance_20260430`・`created_at`/`created_by`/`updated_at`/`deleted_at`/`deleted_by`
- 制約：`corp_code` は `hyuaran/centerrise/linksupport/arata/taiyou/ichi` のどれか。`bank_code` は `mizuho/rakuten/paypay/kyoto` のどれか。`branch_code` は空か数字 3 桁。`account_type` は `普通/当座/貯蓄`。`account_number` は空か数字だけ（桁数自由・京都銀行は 0 始まり 7 桁）。`(corp_code, bank_code, account_number)` は重複不可。
- RLS：読むのは誰でも（`deleted_at is null`）。追加・更新は管理者以上（`has_role_at_least('admin')`）か給与の監査役。**削除は不可**（ポリシーで禁止）。
- 法人名は `bud_corporations`（`id` が `hyuaran` など・`name_short`）から引く（参考：`src/app/bud/expenses/_components/expenseCorpUtils.ts`・`src/app/bud/transfers/_components/BankPicker.tsx`）。

## やること
1. **型・取得・保存**（`src/app/root/_constants/types.ts` の `BankAccount`・`src/app/root/_lib/queries.ts`・`src/app/api/root/view-data/route.ts`）
   - `BankAccount` を表の実際の形にする（`manual_balance_20260430` は型に入れてよいが画面には出さない）。
   - view-data の `root-bank-accounts` の並び替えを `corp_code`・`bank_code`・`account_number` に。法人名用に `bud_corporations`（`id,name_short`）のデータセットを足す（`companies` は使わなくなるなら外す）。歯車（閲覧権限・`systemViewResponse`）の判定はそのまま。
   - 追加は `insert`（`id` は送らない＝DB が作る）。修正は `.update(変える列だけ).eq("id", id)`。**upsert は使わない**（部分更新で他の列を消す事故を防ぐ）。有効／停止は `is_active` を `id` で更新。
2. **画面**（`src/app/root/bank-accounts/page.tsx`）。見た目は今の Root のほかのマスタ画面と同じ社長スタイルの部品のまま。
   - 一覧の列：法人（name_short）／銀行（bank_name）／支店（名前とコード）／種別／口座番号（`CLARITY_MASK`）／弥生の補助科目名／明細の取り込み（「CSV」か「残高を手入力」）／状態／操作（編集・停止／再開）。12 口座がこの順で見えること。法人の絞り込みは今どおり。
   - 追加の小窓：法人（上の 6 社から選ぶ）・銀行（みずほ銀行／楽天銀行／PayPay銀行／京都銀行 から選ぶ＝`bank_code` と `bank_name` が一緒に決まる）・支店名・支店コード（3 桁・空でも可）・種別（普通／当座／貯蓄）・口座番号（数字・必須）・弥生の補助科目名・「CSV で明細を取り込める」・「残高を手で入れる」・メモ。
   - **修正の小窓では 法人・銀行・口座番号 を変えられない**（灰色で表示し、下に「取り込んだ明細と仕訳がこの口座に結びついているため変えられません。変わったときは新しく追加して、古い口座を停止してください」）。変えられるのは支店名・支店コード・種別・補助科目名・2 つのチェック・メモ。補助科目名の下に「弥生会計の補助科目名と同じにします。仕訳の書き出しで使います」。
   - 削除ボタンは作らない（停止で代える）。
   - 重複（unique 違反）のときは「同じ法人・銀行・口座番号の口座がもうあります」。それ以外の失敗も英語のまま出さず日本語の文で。
   - 書ける人は今どおり `canWrite`（管理者以上）。監査ログ（`writeAudit`）は `targetId` を `id` に。
   - 「Ctrl+↑↓・Ctrl+Enter」の操作は今どおり。説明文は「法人ごとの銀行口座。仕訳帳の明細取り込みと振込で使います。」のように行動を書く（開発者用語を書かない）。
3. **入力チェック**（`src/app/root/_lib/validators.ts` の `validateBankAccount`）を表の制約に合わせる（ACC- 形式・4 桁の金融機関コード・7 桁固定・名義必須はやめる）。
4. **テスト**：`validators.masters.test.ts` の口座の部分を書き直し。画面のテスト（新規でよい）で「Bud の形の 12 行が見える」「追加は id なしの insert」「修正は変えられる列だけを id で update・法人・銀行・口座番号は送らない」「停止は is_active だけ」を確かめる。`npx vitest run` が全部通ること。

## 触らないもの
- **DB（migration は作らない）**・本番。Bud・Forest（仕訳帳・振込・明細）のファイルは読むだけで変えない（`src/app/bud/statements/*` が古い `account_id` を見ているのは別件として完了報告に書くだけ）。
- **git は触らないでください。コミットは人間側が行います。** npm install はしない。長い説明は不要・ファイルは必要な範囲だけ読む。

## 確認
`npx tsc --noEmit`・`npx vitest run`。日本語が「???」に化けていないこと。ファイルの先頭に BOM を付けないこと。

## 完了報告（コードブロックで）
変更ファイル／テスト結果／修正で送る列の一覧／Bud・Forest のファイルを変えていないことの確認。

# Codex-408：口座残高 ①新しい銀行口座の起点を自動で入れる ②銀行すべて・カードすべての閲覧権限（2026-10-21）

前の指示書：`docs/dispatches/dispatch-codex-397*`・`401*`・`405*`（anchor／arrival／設定モード）。Codex-407 の変更が作業ツリーにある（触らない）。

## 東海林さんの決定（2026-10-21）
1. MF に口座が増えたら、**起点（最初の残高）も自動で入れて**、手作業なしで残高が出るようにする
2. **「銀行すべて」「カードすべて」に閲覧権限をまとめて付けられる仕組み**。1 つずつ付けるのは、口座が増えると大変

## 調べた事実（Claude・読むだけ）
- MF の API には銀行の残高そのものは無い（connected_accounts・transactions とも残高の欄なし）
- connected_accounts の `connected_sub_accounts[]` に `account_id`・`sub_account_id`（帳簿の勘定科目・補助科目の id）がある
- 今の新しい口座の扱い：`mergeAccounts`（`src/lib/bud/mf/balances.ts`）で balance_mode=manual_check・「帳簿との対応を確認中です」・見る人＝BUD_MF_DEFAULT_VIEWERS（EMP-0000,0004,0008）
- 既存の口座は全部 balance_mode=arrival（残高＝anchor_balance＋anchor_at より後に届いた入出金）

## ① 起点の自動設定（銀行口座だけ）
- 初めて見た銀行口座（saved に無い mf_account_id）で、`connected_sub_accounts` の `sub_account_id` から試算表（`client.trialBalance()`）の普通預金の補助科目を探す（試算表の行に id があればそれで、無ければ補助科目の一覧 API で名前を引く。MF は GET だけ）
- 見つかったら：anchor_balance＝帳簿の期末残高＋今年度の未仕訳の入出金（今の auto の計算と同じ）・anchor_at＝今・anchor_date＝今日・balance_mode＝arrival・book_sub_account_name＝その名前・balance_note＝「起点を自動で設定（帳簿＋未仕訳・YYYY/MM/DD）」
- 見つからない・複数ある・試算表が読めない → 今どおり manual_check（「帳簿との対応を確認中です」）。そのときは Garden 通知（Chatwork・既存の送り方）で「口座残高：新しい口座『○○』の最初の残高を自動で入れられませんでした。設定から入れてください」を 1 回
- 既存の口座の起点は触らない
- 設定の画面の起点の欄に、自動で入れたときはその旨（balance_note）を出す。手で直せるのは今どおり

## ② 銀行すべて・カードすべての閲覧権限
- 表 `bud_mf_group_viewers`（kind 'bank'／'card'・employee_ids text[]・updated_at・updated_by）。migration で bank・card とも今の BUD_MF_DEFAULT_VIEWERS の 3 人を入れる
- 見られる口座＝その口座の閲覧権限（visible_employee_ids）に入っている **または** その種類（銀行／カード）のまとめ権限に入っている。hidden の扱いは今どおり。API・画面の絞り込みの両方
- 新しい口座はまとめ権限で自動的に見える → mergeAccounts の visible_employee_ids の初期値は空にする（BUD_MF_DEFAULT_VIEWERS は使わない）
- 退職者を自動で外す処理（`bud_mf_apply_fetch` の中・20261021000007）を、まとめ権限にも同じく
- 画面（設定モード）：口座残高タブの設定モードでは一番上に「銀行すべての閲覧権限」、カード利用タブでは「カードすべての閲覧権限」のカード（口座のカードと同じ形・歯車で開く）。開くと今の口座の閲覧権限と同じ部品（在職者だけ・名前検索・チェックのそろった並び・保存／閉じる）。説明の 1 行：「ここに入れた人は、今ある口座と、これから増える口座をすべて見られます」
- 口座ごとの閲覧権限の画面では、まとめ権限で見られる人はチェック済み・押せない（灰色）で「すべての口座で閲覧可」と添える
- 保存は全権管理者だけ（今の口座の設定と同じ判定）。監査の記録があれば同じく残す

## 見た目
- 社長スタイルの正本 §2.5／§2.6（`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md`）に従う。ボタンのマークは TabActionButton（線画）

## テスト
- 起点の自動設定（見つかった／見つからない→manual_check と知らせ 1 回／既存は触らない）
- 見られる口座の判定（個別のみ・まとめのみ・両方・hidden）
- 新しい口座の visible_employee_ids は空
- 退職者がまとめ権限からも外れる（SQL の文面のテスト。既存の active-viewers.test と同じ形）
- 設定モードのまとめ権限のカードと保存・口座ごとの画面の灰色のチェック

## 守ること
- commit・push しない。DB・MF・Chatwork・外部 API に接続しない
- migration は `supabase/migrations/20261021000009_bud_mf_group_viewers.sql`（Claude が本番に当てる）
- `npx vitest run src/lib/bud/mf src/app/bud/bank src/app/api/bud` と `npx tsc --noEmit -p .` が通ること（テスト時は .env.local の NEXT_PUBLIC_SUPABASE_URL／ANON_KEY を環境変数に入れて流す）

## 報告（日本語・コードブロック）
変えたファイル・migration・テストの結果・Claude がやることだけ短く。

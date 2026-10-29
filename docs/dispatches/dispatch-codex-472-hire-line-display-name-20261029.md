# Codex-472：入社確認の②で、確認コード（PIN）のあとに「LINE 管理画面の表示名を変える」を挟む（2026-10-29）

## 東海林さんの話
- 公式 LINE（official｜通知）の管理画面では、チャットの相手の表示名を「社員番号 氏名」（例：0004 上田 基人）に変えている。これは API では変えられない・読めない（管理画面だけの機能）。
- 変え忘れを防ぐため、**入社確認の②で確認コード（PIN）が通ったあと、「表示名を変更してください」を出し、［変更した］を押したら次（③ FileMaker）に進めるようにする**。

先に読む：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md` §2.5〜§2.7。画面の文字に略称・開発者用語を書かない。絵文字なし。

今の作り（読んでから作る）：
- 画面 `src/app/system/onboarding/HireConfirmationSteps.tsx`（① 締結 → ② LINE テスト送信 → ③ FileMaker）
- 判定 `src/app/system/onboarding/_lib/hire-candidates.ts` の `lineComplete`（画面と③の依頼の両方で使う）
- 入口 `src/app/system/onboarding/_lib/hire-line.server.ts`（`action: "send" | "verify"`）と、その API の route
- 表 `system_hire_candidates`（`line_verified_at` など。`supabase/migrations/20261027000450_hire_line_verification.sql`）

## 1. データ
- migration `supabase/migrations/20261029000472_hire_line_display_name.sql`：`system_hire_candidates` に `line_display_renamed_at timestamptz`・`line_display_renamed_by uuid` を足す。
- **すでに確認コードが済んでいる人（line_verified_at がある行）は、`line_display_renamed_at = line_verified_at` で埋める**（今までの人は手で変えている前提。今の手続きを止めない）。
- 本番 DB に当てるのは Claude。Codex は当てない。

## 2. 決まり
- `lineComplete` は「確認コードが済み **かつ** 表示名を変えた」、または「LINE 登録しない」にする（「登録しない」の扱いは今のまま）。③の依頼の入口も同じ判定なので、表示名を変えるまで FileMaker に依頼できない。
- 入口に `action: "renamed"` を足す：確認コードが済んでいる行だけ受け付け、`line_display_renamed_at=now()`・`line_display_renamed_by=操作した人` を入れる。済んでいない行は 409「先に確認コードを確認してください」。
- 「戻す」：表示名の記録だけを消す操作（`action: "renamed_undo"`）も足す（押し間違い用・③がまだのときだけ）。

## 3. 画面（② LINE テスト送信 の中・確認コードが通ったあと）
```
② LINE テスト送信                                  確認済み
──────────────────────────────────────────────
LINE 管理画面で、この人の表示名を変えてください
  変える名前： 0004 上田 基人   [名前をコピー]
  1. LINE 管理画面のチャットを開く（新しいタブ）  ← https://manager.line.biz/account/@586gtqpd/chat へのリンク
  2. この人のチャットを開き、名前の横の鉛筆を押す
  3. 上の名前を貼り付けて［保存］
                                        [変更した]
```
- 変える名前＝「社員番号（4 けたに 0 埋め） 氏名」（氏名の姓と名の間は全角スペース 1 つ＝Root の氏名のまま）。
- ［変更した］を押すと②が「確認済み・表示名変更済み」になり、③に進める。それまで③は「②の LINE 確認と表示名の変更が済むと進めます」と出して止める。
- 「LINE 登録しない」の人には、この手順は出さない。

## 4. テスト
- `lineComplete`：確認コードだけでは未完了／表示名を変えると完了／登録しないは今のまま完了。
- 入口：確認コードが済んでいないと renamed が 409・renamed で記録が入る・renamed_undo で消える。
- 画面：確認コードのあとに手順と名前（0 埋め）が出る・［変更した］まで③が止まる・登録しない人には出ない。
- migration：既存の確認済みの行は埋まる。

## 終わったら
- `npx tsc --noEmit` と関係するテストを通す。完了報告（コードブロック）。
- ファイルは UTF-8（BOM なし）。**git は触らない（commit しない）。npm install しない。本番の DB に当てない。LINE へ送らない。**

## 実装時の取得回数
- 定期的な取得・cron の追加は無し（1 日 0 回）。［変更した］を押したときに 1 回書くだけ。LINE への送信は増えない。

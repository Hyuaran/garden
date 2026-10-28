# Codex-465：郵便の転送に「届出待ち」と「転居届の書き方（画像）」を足す（2026-10-28）

## 東海林さんの話
- e転居で出せなかった 8 件（4 社 × NLC から／登記住所から）を、郵便局の窓口に紙の転居届で出す。まだ出していない。
- 「届出待ちで登録できるようにして、小窓に転居届の書き方の画像リンクを置いて」（GO 済み）。書き方の画像は 1 件 1 枚（Claude が作った PNG）。

先に読む：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md` §2.5・§2.6。画面の文字に略称・開発者用語を書かない。絵文字なし（印は SVG の線）。

今の作り：`src/app/root/mail-forwarding/page.tsx`・`AddressInputs.tsx`・`src/lib/mail-forwarding/{domain,notify,address}.ts`・`src/app/api/root/mail-forwarding/cron/route.ts`・`supabase/migrations/20261028000462_root_mail_forwarding.sql`。

## 1. migration（`supabase/migrations/20261028000465_root_mail_forwarding_unfiled_guide.sql`）
- `root_mail_forwardings` に `guide_path text`（任意・Storage の中の場所。例 `forwardings/<id>.png`）を足す。
- `root_mail_forwarding_notices.stage` の check に `'unfiled'` を足す。
- `root_mail_forwarding_create(p_row, p_filing)`：**`p_filing` が null なら転送の行だけ作る**（届出の記録は作らない）。
- Storage のバケット `root-mail-forwarding`（private）を作る（無ければ）。読み書きは service_role だけ（画面からは下の入口を通す）。
- 本番に当てるのは Claude。Codex は当てない。

## 2. 届出待ち（届出の記録が 0 件の転送）
- 一覧：届出日＝「届出待ち」、期限＝「―」、残り＝**✖ 赤「届出待ち」**。並びは**一番上**（切れているものより上）。「止めた」は今までどおり一番下。
- ［届け直した］は届出待ちの行では文字を「届け出た」にする（押したあとの動きは同じ。最初の届出の記録が入って期限が付く）。小窓の題も同じ。
- 届出の方法の選択肢に**「窓口」**は既にある。窓口で出したものは方法＝窓口で記録する。
- ［＋ 転送を追加］の小窓に「まだ届けていない（届出待ち）」のチェックを足す。チェックすると届出日・方法・受付番号・届けた人・届出のメモの欄を隠し、転送の行だけ作る（`p_filing` に null）。既定はチェックなし（今までどおり）。
- 期限・残りを使っている所（`expiry`・`remaining`・`sortForwardings`・`dueNotice`）が届出 0 件で落ちないこと。

## 3. 知らせ（届出待ち）
- 届出待ちの転送は、毎朝の確認で **週に 1 回**（その週の月曜日を `filed_on` に入れた `stage='unfiled'` の記録で 1 週 1 回）Garden通知へ送る。登録した日の翌朝が最初。「止めた」は送らない。
- 文面（例）：
```
[info][title]郵便の転送がまだ届けられていません[/title]
名義：株式会社〇〇
転送元：…
転送先：…
郵便局の窓口（または e転居）で転居届を出して、Garden の「郵便の転送」で［届け出た］を押してください。
（Garden の郵便の転送の URL）[/info]
```
- 既存の段階（60/30/14/7/expired）の動きは変えない。テストで確かめる。

## 4. 転居届の書き方（画像）
- 小窓（行を押したとき・［届け出た］／［届け直した］の小窓の両方）に、`guide_path` があるときだけ「**転居届の書き方（画像）を開く**」のリンクを出す。新しいタブで開く。
- 入口 `GET /api/root/mail-forwarding/guide?id=<転送の id>`：郵便の転送を**見てよい人**（`root_mail_forwarding_can_read()` と同じ決まり。全権管理者は常に可）だけ。その行の `guide_path` の画像を Storage から読み、そのまま返す（`Content-Type: image/png`・`Cache-Control: private, no-store`）。無ければ 404、見てはいけない人は 403。
- 画像を上げる画面は作らない（Claude が service_role で上げて `guide_path` を入れる）。

## 5. テスト
- 届出 0 件の行：一覧の表示・並び・小窓・［届け出た］で記録が入り期限が付く。
- 知らせ：unfiled は週 1 回・止めたは送らない・届け出たら unfiled は止まる・既存の段階は今までどおり。
- 追加の小窓：チェックありで `p_filing` が null。
- 画像の入口：見てよい人は 200（image/png）・ほかは 403・guide_path なしは 404。

## 6. 終わったら

実装時の回数見積もり：既存の毎朝の確認を利用（1日1回、追加の定期実行は0回）。届出待ちの通知は転送1件あたり週1回まで。画面の自動取り直しは追加なし（1日0回）。画像はリンクを開いた時だけ取得する。
- `npx tsc --noEmit` と関係するテストを通す。完了報告（コードブロック）。
- **git は触らない（commit しない）。npm install しない。本番の DB に当てない。**

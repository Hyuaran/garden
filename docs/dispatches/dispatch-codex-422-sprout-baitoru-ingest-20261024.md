# Codex-422：バイトル応募の取り込み（Garden 側・段階 1）（2026-10-24）

## 目的
設計書 C:\Claude\000_Garden\150_System_システム\02_入社手続き\006_設計_バイトル応募の取り込みをGardenへ_20261024.md の段階 1。
元の Cloud Run 版（宮永さん作・停止中）の仕様：C:\Claude\000_Garden\150_System_システム\02_入社手続き\005_参考_バイトル自動化_仕様書_AI向け_20261024.md（以下「元仕様」。§5 処理順・§7 重複判定・§8 Kintone 項目・§9-1 通知文・§12 掲載期間）。
ホスト PC がバイトルの応募 CSV の行を Garden へ送る → Garden が重複判定 → Sprout（`sprout_applicants`）に登録 → Kintone「求人 応募者一覧」（44）に写し → Chatwork に通知、までを Garden 側に作る。ホスト PC 側（Playwright）は次の段階で作るので今回は作らない。

## 画面の絵（Sprout に「バイトル取り込み」タブを足す・super_admin のみ）
```
Sprout ／ 採用管理
[応募者] [面接予定] [研修予定] [バイトル取り込み]
┌ 取り込みの設定 ─────────────────────────────┐
│ 取り込み：( ) 動かす  (●) 止める（掲載していない間は止める）     │
│ 掲載期間の開始日 [2026-09-22]   通知のタイトル [【バイトル新規応募】HR 9/22～10/5] │
│ 今回だけ除外する問合せ番号 [            ]（カンマ区切り）        │
│ 通知先：( ) 本番ルーム  (●) 開発ルーム        メンション [ 複数行 ] │
│ 1 回に登録する上限 [10]                         [保存]           │
└──────────────────────────────────────┘
取り込みの記録（新しい順）：日時｜読んだ行｜新規｜重複でとばし（理由別）｜不足でとばし｜通知の失敗｜結果
  通知に失敗した応募は［もう一度知らせる］
```

## やること
1. migration `supabase/migrations/20261024000005_sprout_baitoru.sql`：
   - `sprout_baitoru_settings`（1 行：enabled bool 既定 false、period_start date、chatwork_title、exclude_inquiry_nos text[]、notify_room（'production'/'dev'）既定 'dev'、mentions text、max_per_run int 既定 10、updated_at/by）
   - `sprout_baitoru_runs`（取り込みの記録：counts jsonb・dedup_by_reason jsonb・error・dry_run）
   - `sprout_applicants` に列を足す：inquiry_no text unique（問合せ No）、source text（'kintone'/'baitoru'）、notified_at、notify_error、is_repeat bool
   - RLS：super_admin のみ select／settings は super_admin が update
2. 受け口 `POST /api/sprout/baitoru/ingest`：ホスト PC から `{ rows: [ { "問合せNo": "...", "応募日時": "...", "氏名（漢字）": ..., ... CSV の見出し名そのままのキー } ], dryRun?: boolean }`。認証は `Authorization: Bearer <RELAY_SECRET>`（既存の中継と同じ合言葉・timingSafeEqual）。enabled=false なら何も書かずに `{ ok:true, skippedReason:'disabled' }`。二重実行防止（advisory lock）。
3. 処理（元仕様 §5 の 4〜15 を移植）：seed 番号（環境変数 `BAITORU_SEED_INQUIRY_NO`、既定 238839645）以下を捨てる → 応募日 < 掲載期間の開始日を捨てる → 除外番号を捨てる → 重複判定（元仕様 §7 の正規化・6 種類のキー・5 ルールをそのまま。既存側は **Garden の `sprout_applicants`（Kintone から取り込んだ分を含む）** で作る）→ 必須チェック（氏名・メール・電話・応募日時）→ 古い順・上限件数 → Sprout に登録 → Kintone 44 に写し（元仕様 §8-2 の必須項目と §8-3 の任意項目。姓名の分け方は元仕様 §8-2 の手順＝姓の辞書は元のリポジトリに無いので「空白で分ける→文字数で推定」だけで良い）→ Chatwork 通知（元仕様 §9-1 の本文。Kintone の URL は登録できた record id、できなければ Garden の Sprout の URL）。dryRun のときは判定結果だけ返す。
4. Kintone の写しに失敗しても Sprout には残し、記録に「Kintone に登録できませんでした（理由）」を出す（44 のトークンに追加の権限が無いと 403 になる想定）。トークンは `KINTONE_RECRUIT_APPLICANTS_TOKEN`（今は閲覧のみ）。
5. Chatwork：本番ルーム＝環境変数 `SPROUT_BAITORU_CHATWORK_ROOM_ID`（既定 365721933）、開発ルーム＝`CHATWORK_DEV_ROOM_ID`。送る人は既存の自動配信用トークン（Garden で既に使っている自動送信用の Chatwork トークンの環境変数を探して使う）。通知済みは `notified_at` に記録し、失敗分は画面から再送できる。
6. 失敗の知らせ：受け口が 3 回続けて失敗（または 30 分以上ホスト PC から届かない＝enabled のときだけ）したら Garden 通知ルームへ 1 回、回復したら 1 回（障害ごとに 1 回）。今回は「受け口が呼ばれた時刻」を記録するところまでで良い（届かない検知の cron は足さない）。
7. 画面：上の絵のタブ（Codex-420 の `src/app/sprout/sprout.tsx` の作りに合わせる）。
8. テスト：重複判定 5 ルール（元仕様 §7 の例・`scripts/dedup-test.js` 相当の 7 ケースを再現）、正規化、掲載期間・seed・除外、上限、disabled、dryRun で書かない、認証、Kintone 失敗時も Sprout に残る、通知の再送。

## 触らないもの
- `src/app/bud/bank/` 配下。本番 DB・Vercel・Kintone・Chatwork に実際には書かない。**git は触らないでください。コミットは人間側が行います。** npm install はしない。

## 確認
`npx tsc --noEmit` と変更範囲の `npx vitest run <対象>`。画面の文言に開発者用語を出さない。

## 完了報告（コードブロックで）
変更・追加ファイル／migration の要点／ホスト PC から送る本文の形（キー名）／テスト結果／気になった点。

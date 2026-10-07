# Codex-364：INNOVERA（クラウド PBX）の回線一覧を Kintone「INNOVERA 番号一覧」へ自動反映する（2026-10-07）

## 目的（東海林さんの言葉）
「回線情報一覧に新しい番号が増えたり、番号を廃止したり、回線名を変更したりしたときに Kintone アプリに自動で変更できればめっちゃいい」「業務中にイノベラを書き換えることが多いので、朝イチ 1 回ではなく、できるだけタイムリーに随時反映したい」→ 仕様確定・GO 済み。

## 作業場所・禁止事項
- 作業ツリー：`C:\garden\a-bloom-008`（main 2aebf18e）。**git の操作は一切しない**（add / commit / push / stash / checkout すべて禁止。コミットは Claude がやる）
- 触ってよい場所：`src/app/api/system/innovera-sync/`（新規）・`src/app/system/innovera/`（新規）・`src/lib/innovera/`（新規）・`supabase/migrations/`（新規 1 本）・`vercel.json`（cron を 1 行足す）・`src/app/system/_components/ShachoShell/shacho-shell-config.ts`（メニューを 1 行足す）
- **本物の INNOVERA・Kintone・Supabase にはつながない**。環境変数は `.env.local` に Claude が入れるが、Codex はテストでモック（`fetch` の差し替え）だけを使う。実機の確認は Claude がやる
- 絵文字は使わない（アイコンは既存の SVG 線画）。色の直書きはしない（テーマ変数だけ）。画面の文言に開発者用語（API・cron・sync・レコード等）を出さない

## 相手の仕様（実測済み・2026-10-07）

### INNOVERA 回線検索
- `POST https://${INNOVERA_API_HOST}/pbx/api/front/index/?ckey=circuit&akey=search`
- 本文は `application/x-www-form-urlencoded`。`api_key=${INNOVERA_API_KEY}` だけ（絞り込みなし＝全件）
- 返り：`{ result: true, error_code: "", data: [ {…}, … ] }`。失敗は `result: false` と `error_code`（999＝キー違い・429＝回数超過。5 分 200 回まで）
- `data` の 1 件（使う項目だけ）：

| 項目 | 意味 | 例 |
|---|---|---|
| `circuit_num` | 識別番号（Kintone の「識別番号」と同じ 3 桁） | `"004"` |
| `name` | 回線名称 | `"【ヒュアラン】0120-966-159"` |
| `number` | 回線番号（050 など） | `"0677772897"` |
| `free_number` | 0120／0800 番号（無ければ空） | `"0120966159"` |
| `related_number` | 関連特番（無ければ空） | `"0644005414"` |
| `inserted` | 登録日時（`YYYY-MM-DD HH:MM:SS`・日本時間） | `"2016-04-18 18:20:51"` |
| `updtdate` | 更新日時 | |
| `status` | 全部 `"1"`（使わない） | |

- **廃止した回線は返ってこない**（消えるだけ。停止フラグは効かない）。いま 67 件

### Kintone「INNOVERA 番号一覧」（app `KINTONE_INNOVERA_APP_ID`＝189）
- 既存の部品 `src/lib/kintone/records.ts` の `getAllRecords` / `createRecord` を使う。**更新（PUT record.json）は部品に無いので `updateRecord(app, token, id, record)` を同じファイルに足す**（`createRecord` と同じ形・`X-Cybozu-API-Token`・`Content-Type: application/json`・本文 `{ app, id, record }`）
- 項目（フィールドコード＝ラベル）：

| コード | 型 | 使い方 |
|---|---|---|
| `識別番号` | 文字 | 突き合わせの鍵（INNOVERA の `circuit_num`） |
| `回線番号` | 文字 | INNOVERA の `number` |
| `FD番号` | 文字 | `free_number` → 無ければ `related_number` → 無ければ `number` |
| `最終回線名称` | 文字 | 最新の回線名称 |
| `最終番号ステータス` | ラジオ | `使用中`／`未使用`／`削除` |
| `発番日` | 日付 | INNOVERA の `inserted` の日付部分 |
| `廃止日` | 日付 | Garden が消えたのを見つけた日（日本時間） |
| `ドロップダウン`（ラベル「削除」） | 選択 | `依頼中` か空。廃止処理をしたら空にする |
| `最終入力日時` | 日時 | 履歴の最新行の入力日時 |
| `最終行番号` | 数値 | 履歴の最新行の行番号 |
| `テーブル` | 履歴（サブテーブル） | 下の 5 列。**Kintone の仕様で更新時は表を丸ごと送る**（既存行＋新しい行） |

- 履歴テーブル `テーブル` の列：`回線名称`（文字）・`入力日時`（日時）・`入力者`（ユーザー選択）・`行番号`（数値）・`番号ステータス`（ラジオ・使用中／未使用／削除）
- `入力者` は Garden のロボットアカウント（ユーザーコード `Garden`）を入れる：`{ value: [{ code: "Garden" }] }`。**もし Kintone が 400 を返したら `入力者` を送らずにもう一度だけ更新する**（ロボットアカウントがユーザー選択の対象外だった場合の保険）
- Kintone の日時は UTC の ISO 形式（例 `2026-10-07T10:00:00Z`）。`発番日`・`廃止日` は `YYYY-MM-DD`
- 既存データの癖：識別番号に `000-1` のような人手の値がある（INNOVERA に無い＝突き合わせから外れるだけでよい）。識別番号は 3 桁ゼロ埋めで比べる（`"4"` と `"004"` は同じ）

## 突き合わせの規則（純粋関数にしてテストを書く：`src/lib/innovera/diff.ts`）
入力＝INNOVERA の回線一覧と Kintone の全件。出力＝「やること」の配列。種類は 4 つ。

| 種類 | 条件 | Kintone への書き込み |
|---|---|---|
| 新規 | INNOVERA にあって Kintone に無い識別番号 | レコード追加：識別番号・回線番号・FD番号・最終回線名称・発番日（inserted）・最終番号ステータス＝**未使用**・最終入力日時＝今・最終行番号＝1・履歴 1 行（回線名称・入力日時＝今・入力者＝Garden・行番号 1・番号ステータス＝未使用） |
| 名称変更 | 両方にあり、`name` と `最終回線名称` が違う（前後の空白は無視・全角半角はそのまま比べる） | 最終回線名称＝新しい名前・最終入力日時＝今・最終行番号＝既存の最大＋1・履歴に 1 行追加（番号ステータスは**今の最終番号ステータスをそのまま**写す。使用中／未使用は Garden が変えない） |
| 廃止 | Kintone にあって INNOVERA に無く、`最終番号ステータス` が `削除` でない | 最終番号ステータス＝削除・廃止日＝今日（空のときだけ入れる。既に入っていれば触らない）・ドロップダウン（削除）＝空・最終入力日時＝今・最終行番号＝最大＋1・履歴に 1 行（回線名称＝最終回線名称のまま・番号ステータス＝削除） |
| 要確認 | 両方にあるが `number` と `回線番号` が違う（数字以外を除いて比べる）／または Kintone 側が `削除` なのに INNOVERA に戻ってきた | **書かない**。画面と記録に「要確認」として出す |

- 上のどれにも当たらない＝変化なし（書かない）。**同じ状態で何度走っても 2 回目は何も書かない**こと（テストで確認）
- 発番日・FD番号・回線番号は既存レコードでは触らない（新規のときだけ入れる）
- 「使用中／未使用」は Garden が決めない（新規＝未使用で入れるだけ。以後は人が Kintone で変える）
- 書き込みは 1 件ずつ（`createRecord`／`updateRecord`）。1 件失敗しても残りは続け、失敗を記録に残す

## 入口（API）：`src/app/api/system/innovera-sync/`
1. `cron/route.ts`：**GET**（Vercel の定時実行は GET で呼ぶ）。`verifyBearerRequest(request, "CRON_SECRET")` で守る（`src/lib/cron-auth.ts`）。中身＝下の「1 回の反映」を `apply=true` で実行
2. `route.ts`：画面から呼ぶ。ログイン済み・役職 staff 以上だけ（`src/app/system/sites/page.tsx` と同じ判定を API 用に）。`GET`＝突き合わせだけ（書かない・やることの一覧と件数を返す）／`POST`＝反映（書く）。どちらも結果を JSON で返す
3. 「1 回の反映」の共通処理は `src/lib/innovera/sync.server.ts` に置き、両方の入口から呼ぶ：INNOVERA を読む → Kintone 全件を読む → `diff` → `apply` なら書く → `system_innovera_sync_log` に 1 行残す → 結果を返す
4. INNOVERA か Kintone の読み取りに失敗したら**何も書かず**に失敗として記録する（片方が落ちているときに全件「廃止」にしない。これが一番大事）。INNOVERA が 0 件を返したときも同じ扱い（0 件＝異常とみなして書かない）
5. 環境変数：`INNOVERA_API_HOST`・`INNOVERA_API_KEY`・`KINTONE_INNOVERA_APP_ID`（既定 `189`）・`KINTONE_INNOVERA_TOKEN`・既存の `KINTONE_SUBDOMAIN`。足りなければ `ok:false, error:"not_configured"`（画面には「設定が終わっていません。管理者へ問い合わせてください」）

## Chatwork 通知（東海林さんへ・ルーム「Garden通知」）
- 反映して **1 件でも書いた**とき（自動・手動どちらも）と、**失敗した**とき（読み取り失敗・INNOVERA 0 件・書き込み失敗あり）に 1 通送る。差分 0 件は送らない
- 送り先＝環境変数 `GARDEN_NOTICE_CHATWORK_ROOM_ID`（既定 `450125458`）。差出人＝既存の `CHATWORK_API_TOKEN`（【事務局】システム自動通知）。部品は `ChatworkClient` from `@/lib/chatwork`（`new ChatworkClient(token).sendMessage(roomId, body)`・`src/app/api/system/nhk-visit/daily-report/route.ts` と同じ）
- 送れなくても反映の結果は変えない（通知の失敗は記録の `error` に添えるだけ）
- 本文（Chatwork の `[info][title]…[/title]…[/info]` 形式・絵文字なし）：

```
[info][title]電話番号の同期（INNOVERA → Kintone）[/title]2026-10-07 14:35 自動
新規 1件・名称変更 1件・廃止 1件・要確認 1件

新規：180 05088968665 08006000830
名称変更：093 【CBキャンペーン窓口2】0800-600-0585 → 【CBキャンペーン窓口2発信専用】0800-600-0585
廃止：041 0677774095 クローザー携帯発信12/1～_元FプレインOCN光
要確認：096 05088887832 回線番号が Kintone と違います

確認：https://garden-os.net/system/innovera[/info]
```
- 明細は種類ごとに最大 10 件まで。超えたら「ほか n 件」。失敗のときは 1 行目の後に「反映できませんでした：<理由>」を入れ、書けた分があれば明細も出す

## 記録（Supabase・移行ファイル 1 本：`supabase/migrations/20261007000001_system_innovera_sync_log.sql`）
```sql
create table if not exists public.system_innovera_sync_log (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  trigger text not null,            -- 'cron' | 'manual'
  applied boolean not null,         -- true=書いた false=見ただけ
  ok boolean not null,
  innovera_count integer,
  kintone_count integer,
  added integer not null default 0,
  renamed integer not null default 0,
  retired integer not null default 0,
  needs_review integer not null default 0,
  failed integer not null default 0,
  details jsonb not null default '[]'::jsonb,   -- やることの一覧（種類・識別番号・回線番号・前の名前・新しい名前・結果）
  error text,
  actor_employee_id text
);
alter table public.system_innovera_sync_log enable row level security;
```
- サービスロール（`getSupabaseAdmin`）だけが書く。RLS のポリシーは足さない（他の `system_*_log` と同じ）
- **変化なし（やること 0 件）の定時実行は記録しない**（5 分ごとに空の行が増えるのを防ぐ）。手で押したときは 0 件でも記録する

## 定時実行：`vercel.json` に 1 行
```json
{ "path": "/api/system/innovera-sync/cron", "schedule": "*/5 * * * *" }
```

## 画面：`src/app/system/innovera/`（社長スタイル・既存の `system/sites` や `system/deliveries` と同じ骨組み）
- メニュー（`shacho-shell-config.ts`）に 1 行：`{ label: "電話番号の同期", description: "INNOVERA の回線一覧を Kintone の番号一覧へ自動で写します。増えた・消えた・名前が変わった番号をここで確認できます。", icon: "folder", href: "/system/innovera", minRole: "staff" }`。並びは「コーポレートサイト」の次
- ページ本体は `page.tsx`（サーバー側で役職判定）＋ `InnoveraSyncClient.tsx`（画面）＋ `innovera.module.css`

```
社内システム ／ 電話番号の同期

INNOVERA の回線一覧と Kintone の番号一覧を 5 分ごとに突き合わせ、差分だけを Kintone に写します。
使用中・未使用の区別は Kintone で人が決めます（Garden は変えません）。変更があったときは Chatwork「Garden通知」にも知らせます。

┌ 最後の反映 ─────────────────────────────────────────┐
│ 2026-10-07 14:35（自動）  新規 1件・名称変更 0件・廃止 0件・要確認 0件 │
└──────────────────────────────────────────────┘

[ いまの差分を見る ]   [ 今すぐ反映 ]        ← 反映は「差分を見る」で一覧を出した後だけ押せる

差分の一覧（2026-10-07 14:40 時点）
┌───────┬──────┬──────────┬────────────────────────────┐
│ 種類     │ 識別番号 │ 回線番号      │ 内容                                       │
├───────┼──────┼──────────┼────────────────────────────┤
│ 新規     │ 180     │ 05088968665  │ 08006000830（発番 2026-09-16）              │
│ 名称変更 │ 093     │ 0800600058 5 │ 【CBキャンペーン窓口2】… → 【CB…発信専用】… │
│ 廃止     │ 041     │ 0677774095   │ クローザー携帯発信12/1～_元FプレインOCN光    │
│ 要確認   │ 096     │ 05088887832  │ 回線番号が Kintone と違います（Kintone: …）  │
└───────┴──────┴──────────┴────────────────────────────┘
差分がないときは「差分はありません。Kintone は最新です。」

これまでの反映（新しい順・20 件）
日時 ／ きっかけ（自動・手動）／ 新規・名称変更・廃止・要確認・失敗 ／ ▸ 明細（折りたたみ）
```

- 「今すぐ反映」は押したら Loading スタイルで待ち画面（二重押し防止）。終わったら「最後の反映」と「これまでの反映」を更新し、一覧は「差分はありません」に
- 失敗（`ok:false`）は赤い 1 行で「反映できませんでした：<理由を日本語で>」。理由の対応表：`innovera_unreachable`＝「INNOVERA に接続できませんでした」／`innovera_empty`＝「INNOVERA から回線が 1 件も返りませんでした（安全のため何も書いていません）」／`kintone_*`＝「Kintone の読み書きに失敗しました」／`not_configured`＝「設定が終わっていません。管理者へ問い合わせてください」
- 幅：375px／768px／1024px／1440px で表が縦に潰れない（狭い幅では行をカードに）。ライト／ダークの両方で読める
- 「これまでの反映」は `system_innovera_sync_log` を新しい順に 20 件（ページ側のサーバー処理で読む）

## 環境変数（Claude が入れる・Codex は触らない）
`.env.local` と Vercel（production）に `INNOVERA_API_HOST`・`INNOVERA_API_KEY`・`KINTONE_INNOVERA_APP_ID`・`KINTONE_INNOVERA_TOKEN`・`GARDEN_NOTICE_CHATWORK_ROOM_ID`。Codex は**名前だけ**を使い、`.env.local` を読んだり書いたりしない

## テストに足すこと（Chatwork）
`sync.server.test.ts` に：書いた件数が 1 以上なら `sendMessage` が 1 回呼ばれ本文に件数と明細が入る／差分 0 件なら呼ばれない／失敗時は「反映できませんでした」を含む本文で呼ばれる／`sendMessage` が例外でも結果の `ok` は変わらない

## テスト（vitest）
- `src/lib/innovera/diff.test.ts`：新規／名称変更／廃止／要確認（番号違い・削除済みの復活）／変化なし／2 回目は 0 件／識別番号のゼロ埋め／FD番号の決め方（free → related → number）／前後の空白だけ違う名前は変化なし
- `src/lib/innovera/sync.server.test.ts`（`fetch` をモック）：INNOVERA が `result:false` → 何も書かず `ok:false`／INNOVERA が 0 件 → 何も書かず `innovera_empty`／Kintone 読み取り失敗 → 書かない／`apply=false` は書かない／`apply=true` で新規 1・名称変更 1・廃止 1 の PUT/POST が正しい本文（履歴の表が「既存行＋1 行」、最終行番号、廃止日、ドロップダウン空）／`入力者` で 400 → 入力者なしで再試行
- `src/app/api/system/innovera-sync/cron/route.test.ts`：Bearer 無し 401／正しければ実行（既存の `nhk-visit/daily-report/route.test.ts` を手本に）
- `src/app/system/innovera/InnoveraSyncClient.test.tsx`：差分一覧の描画／「差分はありません」／失敗の赤い行／反映ボタンの活性条件
- 最後に `npx vitest run src/lib/innovera src/app/api/system/innovera-sync src/app/system/innovera` と `npx tsc --noEmit -p .` を実行し、結果を報告に書く（tsc はこの範囲以外で前からエラーがあるかもしれない。この範囲のエラーが 0 であること）

## 完了報告（この形で・コードブロックで出力）
```
Codex-364 完了報告
1. 変えた・足したファイル：
2. 追加したテストの本数と結果（vitest の PASS/FAIL 数）：
3. tsc のこの範囲に関するエラー数：
4. 指示と違う作りにした点・迷った点：
5. 触っていないこと（git・.env.local・本物の INNOVERA/Kintone/Supabase）の確認：
```

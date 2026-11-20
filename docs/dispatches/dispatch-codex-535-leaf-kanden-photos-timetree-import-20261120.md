# Codex-535 関電の写メの置き場と TimeTree からの取り込みスクリプト（2026-11-20）

## 背景
関電（Leaf）の申込書の写メは、今は TimeTree の「M's関西電力」カレンダーの予定のコメントに貼られている（約 8 万枚・約 27GB）。これを全部 Garden（Supabase Storage）に移す。完全移行までの間も、新しい予定や**過去の予定に後から**写メが貼られるので、**何度流しても「まだ入っていない写メだけ」を取り込める**作りにする。

- 写メの一覧（どの予定にどの写メがあるか）は、Claude がログイン中のブラウザで作って json で渡す（下の形）。あなたはブラウザを使わない。
- 画像そのものは `https://attachments.timetreeapp.com/<object_key>` からログイン無しで取れる（確認済み）。
- 設計の正本：Obsidian `100_Projects/110_Garden/060_Leaf_個別アプリ/020_Kanden_関電/050_写メの保管とTimeTree移行.md`

### 一覧 json の形（配列）
```json
[{"id":"<予定ID>","d":"2026-11-19","no":"1527681","imgs":[["calendar/0c9a/2026-11-19/75284610-1795129942264.jpg",1442,1920]]}]
```
- `d`＝予定の日付（YYYY-MM-DD・空のことあり）／`no`＝メモから取った管理番号（数字だけ・空のことあり）／`imgs`＝[object_key, 幅, 高さ] の配列（0 枚の予定もある）

## やること
1. migration `supabase/migrations/20261120000535_leaf_kanden_photos.sql`
   - バケット `leaf-kanden-photos`（public=false・image/jpeg・image/png・image/heic・application/pdf・1 ファイル 30MB まで）。`on conflict (id) do nothing`
   - 表 `leaf_kanden_photo_sets`
     - id uuid pk default gen_random_uuid()／source text not null check in ('timetree','form')／set_key text not null unique（TimeTree は `timetree:<予定ID>`）／timetree_event_id text／event_date date／kanri_no text／pdf_path text／photo_count integer not null default 0／created_at・updated_at timestamptz not null default now()
   - 表 `leaf_kanden_photos`
     - id uuid pk／set_id uuid not null references leaf_kanden_photo_sets(id) on delete cascade／source text not null check in ('timetree','form')／**source_key text not null unique**（TimeTree は object_key）／kanri_no text／event_date date／category text not null default '未分類' check in ('電灯','動力','ガス','諸元','受領','未分類')／width integer／height integer／bytes integer／image_path text not null／created_at timestamptz not null default now()
   - index：kanri_no（両表）・event_date（両表）・set_id
   - RLS を有効にし、今はポリシーを作らない（サービスロールだけが読み書き。画面は別の回で作る）
   - `add column if not exists`／`create table if not exists` で何度流しても壊れない形
2. 管理番号の正規化 `src/lib/leaf-kanden/kanri-no.ts`
   - `normalizeKanriNo(s)`：全角数字・全角かっこを半角に → かっこ書きの枝番（例 `(2)` `（2）`）を落とす → 先頭の `PD`（大小文字）を落とす → 前後空白を落とす → 数字だけなら先頭の 0 を落とした数字の文字列、それ以外は null
   - 例：`PD1527681`→`1527681`、`PD1527681（2）`→`1527681`、`1527681`→`1527681`、`090-4030-6311`→null、`1211939ｆ`→null、``→null
   - テスト `kanri-no.test.ts`
3. 取り込みスクリプト `scripts/leaf-kanden-photos/import-timetree.ts`（`npx tsx` で動く。.env.local の `NEXT_PUBLIC_SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` を使う）
   - 引数：`--list <json のパス>`（必須）・`--limit <予定の数>`・`--from <YYYY-MM-DD>`・`--to <YYYY-MM-DD>`・`--concurrency <n>`（既定 4）・`--dry-run`
   - 流れ
     1. 一覧を読み、写メ 1 枚以上の予定だけにする（日付で絞る）
     2. `leaf_kanden_photos` の source='timetree' の source_key を全部読む（1000 件ずつ）→ まだ無い写メがある予定だけを対象にする
     3. 予定ごとに：まとまりの行を upsert（set_key で）→ 新しい写メを 1 枚ずつ取得（タイムアウト 30 秒・3 回までやり直し・429/5xx は少し待つ）→ Storage `timetree/YYYY/MM/<予定ID>/<object_key の最後の部分>` に upload（upsert しない。既にあれば成功扱い）→ 写メの行を insert（source_key の重複は無視）
     4. その予定の写メを全部（前からあった分も Storage から読んで）**pdf-lib** で 1 本の PDF にする（1 枚 1 ページ・ページの大きさは画像に合わせる・並びは object_key 順）→ `pdf/timetree/YYYY/MM/<予定ID>.pdf` に upsert → まとまりの pdf_path・photo_count・updated_at を更新
     - 日付が空の予定は `YYYY/MM` を `unknown` にする
   - `--dry-run`：取得・保存・書き込みをせず、対象の予定数・写メ枚数・推定 GB を出すだけ
   - 進み：20 件ごとに 1 行（予定 n/N・写メ n 枚・失敗 n）を標準出力へ。終わりに合計
   - 失敗した写メは `scripts/leaf-kanden-photos/logs/failed-<日時>.json` に書き、続きから処理を進める（1 枚の失敗で止めない）。logs は .gitignore に足す
   - 純粋な部分（対象の選び方・保存先の名前・PDF の組み立て）は関数に分けて `import-timetree.core.ts` に置き、テスト `import-timetree.core.test.ts` を書く（ネットワーク・Supabase はモック）
4. 一覧を作るブラウザ用の手順を `scripts/leaf-kanden-photos/README.md` に書く（Claude が使う。下の「一覧の作り方」をそのまま載せる）

### 一覧の作り方（README に載せる文）
TimeTree にログインした Chrome で `https://timetreeapp.com/calendars/` を開き、開発者用の実行で次を動かす：
1. `/api/v1/calendar/75284610/events/sync`（`since` で続きを取る・`chunk` が false で終わり）で全予定を取る。ヘッダー `X-Timetreea: web/2.1.0/ja`
2. 予定ごとに `/api/v1/calendar/75284610/event/<予定ID>/activities` を取り、`type===0` かつ消されていないものの `attachment.images[].object_key/width/height` を集める（同時 6 本）
3. メモ（note）の「管理番号」の数字、予定の日付（日本時間）と合わせて上の json にし、`timetree-kanden-photos.json` として保存する

## 守ること
- **git 操作禁止（commit・add・push・checkout すべて）**
- **ブラウザ・computer-use・画面操作は禁止**
- **本番 DB・Supabase Storage・TimeTree への書き込みや取得を実際に走らせない**（スクリプトは書くだけ。動かすのは Claude）。migration もファイルを書くだけ
- 改行は LF のまま。関係ないファイルは触らない
- 秘密の値をコード・ログ・報告に書かない

## 確かめ
- `npx vitest run src/lib/leaf-kanden scripts/leaf-kanden-photos` が緑
- `npx tsc --noEmit` でエラーなし

## 報告
`docs/dispatches/report-codex-535-leaf-kanden-photos-timetree-import-20261120.md` に、作ったファイル・テスト結果・気になった点を書く。

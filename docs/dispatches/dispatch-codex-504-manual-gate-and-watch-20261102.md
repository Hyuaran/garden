# Codex-504 画面を変えたらマニュアルも直す「関所」と「毎朝の見張り」（2026-11-02）

作業場所：C:\garden\a-bloom-008（main）
**git は触らない（add / commit / push / checkout / stash すべて禁止）。** ファイルを作る・直すだけ。フックの取り付け（install）も実行しない（Claude がやる）。
**パソコン操作（computer-use）・ブラウザ操作は使わない。** Chatwork へ実際に送らない（`--dry` で確かめる）。
**ファイルは UTF-8（BOM なし）。日本語を書いたら読み直して「?」に化けていないことを確かめる。**

## 背景（東海林さんの指示）
画面を変えても、その機能のマニュアル 5 点（⓪要点サマリ・①使い方・②③仕様書・④仕様書_Claude読み込み用）が直されず、後でずれが見つかることが続いた。覚え書きでは防げないので、仕組みで止める。
1. **関所**：画面の中身を変えるコミットは、コミット文に「マニュアル: 済」か「マニュアル: 対象なし」の行が無いと通さない。
2. **見張り**：毎朝、機能ごとに「画面を最後に変えた日」と「マニュアル 5 点それぞれの最終更新」を比べ、古いものがあれば Garden通知（Chatwork）に 1 通で知らせる。

## 作るもの（すべて `scripts/manual-gate/` の下・Node の .mjs・外部パッケージは今の node_modules にあるものだけ）

### 1. `manual-map.mjs`（共通：変えたファイル → どのマニュアルか）
- 正本は `src/app/system/manuals/_lib/manuals-registry.ts` の `MANUAL_PATHS`（キー＝`module/slug`、値＝画面の URL の頭の一覧）と、同じファイルの名前（`manual("system","docs","資料",…)` の 3 つ目）。ts を実行せず、ファイルを読んで取り出す（取り出せなければ止まってエラーを出す＝黙って 0 件にしない）。Bud・Root など他のモジュールの登録も同じ場所にあれば全部対象。
- 対応のしかた：
  - `src/app/<route>/**` → URL `/<route>`（`(group)` のフォルダ名・`_components` 等の `_` 始まりのフォルダ以降は落とす。`[id]` はそのまま頭一致に使ってよい）
  - `src/app/api/<route>/**` → URL `/<route>` としても照合（例 `src/app/api/system/innovera-calls/...` → `/system/innovera-calls`）
  - 一番長く頭が一致するマニュアル 1 つに対応させる（既存の `findManualForPath` と同じ考え方）
  - `src/lib/<dir>/**` など URL に出ない所は `scripts/manual-gate/extra-map.json`（`{"src/lib/innovera/": ["system/innovera-calls"], …}`）で対応。今のソースを見て、はっきり 1 機能に属する `src/lib` の下のフォルダを最初から入れておく（迷うものは入れない）。
  - 対象外：`*.test.*`・`*.spec.*`・`__tests__`・`docs/`・`scripts/`・`supabase/`・`public/`・設定ファイル。複数の画面で使う共通部品（`src/app/system/_components/` など）は、どのマニュアルにも対応させない（対象外の扱い）。
- `export function manualsForFiles(files: string[]): {key, name, files[]}[]`

### 2. `commit-msg.mjs`（関所）
- 引数＝コミット文のファイル。ステージ済みのファイル（`git diff --cached --name-only`）を `manualsForFiles` に通す。
- 対応するマニュアルが 1 つ以上あり、コミット文に次のどちらかの行が無ければ **exit 1** で止める：
  - `マニュアル: 済`（後ろに機能名などを続けてよい）
  - `マニュアル: 対象なし`（後ろに理由を続ける。理由が空なら止める）
  - 全角コロン「：」でも可。
- 止めたときの表示（日本語）：対応したマニュアルの名前と、そのきっかけになったファイル（各 3 件まで）、書き方の例 2 つ、「マニュアル 5 点（⓪①②③④）を直して Storage に上げてから『マニュアル: 済』と書く」。
- 通すとき：マージのコミット（`MERGE_HEAD` がある）・`fixup!`/`squash!`・リバート（`Revert "`）は調べずに通す。
- 環境変数 `MANUAL_GATE_SKIP=1` で通す（緊急用・表示に「関所を飛ばしました」と出す）。

### 3. `install-hook.mjs`（取り付け・Claude が実行する）
- `git config core.hooksPath`（無ければ `.git/hooks`）の場所に `commit-msg` を書く。中身は sh で、**そのときの作業ツリー**の `scripts/manual-gate/commit-msg.mjs` があれば `node` で呼び、無ければ何もせず通す（他の作業ツリーが古い版でも壊れないように）。既に `commit-msg` があれば上書きせず止まる（`--force` で上書き）。
- `--uninstall` で外せる。

### 4. `watch-manuals.mjs`（毎朝の見張り）
- 起動：`node scripts/manual-gate/watch-manuals.mjs [--dry] [--since=2026-11-02]`（`--since` の既定は 2026-11-02＝これより前のコミットは見ない）。`.env.local` を `process.loadEnvFile` で読む。
- 機能ごとに：`origin/main` の履歴（最初に `git fetch origin main` を試し、失敗しても手元の main で続ける）から、その機能に対応するファイルを変えた**最新のコミット**を探す。コミット文に「マニュアル: 対象なし」があるコミットは数えない。
- Storage（バケット `system-manuals`・場所は registry の `storagePrefix`）のマニュアル 5 点（ファイル名の決まりは registry の `MANUAL_DOCS`・`extraDocs` は見ない）の `updated_at`（無ければ `created_at`）を読む。
- **古い**＝5 点のどれかの更新が「そのコミットの日時 − 24 時間」より前、または 5 点のどれかが無い。
- 結果：古い機能が 1 つ以上あれば、Garden通知（ルーム＝`GARDEN_NOTICE_CHATWORK_ROOM_ID`、無ければ 450125458・トークンは既存の Garden通知の送信と同じ環境変数）に 1 通だけ送る。TO は付けない。文の形：
  ```
  [info][title]マニュアルが画面より古い機能があります（N 件）[/title]
  ・INNOVERA履歴・録音：画面の変更 2026-11-02 14:03:11（a1b2c3d）／古いもの ①使い方・④仕様書
  ・…
  直したら Storage に上げてください。画面の変更がマニュアルに関係ない場合は、次からコミット文に「マニュアル: 対象なし（理由）」と書いてください。[/info]
  ```
  （日時は秒まで・ハッシュは 7 桁。⓪〜④の呼び名は ⓪要点サマリ／①使い方／②仕様書（非エンジニア向け）／③仕様書（エンジニア向け）／④仕様書）
- 古い機能が 0 件なら送らない（標準出力に「すべてそろっています」）。
- `--dry` は送らずに文を標準出力へ。
- 失敗（git・Storage・Chatwork）は標準エラーに出して exit 1（送り直しや通知はしない）。

### 5. `run-watch-manuals.bat`（Windows のタスクから呼ぶ・Claude が登録する）
- `cd /d C:\garden\a-bloom-008` → `node scripts\manual-gate\watch-manuals.mjs` → 出力を `scripts\manual-gate\watch-manuals.log` に追記（日時つき）。日本語を書くなら `chcp 65001`。

## テスト
- `scripts/manual-gate/manual-map.test.mjs`（vitest で動く形 or `node --test`。どちらか動く方）：
  - `src/app/system/innovera-calls/InnoveraCallsClient.tsx` → INNOVERA履歴・録音
  - `src/app/api/system/innovera-calls/circuit-order/route.ts` → 同上
  - `src/app/my/ApDailyReview.tsx` → `/my` を持つマニュアル（registry どおり）
  - `src/app/system/_components/Modal/Modal.tsx` → 対象なし
  - `src/app/foo.test.tsx` → 対象なし
- `commit-msg.mjs` の判定部分（文に行がある／無い／対象なしで理由が空）を関数に分けてテスト。
- `node scripts/manual-gate/watch-manuals.mjs --dry --since=2026-10-25` を実際に動かし、出力をレポートに貼る（Storage は読むだけ）。
- `npx tsc --noEmit` が通ること（ts を触らないなら影響なしの確認だけ）。

## 終わったら
`docs/dispatches/report-codex-504-manual-gate-and-watch-20261102.md`（UTF-8）に、作ったファイル・extra-map に入れた対応と理由・`--dry` の出力・テスト結果・決めきれなかった所を書く。

## Codex-504 実装時の実行回数見積もり
- 毎朝のタスクは 1 日 1 回を想定。タスク登録・フック取り付けは今回実行しない。
- 各実行で fetch 1 回、log 1 回、対象期間の除外されていないコミット N 件について diff-tree N 回。git 合計 N+2 回／日。
- Storage は対象機能 F 件の各フォルダを 100 件ずつ一覧取得。通常 F 回／日（全34機能なら34回）。100件以上あるフォルダはページ数分増える。履歴に対象機能がなければ0回。
- Chatwork は古い機能があれば合計 1 回／日、なければ 0 回。--dry は常に0回。再試行・常駐ポーリングは追加しない。
- 今回は「git は一切触らない」を優先し、実履歴を使う --dry は未実行。代替データで通知文と判定を検証する。

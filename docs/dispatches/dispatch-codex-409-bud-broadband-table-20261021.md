# Codex-409：ブロードバンド事業の収支の表（Garden の画面・色付き・並び順）（2026-10-21）

設計の正本：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\100_Projects\110_Garden\070_Bud_経理収支\050_設計_ブロードバンド事業の収支と口座の突き合わせ_v1_20261021.md`（§4・§5 を読むこと）
前の作業：Codex-407（`src/lib/bud/broadband/{reconcile,run}.ts`・表 `bud_bb_records`／`bud_bb_recon_issues`／`bud_bb_settings`）。Claude が直した版がコミット済み（df98d797）。
見た目の正本：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md` の §2.5（画面の型）・§2.6（点検 9 項目）・§3。見本の画面＝Bud「口座残高・カード利用」（`src/app/bud/bank/`）

## 東海林さんの決定（2026-10-21）
- Kintone アプリ 174 の「月別収支」と同じ形の表を **Garden で見る**（Kintone のグラフの設定は触らない）
- **未入金・金額違いは赤**、予定日前は薄い灰。欄を押すと明細
- **並び順は Garden で変えられる**。最初は事業内容ごとに「**入金 → 支払い**」。選んだ並び順は人ごとに覚える
- 将来は記録の作成も Garden で行う → 画面は**写し（bud_bb_records）だけ**を読む。Kintone を直接読まない

## 置き場所
- 新しい画面 `/bud/profit/broadband`（h1「ブロードバンド事業の収支」・場所の表示「Bud / 損益管理 / ブロードバンド事業の収支」。損益管理のリンクは `/bud/profit`）
- Bud のサイドバー（メニュー）の「損益管理」のすぐ下に「ブロードバンド収支」を足す（admin 以上だけ表示。メニューの定義の場所を探して同じ書き方で）
- 見られる人＝admin 以上（表の RLS と同じ。`bud_is_admin_or_super_admin()`）。それ以外は今の Bud の「権限がありません」と同じ出し方

## 照合の結果を写しに残す（画面の色のもと）
- migration `supabase/migrations/20261021000010_bud_bb_recon_status.sql`：`bud_bb_records` に `recon_status text`（matched／amount_mismatch／not_arrived／ambiguous／pending／excluded）・`expected_gross bigint`・`recon_fee integer`・`recon_checked_at timestamptz` を足す
- `run.ts`：本番の実行（dryRun でない）のたびに、全行の結果を写しに書く（`bud_bb_replace_mirror` の後・1 回の rpc でまとめて。既存の upsert／update の形に合わせる。pg_safeupdate があるので UPDATE は必ず WHERE 付き）
- 人が Kintone で「☑入金確認」を付けた行（Garden が付けていない）は matched と同じ「確認済み」として扱う

## 表（ピボット）
- 行＝事業内容（太字の小計の行）→ その中の取引先会社名。列＝入出金予定日の月（古い→新しい）＋右端に「合計」（**合計の列の前にだけ縦線**）。一番下に「総合計」の行
- 値＝`利益額_税抜_` の合計（174 の月別収支と同じ）。3 桁区切り・マイナスは「−」と赤字ではなく通常色（赤は状態にだけ使う）
- 期間＝タブの下の箱のプルダウン（共通部品 `BoxSelect`・複数選択）：今年度（既定。年度は 4 月始まり）・前年度・直近 12 か月・2024 年度…（写しにある年度まで）
- 欄の色（その欄に入る行の状態で決める・強い順）：
  - **赤**（背景を薄い赤＋左に赤い線）＝金額違い（amount_mismatch）・未入金（not_arrived）・候補が複数（ambiguous）が 1 行でもある
  - **薄い灰**＝予定日がまだ来ていない（pending）だけ
  - 通常＝全部確認済み（matched・人の確認）
  - 対象外（excluded：代理店支払い合計など）は色を付けない
- 欄の右上に小さな印は付けない（色だけ）。色の意味は表の上に 1 行の凡例（赤＝口座と合わない・まだ届いていない／灰＝予定日前）
- 欄を押すと、右から出る明細の枠（または表の下）：その欄の行の一覧（予定日・実績期間・商材名・税抜・予定の税込・口座の実際（日付・金額・銀行・摘要）・差（手数料なら「手数料 440 円」）・状態・［Kintone で開く］＝`https://{KINTONE_SUBDOMAIN}.cybozu.com/k/{KINTONE_BROADBAND_APP_ID}/show#record={id}`（別タブ））。サブドメインとアプリ番号はサーバーから渡す
- 表は DataTable の見た目（濃紺の見出し帯・行の線・左の列の固定）。横に長いので、左の 2 列（事業内容・取引先）を固定して横スクロール。数字は右寄せ・見出しは中央

## 並び順
- タブの行の右端に並べ替えのアイコン（`TabActionButton icon="sort"`）。押すと丸の一覧（BoxSelect の単一選択の形）：
  1. **入金 → 支払い**（既定）：事業内容は名前順。その中で入金の取引先（期間の合計 > 0）を上、支払いの取引先を下。それぞれ金額の大きい順
  2. 金額の大きい順：事業内容の中で期間の合計の大きい順
  3. 取引先名の順
- 選んだものは人ごとに覚える：localStorage（`bud-broadband-sort`。読み書きは try/catch・読めなくても既定で動く）

## 画面の上の部分（型どおり）
- `SystemBreadcrumb` → h1 → `UpdatedStamp`「Kintone最終更新：YYYY/MM/DD(曜) HH:MM」＝写しの最新の updated_at。↻ を押すと写しの更新と照合（本番の実行）を行う API を呼ぶ（admin 以上・`bud_bb_claim` で 1 回ずつ。実行中・1 分以内は「確認中です」）
- タブ（`SystemTabs`）は「収支の表」1 つだけでよい（後で増やす）。タブの行の右端＝並べ替えアイコン
- 一覧／カードの切り替え（`HeaderViewToggle`）はこの画面ではグレー（使えない）
- タイトルの下の説明文は置かない

## 将来の切り替え（記録の正）
- 画面のデータは `src/lib/bud/broadband/table.ts` の 1 つの関数（写しを読む）だけを通す。`bud_bb_settings.record_master='garden'` でも同じ関数で読める作り（今は写し＝どちらでも同じ表）

## テスト
- ピボットの組み立て（月の列・小計・総合計・合計の列）
- 欄の色の判定（赤／灰／通常／対象外・強い順）
- 並び順 3 種（入金→支払いの既定）と localStorage が読めないとき
- 期間（今年度＝4 月始まり・複数選択）
- 明細の枠の中身（手数料の表示・Kintone のリンク）
- 権限（admin 未満は見えない）
- run.ts が結果を写しに書く（dryRun では書かない）

## 守ること
- commit・push しない。DB・Kintone・外部 API に接続しない
- `npx vitest run src/lib/bud/broadband src/app/bud src/app/api/bud src/app/system/_components` と `npx tsc --noEmit -p .` が通ること（テスト時は .env.local の NEXT_PUBLIC_SUPABASE_URL／ANON_KEY を環境変数に入れて流す。前から落ちている AppHeader・KpiCard・BackgroundCarousel は触らない）

## 報告（日本語・コードブロック）
変えたファイル・migration・テストの結果・Claude がやることだけ短く。

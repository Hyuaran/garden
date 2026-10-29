# Codex-488：Root でチーム所属（履歴つき）と事業を持ち、公式 LINE の事業・チームのタグをそこから自動で決める（2026-10-29）

## 東海林さんの話（開発ボード root 28c7d46d・2026-10-29 決定）
- 従業員名簿は Garden で編集し、Kintone 従業員名簿は今のアプリをバックアップにする（作り直さない）。段階：① チーム所属を履歴つきで Garden で編集 ② 公式 LINE のタグ（事業・チーム）を①から自動 ③ 名簿の向きを Garden→Kintone に ④ Kintone は閲覧のみ。**今回は ① と ②。**
- チーム所属は、履歴が追えるように Kintone では「在籍チーム」の表（サブテーブル `テーブル`：入力日時 `日時`・行番号 `数値_7`・移動日 `日付_8`・所属チーム名 `ドロップダウン_17`・メモ `文字列__複数行_`・入力者 `ユーザー選択`）で持っている。同じ形にする。
- 現場では「ヒュアラングループ」＝新人チームの意味で使っていた（Kintone に新人チームの選択肢が無かった）。

先に読む：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md` の §2.5〜§2.7（**表の行は全体を押す・表のマスに選ぶ欄を置かない・押した先は共通 Modal・フォームは form-kit・日時は秒まで**）。今の作り：Root の従業員の画面 `src/app/root/employees/`・入口 `src/app/api/root/employees/`、名簿の取り込み `src/app/root/_lib/roster-sync.server.ts`（Kintone→Garden。チーム名 `チーム名` を履歴 `root_employee_profile_history` の employment に入れている）、公式 LINE のタグ `src/lib/line/tags.ts`・`tags.server.ts`（自動のタグは `automaticTags`・`system_line_replace_auto`）、メニュー `src/lib/line/richmenu.ts`（`menuGroup`）・付け替え `src/lib/line/richmenu.server.ts`（`syncRichMenus`）。長い説明は不要・ファイルは必要な範囲だけ読む。

## 1. データ（migration `20261029000488_root_team_history.sql`・作成のみ・Claude が本番に当てる）
- 表 `root_employee_team_history`：`id`・`employee_id`（root_employees）・`effective_date date not null`（移動日）・`team text not null`（宮永チーム／小泉チーム／石原チーム／新人チーム／バックヤード／所属なし）・`memo text`・`entered_by text`（社員 id または 'kintone'）・`entered_at timestamptz`・`source text`（'garden'／'kintone'）。RLS は service_role と、Root の閲覧・編集の権限に合わせる（今の Root の表と同じ決まり）。
- `root_employees` に `business text`（ブロードバンド事業／NHK派遣事業／関西電力事業／null）を足す（変えたら `root_employee_profile_history` に記録＝今の履歴の仕組みに合わせる）。
- 今の所属＝移動日が今日以前の行のうち一番新しいもの（関数 `root_current_team(employee_id, on_date)` かビュー）。

## 2. 最初のデータの取り込み（スクリプト `scripts/import-team-history.mjs`・`--dry-run` あり・Claude が本番で実行）
- Kintone 従業員名簿（app 56・`KINTONE_EMPLOYEE_ROSTER_TOKEN`）の「在籍チーム」の表を全員分読み、`root_employee_team_history` に入れる（打刻ID＝`root_employees.kot_employee_id` で突き合わせ・同じ行を二度入れない）。「ヒュアラングループ」は**アルバイトなら新人チーム**、それ以外は「所属なし」として入れる。
- 事業：今の公式 LINE の手で付けた事業タグ（`system_line_tag_member` の business）を `root_employees.business` に写す（2026-10-29 に東海林さんの確認どおりに付けた正しい値）。
- チームのずれの上書き：今の公式 LINE の手で付けたチームのタグ（今日付けた正しい値）と、上の取り込み後の「今の所属」が違う人は、移動日＝2026-10-29・メモ「公式 LINE のチーム（営業の確認）に合わせた」・source='garden' の行を足す。
- 出力：取り込んだ行数・上書きした人数と名前（番号は出してよい・個人情報は出さない）。

## 3. Root の画面
- 従業員の詳細に「チーム所属」の表（移動日・チーム・メモ・入力者・入力日時＝秒まで・新しい順）＋［所属を追加する］（共通 Modal：1 移動日・2 チーム（普通のプルダウン）・3 メモ →［登録する］）。行を押すと、その行を直す／消す（Garden で入れた行だけ。Kintone から来た行は直せない＝「Kintone から取り込んだ行です」）。
- 「事業」：詳細の基本情報に出し、変更できる（普通のプルダウン）。
- 一覧の表に「チーム」「事業」の列（今の所属）。
- 編集できるのは今の Root の従業員の編集と同じ権限。

## 4. 公式 LINE のタグを自動で決める
- 事業タグとチームのタグを、Root の `business` と今の所属から**自動（source='auto'）**で付ける（`automaticTags` に足す・今の手で付けた事業・チームのタグは、取り込みのあと自動に置き換わる＝手のタグは消す）。チームのタグはブロードバンド事業の人だけ（今の決まりどおり）。所属が「バックヤード」「所属なし」はチームのタグなし。
- 公式 LINE の「〇〇さんのタグ」の小窓の事業・チームは**表示だけ**にし、「Root の社員情報で変更します」とリンクを出す（Root の詳細へ）。自由タグは今のまま小窓で変えられる。
- 移動日が先の日付の行は、その日に切り替わる：毎朝の名簿の取り込み（`/api/root/roster-sync/cron`）の最後に、タグの付け直しとメニューの付け替え（`syncRichMenus`）を 1 回呼ぶ（新しい cron は足さない）。Root で所属・事業を変えたときも、その人だけ付け替える。
- 名簿の取り込み（Kintone→Garden）は、`business` と `root_employee_team_history` を**上書きしない**（Garden が正）。

## 5. テスト
- 今の所属の決め方（移動日が先の行は今日は効かない・その日から効く）。
- 取り込みスクリプト：ヒュアラングループ→アルバイトは新人・それ以外は所属なし・二度入れない・上書きの行。
- Root：追加・直す・消す（Kintone の行は直せない）・権限。
- LINE：事業・チームのタグが自動で付く・小窓では表示だけ・メニューの振り分けが今と同じ結果になる（今日の 30 人で、今のタグと同じ結果になることを、データを模したテストで）。

## 終わったら
- `npx tsc --noEmit` と関係するテストを通す。完了報告（コードブロック）。本番での手順（migration→スクリプト dry-run→本番→LINE の付け替えの確認）を報告に書く。
- ファイルは UTF-8（BOM なし）。**git は触らない（commit しない）。npm install しない。本番の DB に当てない・スクリプトを本番で動かさない。LINE・Kintone に書き込まない。**

## 実装時の取得回数
- 新しい cron は無し。毎朝の名簿の取り込みのあとにタグの付け直し 1 回＋変わった人だけ LINE の付け替え。取り込みスクリプトは 1 回だけ（Kintone の読み 1 回・500 件ずつ）。

### Codex-488 実装補足
- 定期取得の追加は 0 回／日。既存の朝の cron の末尾でタグ再計算 1 回／日、LINE は差分だけ反映する。画面は初回と保存後に取得し、所属・事業の変更時は対象社員だけタグ・メニューを更新する。
- 一括取り込みは Kintone を 500 件ずつ読み、全 N 件で floor(N / 500) + 1 リクエスト。dry-run と本実行の各 1 回で計 2 × (floor(N / 500) + 1)。DB の一覧は 1,000 件ずつ取得する。
- migration 後も、スクリプトが最後まで成功して `root_team_import_state.ready=true` になるまでは既存の手動タグを保持する。dry-run はこの状態も変更しない。
- 本番手順：migration を適用 → 環境変数を設定して `node scripts/import-team-history.mjs --dry-run` → 件数・補正対象を確認 → 同スクリプトを引数なしで実行 → 既存の LINE リッチメニュー反映操作または朝の cron でタグと差分メニューを反映し、30 人の事業・所属・メニューを確認する。

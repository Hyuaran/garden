# Codex-439：System「開発ボード」（未決定のこと・残タスクを質問と回答でまとめる・東海林さんだけ）（2026-10-26）

## 目的（東海林さん 2026-10-26）
Garden の未決定のこと・残タスクが Claude のメモと Daily に散らばっていて、聞かないと出てこない。Garden の中に**質問に答えていく形**でまとめ、回答したら Claude に知らせ、ログも残す。今話したいことはチャットで、残りはここで見られるようにする。

## 画面の絵
```
（System のサイドバーの一番下に「開発ボード」・東海林さんだけに出る）
System / 開発ボード
開発ボード
 [≡]  [◎]   [✿]   [●]  [◇]   …  [◎]     [◯]        ← タブ＝アイコン（24px）＋下に小さく英字の名前（11px）
 一覧 System Bloom Fruit Seed …  Calendar 共通          マウスを乗せると日本語名（社内システム・案件KPI…）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  選択中はティールの下線（SystemTabs と同じ見た目）
 質問が 0 件のモジュールのタブはグレー（押せない）。幅が足りないときは横スクロール（1384px では 1 行に収まる）

（モジュールのタブ）
 ■■■■■□□□□□  10件のうち 4件が回答済み                ← 入社手続きと同じ進捗バー
 ┌ 足立さん・愛美さんの交通費の入れ方 ─────── 未回答 ┐ ← 状態のバッジ：未回答／回答済み／Claude が対応中／完了
 │ 正社員にしたので交通費は定期代の扱いになります。…     │ ← 背景・説明（Claude が書く）
 │ ( ) A：定期代で入れ直す（おすすめ）  ( ) B：今のまま   │ ← 選ぶ形（おすすめ付き）。文章で答える形の質問もある
 │ 補足： [                            ]                 │
 │                                       ［回答する］    │
 │ 記録：10/26 13:02 Claude が作成 …                     │ ← 折りたたみ（＋/－）
 └──────────────────────────────┘
 並び＝未回答が上、その次に Claude が対応中、回答済み、完了（完了は「完了も表示」で出す）

（一覧タブ）DataTable：モジュール（アイコン＋名前）・質問・状態・作成日・回答日・完了日。並べ替え・絞り込み・検索。行を押すとそのモジュールのタブのその質問へ。

（［回答する］を押したとき＝整えた日本語の確認）
┌ この内容で送りますか ───────────────────┐
│ 整えた文：足立さん・愛美さんの交通費は、定期代として入れ直してください。│
│ もとの文：あだちさんとまなみさん定期でいい                │
│          ［整えた文で送る］［もとの文のまま送る］［直す］ │
└──────────────────────────────┘
```

## 決まり
- **見られる人＝東海林さん（EMP-0008）だけ**。Codex-432 の閲覧権限の仕組みで、page_key `system-dev-board`・既定の役職＝なし・既定の個人＝EMP-0008（全権管理者でも東海林さん以外は見えない。※仕組みが「全権管理者は常に見られる」なら、この画面だけ例外にする＝既定の個人だけ。歯車は出さない）。サイドバー・URL 直打ち・API すべてで判定。
- モジュール＝ System・Bloom・Fruit・Seed・Forest・Bud・Leaf・Tree・Sprout・Soil・Root・Rill・Calendar・共通（外部連携・インフラ）。アイコンは `src/app/_components/layout/GardenShell/garden-shell-config.ts` と左の縦メニューと同じ画像（System と共通のアイコンは縦メニュー・線画から合うもの）。
- **整えた日本語（補完）**：［回答する］で、選んだ答え＋補足の文を Claude API で整える（言い回し・漢字・句読点だけ。意味・数字・固有名詞は変えない。足りない言葉は文から読み取れる範囲だけ）。モデルは環境変数 `DEV_BOARD_MODEL`（既定 `claude-haiku-5-5`）。既存の Anthropic SDK の使い方（`src/app/api/rill/mail/intake/notice-draft/route.ts` 等）に合わせる。API に失敗したら「整えられませんでした。もとの文のまま送れます」。補足が空なら整えずにそのまま確認。
- 回答したら：状態＝回答済み、整えた文ともとの文の両方を保存、記録に残す、**Chatwork の「開発ボード」ルーム（環境変数 `DEV_BOARD_CHATWORK_ROOM_ID`。無いときだけ仮で `CHATWORK_DEV_ROOM_ID`）へ「開発ボードに回答がありました：{モジュール}／{質問の見出し}」**（東海林さん 2026-10-26「開発ルームとは別に、開発ボードというルームを新設」）（既存の Chatwork 送信のしかたに合わせる・テストでは送らない）。
- 回答を直したいとき：［回答を直す］で再回答（前の回答は記録に残る）。
- Claude 用の書き込み：質問の作成・状態の変更（対応中・完了）・記録の追加は、Claude が DB に直接書く（RLS は東海林さんの読み書きだけ。Claude は管理者接続）。画面から質問を作る［＋ 質問を足す］も東海林さん用に付ける（見出し・モジュール・説明・答え方）。

## DB（migration を作るだけ・本番には当てない）
- `system_dev_questions`（id・module・title・body・answer_type〈choice／text〉・options jsonb〈[{key,label,recommended}]〉・status〈open／answered／in_progress／done〉・answer_choice・answer_text_raw・answer_text・answered_at・answered_by・created_by〈'claude' か employee_id〉・created_at・updated_at・done_at・sort）
- `system_dev_question_logs`（id・question_id・at・actor〈claude／EMP-xxxx〉・action・detail jsonb）
- RLS：東海林さん（root_employees.user_id＝auth.uid() で employee_id＝EMP-0008）だけ select／update（回答の列だけ）。insert は東海林さんも可。サーバーは判定後に管理者接続。

## 触らないもの
- `src/app/bud/bank/` 配下。本番 DB・環境変数（`DEV_BOARD_MODEL` は無くても既定で動くこと）。**git は触らないでください。コミットは人間側が行います。** npm install はしない。

## 確認
`npx tsc --noEmit`・`npx vitest run src/app/system src/app/api/system`（東海林さん以外は 404／403・サイドバーに出ない／回答で整えた文の確認→保存→記録→Chatwork 呼び出し〈モック〉／API 失敗でもとの文で送れる／0 件のタブはグレー／一覧の行から質問へ）。日本語が「???」に化けていないこと。ファイルの先頭に BOM を付けないこと。

## 完了報告（コードブロックで）
変更ファイル／migration のファイル名／テスト結果／気になった点。

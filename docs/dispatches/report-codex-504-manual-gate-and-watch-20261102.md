# Codex-504 作業レポート（2026-11-02）

実装済み。git操作、フック取り付け、タスク登録、computer-use、ブラウザ操作、Chatwork実送信は行っていません。

## 作成ファイル
- scripts/manual-gate/manual-map.mjs：TypeScript ASTで登録を静的に読み取り、最長のルート区切り一致で対応。登録・5点・storagePrefixの形式が変わり解析不能なら停止。
- scripts/manual-gate/extra-map.json：URLにならない機能コードの対応。
- scripts/manual-gate/commit-msg.mjs：確認行の判定、理由必須、自動コミット・マージ・緊急スキップ、対象名と各3ファイルまでの案内。
- scripts/manual-gate/install-hook.mjs：現在の作業ツリーを参照するフックの生成・解除。未実行。
- scripts/manual-gate/watch-manuals.mjs：履歴比較、Storage一覧のページ取得、24時間の判定、JST秒表示、通知の集約、dry出力。
- scripts/manual-gate/run-watch-manuals.bat：日時と終了コードを付けてログ追記。
- scripts/manual-gate/manual-map.test.mjs：node:testの9テスト。

指示書末尾に1日あたりの実行回数見積もりを追記しました。

## extra-map の対応と理由
- doc-save-check → system/doc-save-check：契約書・条件表の保存チェック専用。
- mail-forwarding → root/mail-forwarding：郵便転送の住所・期限・通知専用。
- mail-ndr-watch → system/mail-ndr-watch：メール配信不能監視専用。
- mail-payment-check → system/mail-payment-check：支払漏れチェック専用。
- pl-payments → system/pl-payments：損益の支払監視専用。
- notices → system/notices：お知らせ専用。
- sites → system/sites：サイトの通知処理専用。
- vercel-usage → system/vercel-usage：Vercel利用量監視専用。
- innovera の calls.ts、calls.server.ts、call-access.ts、circuit-order.server.ts、export.server.ts → system/innovera-calls：通話履歴・権限・回線順・履歴出力。
- innovera の sync.server.ts、diff.ts → system/innovera：番号同期・差分。

INNOVERAフォルダ全体は同期と通話履歴が混在するので登録しませんでした。共通client・types・ingest・daily-extensionなどは対応先を断定せず除外。bud、kintone、supabase、chatwork、hooks、searchなど共通性や複数機能の可能性があるフォルダも追加していません。

## 検証
- `node --test scripts/manual-gate/manual-map.test.mjs`：9件成功、失敗0。
- `npx tsc --noEmit`：終了コード0、出力なし。TSソースは変更していません。
- 対応：画面・APIのINNOVERA、/my、共通部品除外、test除外、group/privateフォルダ、Windows区切り、Bud/Root、登録失敗を確認。
- 判定：確認行の有無、全角コロン、空理由、自動コミット、24時間境界、欠落、created_atへの代替、不正日時を確認。
- 見張り：代替git/Storageでdry時は無送信、正常時は無送信、古い時は送信関数を1回だけ呼ぶ、fetch失敗時のmain選択、対象なし除外、Storage失敗の伝播を確認。実際のgit実行・ネットワーク送信はテストに含みません。

## --dry 出力
指定の `node scripts/manual-gate/watch-manuals.mjs --dry --since=2026-10-25` は内部でgit fetch/log/diff-treeを実行します。ユーザーの「git は一切触らない」を優先し、実履歴でのコマンド実行とStorage実読取は行っていません。

以下は同じwatch関数に代替履歴・代替Storage（5点なし）を渡したテストの標準出力です。実環境の検査結果ではありません。

```text
[info][title]マニュアルが画面より古い機能があります（1 件）[/title]
・INNOVERA履歴・録音：画面の変更 2026-11-02 14:03:11（aaaaaaa）／古いもの ⓪要点サマリ・①使い方・②仕様書（非エンジニア向け）・③仕様書（エンジニア向け）・④仕様書
直したら Storage に上げてください。画面の変更がマニュアルに関係ない場合は、次からコミット文に「マニュアル: 対象なし（理由）」と書いてください。[/info]
```

## 未確認・引き継ぎ
- 実履歴とStorageによるdry、フック取り付け・実コミットによる動作、Windowsタスク登録は未実施。指示どおりClaude側で実施する範囲です。
- `/my/ApDailyReview.tsx` はファイル名からAP日報と推測せず、registryのクエリなし `/my` に従い system/mypage に対応。クエリ専用の登録はファイルパスから判定できません。
- storagePrefixは現在のregistryの生成規則を検証して使用。規則変更時は黙って誤対応せずエラーにします。
- 通知設定は既存の `CHATWORK_API_TOKEN`、送信先は `GARDEN_NOTICE_CHATWORK_ROOM_ID` または450125458。TOなし、再送なし。
- 定期処理はタスクから1日1回の起動を想定し、常駐・useEffect・ポーリングは追加していません。

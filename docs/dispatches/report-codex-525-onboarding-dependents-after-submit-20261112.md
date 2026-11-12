# Codex-525 作業報告（2026-11-12）

## 実装

- 提出後も、事務の詳細「本人が入れた内容」の扶養家族ごとに年間収入・職業または学校と学年を［修正］できるようにした。年間収入は0以上の安全な整数、正しいカンマ区切りも受け付ける。
- 全権管理者だけ、空欄の番号に［マイナンバーを入れる］、保存済みの番号に［修正］を表示。既存の［見る］は維持し、上書きはチェックによる確認が必要。
- 番号入力はpassword欄・Clarityマスク。既存のvalidMyNumberで12桁と検査数字を確認し、encryptMyNumberでAES-256-GCM暗号化。DBにはmy_number_secretと空のmy_numberだけを渡し、応答には下4桁の伏せ字だけを返す。送信後・取消時に入力値を消す。秘密鍵設定に失敗した場合も平文では保存しない。
- 新設RPCで行ロックし、配列の対象者の対象欄だけを更新。番号の入力記録は既存のmy_number_access_logs（action=confirm、detailに「入社手続き・扶養家族N・番号入力」）へ、保存と同じ取引で記録する。記録に失敗すれば保存もしない。
- RPCはservice_role専用。サーバーの権限判定に加え、RPCでも操作する従業員が在籍中の責任者以上かを確認し、番号はsuper_adminに限定する。番号を閲覧・書類に出す条件は既存のmy_number_viewersと閲覧記録のまま。
- 閲覧のみの人には扶養家族・メール・世帯主の［修正］と番号入力を表示しない。
- 保存後はレビューと未入力件数を更新。空のmy_numberと暗号化済み番号の組合せも、再読込時に下4桁で表示する。

## 変更ファイル

- `src/app/system/onboarding/admin/[employeeId]/OnboardingAdminDetailClient.tsx`
- `src/app/system/onboarding/admin/[employeeId]/page.tsx`
- `src/app/system/onboarding/_components/OnboardingReview.tsx`
- `src/app/system/onboarding/_components/DependentAdminField.tsx`（新規）
- `src/app/system/onboarding/_lib/onboarding-admin.server.ts`
- `src/app/api/system/onboarding/admin/[employeeId]/route.ts`
- `src/app/system/onboarding/_lib/onboarding-admin-dependent.server.test.ts`（新規）
- `src/app/system/onboarding/admin/[employeeId]/OnboardingAdminDetailClient.dependent.test.tsx`（新規）
- `src/app/system/onboarding/_lib/onboarding-fuyou.server.test.ts`
- `src/app/system/onboarding/_lib/renrakuhyo.server.test.ts`
- `scripts/verify-onboarding-dependents-525.mjs`（新規）

## Migration

`supabase/migrations/20261112000525_onboarding_dependents_after_submit.sql` を作成した。**本番未適用。Claude側で適用する。**

リポジトリで最後に定義されている本番用関数（20261029000479）の全文を土台にcreate or replace。service_roleの番号移し替え例外は維持し、提出後の比較ではdependentsのannual_income・occupation・my_number_secretおよび空のmy_numberだけを変更可能にした。配列は順番を含めて比較し、人数・並び・他の欄を保護する。本人の画面の操作、他の本人入力、既存の事務入力、提出日時などの保護は維持する。

本番から関数を取得する操作はしていない。新規RPCの追加もこのmigrationに含むため、アプリの利用にはmigrationの適用が必要。

## マニュアル

`C:\Claude\000_Garden\150_System_システム\00_マニュアル\04_入社手続き\` の④を先に更新し、①・②・③・⓪へ反映した。対象は以下の5ファイル。版v1.22・日付2026-11-12。

- `Garden_System_入社手続き_4_仕様書_Claude読み込み用.md`
- `Garden_System_入社手続き_1_操作マニュアル_研修用.html`
- `Garden_System_入社手続き_2_仕様書マニュアル_非エンジニア向け.html`
- `Garden_System_入社手続き_3_仕様書マニュアル_エンジニア向け.html`
- `Garden_System_入社手続き_0_要点サマリ.html`（④の埋め込み控えも更新）

①は業務の言葉で、対象者を開く→修正・保存→書類を作り直す手順を追記。既存の「不足分を作ったファイルに書き足す」という説明はGardenで保存して再生成する説明に訂正した。Storageへは上げていない。UTF-8を確認し、文字化け記号・連続した疑問符がないことも確認した。

## 検証結果

- `npx tsc --noEmit`：成功。
- `npx vitest run src/app/system/onboarding src/app/api/system/onboarding src/lib/my-number`：48ファイル・407テスト成功。
- 実装・新規テストの変更対象8ファイルへのESLint：成功。
- `node scripts/verify-onboarding-dependents-525.mjs ./tmp/verify-520/node_modules/@electric-sql/pglite`：ローカルの一時メモリDBで23項目成功。migration自体を読み込んで、提出後の収入・職業更新、他の本人入力拒否、人数・並び拒否、権限、上書き確認、番号の記録、記録失敗時の保存取消、既存の移し替え例外、RPC実行権限を確認。既存の平文拒否トリガーも読み込んで検証した。
- 追加したサーバーテストで整数・カンマの検証、暗号化して復号できること、RPC引数と応答に平文が残らないこと、権限と不正な番号の拒否を確認。
- 追加したDOMテストで閲覧のみの人への非表示、責任者と全権管理者の表示差、伏せた入力、保存後の平文消去、上書き確認を検証。実ブラウザは使っていない。
- 書類生成のテストでは、1回目と再生成で値を変更し、毎回読み直した値が入社連絡表のExcel/PDFと扶養控除申告書の生成処理へ渡ることを確認。Drive・Storageなどの外部接続はモックに差し替えている。生成処理自体の変更は不要だった。

自動取り直し・cronの追加なし。追加の定期呼出しは **0回/日**。

## 未実施・制限

依頼された実装で作れなかったものはない。本番へのmigration適用・実データの補記・実際の書類再生成は行っていない。ブラウザでの見た目の確認も行っていない。これらは今回の禁止事項に従ったもの。git操作・コミット、computer-use・ブラウザ操作、Drive・Kintoneへの実接続、本番書込みは一切行っていない。

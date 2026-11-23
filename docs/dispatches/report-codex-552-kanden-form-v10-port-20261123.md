# Codex-552 関電 営業フォーム v10 移植報告（2026-11-23）

`/system/forms/kanden` と `/m/kanden` は共通フォームを使う。新規送信は見本どおり、獲得種類、書類添付・読み取り・番号入力、PD 照合、送信の順に並べた。画面は form-kit と線画アイコンを使用した。

| 見本の機能 | 結果 | 実装内容・理由 |
| --- | --- | --- |
| PD 番号の照合（`checkPD`／`setPD`） | 移した | 入力が 450 ms 止まった時点で、認証・公開範囲を確認したサーバーから `soil_kanden_list` を 1 件照合する。全角と枝番を受け付け、名義、カナ、住所、電話、お客様番号、契約種別、リスト名を反映する。古い入力への応答は破棄する。 |
| リスト外の確認（`confirmOutside`／`updateOutsideCN`） | 移した | 「リストに見つかりません」「リスト外の案件ですか？」を表示する。「はい」を選ぶとお客様番号の手入力が必須になる。通信エラーは再照合できる。 |
| 旧期 PD の置換・巻き直し（`chooseReplace`／`chooseMakinaoshi`） | 移せなかった | 見本のダミーマスタにある新旧 PD の対応と巻き直しの判定に使う情報を、今回指定の Garden の表から確定できない。入力した PD・枝番で照合する。 |
| 書類撮影と添付（`handleCategoryFile`／`openGuideCapture`／`captureFromGuide`／`openThumb`／`removeAttachment`／`validateAttachments`） | 移した | 受領書、電灯、動力、ガス、諸元の順で表示する。ガイド枠を使った撮影・切り出し、端末カメラ、ファイル選択、拡大、取り除き、再送に対応する。電灯・動力・ガスのいずれかの添付が必須。諸元は複数、他は各 1 枚。単枚を撮り直すときは先に取り除く。 |
| OCR（`startOcrAutofill`／`showOcrResult`／`forceOcrRun`） | 画面と手入力の導線を移した | 結果・再読み取りの操作位置に「読み取りは準備中」と表示する。OCR エンジンと OCR 検出結果に基づく至急 SW 操作は、読み取りの仕組みが未提供のため未接続。 |
| 供給地点・お客様番号（`onSupplyPointInput`／`buildSupplyPoint`／`formatSupplyPoint`／`formatCustomerNumber`／`onExpectedCnInput`） | 移した | 半角・全角数字を受け付け、22 桁・14 桁の入力状態と区切りを表示する。番号の抽出と候補生成は v10 営業フォームの式に合わせた。リストに供給地点番号があれば優先する。入力値は送信に保存し、受付画面で未記入の項目を補う。 |
| 囲込／奪還（`setAcquisition`） | 移した | 新規送信の先頭に配置した。 |
| 至急 SW（`onUrgentSwToggle`／`onUrgentSwMonthChange`／`toggleManualSW`／`onManualSwMonthChange`／`resetUrgentSw`） | 手動操作を移した | 至急指定、1〜12 月の希望月、解除時と送信完了時の月の初期化。OCR 由来の操作は読み取り接続時に有効化する範囲。 |
| 諸元待ちと最終確認（`showShogenConfirm`／`confirmShogen`／`requestSubmitConfirm`／`proceedToFinalConfirm`／`confirmAndSubmit`／`submitCase`） | 移した | 諸元未添付時は添付に戻るか諸元待ちを選ぶ。次に送信内容を確認してから確定。Storage への直接送信、HEIC 変換、長辺 1500 px、サーバーでの PDF 生成、Garden 通知を既存経路で使う。 |
| マイページ（`renderMyProfileStats`） | 移した | 本人の氏名、ふりがな、社員番号、入社日、メールと、当月の送信・完了・諸元待ち・至急 SW 件数を表示する。 |
| 見本のプロフィール補足・設定 | 一部移せなかった | 所属、業務端末、内線、営業許可番号・申込コード・有効期限の営業フォーム向けの確定データや、見本のダミーのパスワード変更・ログアウト操作は移植していない。 |
| 案件一覧（`renderMypage`／`toggleCases`／`countUrgent`／`toggleUrgentFilter`／`isCustomerSpecsStale`／`getStatusLabel`） | 移した | 本人の送信を案件ごとに開閉できる。受注の現行ステータス、至急 SW 件数・絞り込み、諸元待ち 30 日以上の表示、送信写真の閲覧を実装した。初期表示は直近 10 件で、追加表示は 50 件単位。 |
| 後追加（`openPostAddMode`／`onPostAddCaseInput`／`submitPostAdd`） | 移した | 案件一覧のボタンか、Garden の案件番号を入力して本人の送信を指定する。諸元を添付し、既存の写真と合わせて PDF を再生成する。見本の QR 操作はダミー案件を選ぶ動作のため移していない。 |
| 情報更新（`openInfoUpdate`／`submitInfoUpdate`） | 移した | 変更内容を入力して、既存の Garden 通知経路へ申請する。 |
| 離席ロック（`lockScreen`／`tryUnlock`／`resetInactivityTimer`） | 移した | 手動または無操作 5 分でロックし、同じ利用者の Garden パスワードをサーバーで再確認して解除する。 |
| 12 月 1 日までの公開範囲 | 維持 | `rollout.ts` と既存の画面権限を入口とサーバー操作で使用する。 |

## Vercel 呼び出しの見積もり

自動ポーリング・cron は 0 回/日。PD は有効な番号を入力し終えてから 1 回、画像本体のアップロードは Storage に直接行う。撮影、入力、添付の拡大、送信前の確認および無操作ロックは Vercel を呼ばない。

| 操作 | 回数 | 例の 1 日あたり |
| --- | --- | --- |
| 画面を開く | 1 回/表示 | 20 |
| 新規送信のアップロード許可 | 1 回/添付操作 | 90（30 件 × 3 操作） |
| 新規送信の確定 | 1 回/件 | 30 |
| PD 照合 | 1 回/確定した入力、訂正や再照合はその都度 | 30 |
| 諸元の後追加 | 枠確保・添付許可・送信で 3 回/件。案件番号から探すときはさらに 1 回 | 17（5 件のうち 2 件は番号検索） |
| 案件一覧の絞り込み・更新・追加表示 | 1 回/操作 | 10 |
| プロフィールの表示 | 1 回/表示 | 10 |
| 送信済み写真を開く | 1 回/案件 | 5 |
| 情報更新の申請 | 1 回/申請 | 1 |
| ロック解除 | 1 回/試行 | 10 |
| **計** | | **223 回/日** |

利用量は例示。既存と共通の画面表示、添付許可、送信確定、後追加の枠確保・添付許可・送信を同じ条件で数えると 155 回/日で、差分は 68 回/日。Supabase 内部のクエリ、Storage への画像転送、通知は別計上。操作のやり直しや複数回の添付許可は各操作分が加わる。

## 検証

- `npx.cmd vitest run src/app/system/forms src/app/m src/lib/leaf-kanden src/app/leaf` は 34 ファイル・160 テスト通過。PD 入力待ちと全角枝番、リスト外の番号連動、諸元待ちから最終確認、諸元の後追加をテストした。
- `npx.cmd tsc --noEmit` はエラーなし。
- 幅 390 px は form-kit の可変幅、折り返し、ライト／ダークのトークンを使っている。ブラウザと実機でのレイアウト・カメラ動作は未検証。
- migration は `supabase/migrations/20261123000552_leaf_kanden_sales_form.sql` に記述。SQL の DB 適用・実行確認は行っていない。本番の DB・Storage への書き込み、通知送信、git 操作、ブラウザ、computer-use は実施していない。`scripts/leaf-kanden-photos` は作業対象外。

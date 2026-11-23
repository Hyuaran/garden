# Codex-552 関電 営業フォーム：Garden スタイルの見本（PoC v10）をそのまま社長スタイルへ移す（2026-11-23）

Codex-551 のあとに行う（551 の `soil_kanden_list` を使う）。

## 東海林さんの指示（2026-11-23）
- 「フォームも Garden スタイルのとき、このようなフォームでしたか？ PD 番号から顧客情報引っ張れるようにしてなかったか？」
- 「基本的に Garden スタイルのものを社長スタイルにするだけ」
→ 見本＝`docs/specs/leaf/kanden-input-v10-poc.html`（春の「Garden-Leaf 関電業務委託 PoC v10」・旧 `src/app/leaf/_templates/input.html`）。**機能も並びもこの見本のまま**、見た目だけ社長スタイル（form-kit・線画アイコン・社長スタイル §2.5〜2.7）。勝手に省かない
- 今のフォーム（Codex-541：`/system/forms/kanden`・スマホ `/m/kanden`）を、この見本どおりに作り直す。今のフォームの良いところ（写メを Storage へ直接送る・HEIC→JPEG・1500px・サーバーで PDF・Garden通知・12/1 までは全権管理者だけ＝rollout.ts）はそのまま使う

## 見本 v10 から移すもの（見本の関数名）
- **PD 番号の照合**（checkPD／setPD）：入れたらその場で `soil_kanden_list` を引く（サーバーで・入力が止まってから 1 回）
  - 見つかった → 顧客情報（名義・カナ・住所・電話・お客様番号・契約種別・リスト名）を表示し、フォームに入れる
  - 見つからない → 見本どおり「リストに見つかりません」＋「リスト外の案件ですか？」の選択（confirmOutside・updateOutsideCN＝お客様番号を営業が入れる）
  - 実際の PD 番号の形は `PD` ＋ 7 桁（例 PD1527680）、枝番 `(2)` もある。見本の `PD202504-1001` の形の検査はやめ、`normalizeKanriNo` に合わせる
- **書類の撮影**：種類ごとの添付（handleCategoryFile・電灯／動力／ガス／諸元／受領）、撮影ガイド（openGuideCapture／captureFromGuide）、サムネイル（openThumb）、削除（removeAttachment）、添付の検査（validateAttachments）
- **読み取り（OCR）**（startOcrAutofill／showOcrResult／forceOcrRun）：今は読み取りの仕組みが無い。見本の画面の場所・流れだけ作り、「読み取りは準備中」と出して手入力で進められるようにする（後で読み取りをつなげる形に）
- **供給地点 22 桁**（onSupplyPointInput／buildSupplyPoint／formatSupplyPoint）・**お客様番号 14 桁**（formatCustomerNumber・onExpectedCnInput）
- **囲込／奪還**（setAcquisition）
- **至急 SW**（onUrgentSwToggle／onUrgentSwMonthChange／toggleManualSW／onManualSwMonthChange／resetUrgentSw）
- **諸元待ちで送信**（showShogenConfirm／confirmShogen）
- **最終確認→送信**（requestSubmitConfirm／proceedToFinalConfirm／confirmAndSubmit／submitCase）
- **マイページ**（renderMypage／renderMyProfileStats）・**案件一覧**（toggleCases・至急の絞り込み countUrgent／toggleUrgentFilter・isCustomerSpecsStale・getStatusLabel）：自分が送った案件と今のステータス（Codex-543 の新しい流れ）
- **後追加**（openPostAddMode／onPostAddCaseInput／submitPostAdd）：送った案件に写メを足す
- **情報更新**（openInfoUpdate／submitInfoUpdate）
- **離席ロック**（lockScreen／tryUnlock／resetInactivityTimer）
- 見本のダミーのデータ（masterDB・mypageData）は使わず、Garden の表（soil_kanden_list・leaf_kanden_orders・leaf_kanden_submissions）を読む

## 守ること
- **git 操作禁止**・**ブラウザ・computer-use 禁止**・**本番 DB・Storage への書き込み禁止**（migration は書くだけ）
- リストの個人情報は、PD 番号で 1 件引くときだけ返す（一覧で配らない）。テスト・ログ・報告にリストの中身を書かない
- スマホの入口 `/m/kanden` も同じ中身（スマホが主）。幅 390px で崩れないこと・ライト／ダーク
- Vercel の呼び出しを増やさない（PD 照合は入力が止まってから 1 回・写メは Storage へ直接）
- 画面の文字はきちんとした日本語・ちらつかせない・改行は LF

## 確かめ
- `npx vitest run src/app/system/forms src/app/m src/lib/leaf-kanden src/app/leaf` が緑、`npx tsc --noEmit` でエラーなし

## 報告
`docs/dispatches/report-codex-552-kanden-form-v10-port-20261123.md`（見本の機能ごとに「移した／移せなかった（理由）」の表・Vercel の呼び出し回数の見積もり）

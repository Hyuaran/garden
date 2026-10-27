# Codex-449：入社後の確認を「締結 → LINE テスト送信（確認コード）→ FileMaker（2分のタイマー）」の順にしか進めない作りに・書類 PDF のボタン（2026-10-27）

## 目的（東海林さんの決定）
応募から入社の流れの最後を、漏れが出ない順番に固定する。
1. **締結**：3 点（雇用契約書・秘密保持誓約書・緊急連絡先）の「締結」レ点が**3 点ともそろうまで**次へ進めない。
2. **LINE テスト送信**：会社から本人の LINE へ確認コード付きの文を送り、本人のスマホに届いた 6 桁を Garden に打って合えば「確認済み」。
3. **FileMaker**：1・2 が済むと［FileMaker に依頼］が押せる。押したら**2 分のタイマー**を出し、終わったら作られたかを確かめて結果を出す。
あわせて、入力済みの 3 点の PDF を作る［書類の PDF を作る］ボタンを付ける（MF 電子契約で送るのは人が手で行う）。

## 先に読む
- `C:\Users\shoji\.claude\projects\C--garden-main028\memory\project_view_permissions.md`（閲覧権限＝入社手続きのタブは歯車あり・書き込みは広げない）
- 入社予定者：`src/app/system/onboarding/HireCandidatesClient.tsx`・`_lib/hire-candidates.ts`（CHECKLIST_KEYS＝contract_sent/signed・nda_sent/signed・emergency_sent/signed・filemaker_added、line_skipped）・`_lib/hire-candidates.server.ts`（［入社］の処理の最後で `requestFilemakerAccount` を呼んでいる）・`src/app/api/system/hire-candidates/`
- FileMaker：`src/app/system/onboarding/_lib/filemaker-accounts.server.ts`（requestFilemakerAccount・reconcileRequest・status waiting/sent/done/failed）
- LINE：`src/lib/line/staff-client.ts`（公式 LINE「official｜通知」の送信）・`src/app/api/system/line/staff/webhook/route.ts`・`root_employees.line_user_id`
- 書類 PDF：雇用契約書＝`src/app/root/contracts/_lib/employment-contract-*.ts(x)`、秘密保持誓約書・緊急連絡先＝`src/app/system/mypage/_lib/todoke-pdf.server.tsx`（renderNdaPdf・renderEmergencyContactPdf）・`todoke-generation.server.ts`
- 共通部品：Modal・ChangeConfirm・Loading スタイル（スキル loading-style の決まり）・社長スタイル（正本 §2.5）

## やること
### A. ［入社］では FileMaker を依頼しない
- `hire-candidates.server.ts` の［入社］の処理から `requestFilemakerAccount` を外す（社員番号・KOT・名簿・Garden まで今どおり）。
- 既に依頼済み・作成済みの人（後道 愛美 1571 など）はそのまま。表示も今どおり。

### B. 順番の固定（画面と API の両方で）
入社後の確認の 1 人ずつの欄を、上から ①締結 ②LINE ③FileMaker の 3 段にする。前の段が済むまで次の段のボタン・入力は押せない（灰色＋「①の締結がそろうと進めます」のような理由を出す）。**API 側でも同じ条件を確かめ**、順番を飛ばす要求は 409 と理由で断る。
- ① 締結済み＝contract_signed・nda_signed・emergency_signed が 3 つとも true。
- ② LINE 済み＝下の確認コードが合った（新しい印 `line_verified`）または「LINE 登録しない」（line_skipped）。
- ③ ［FileMaker に依頼］は ①② が済んだときだけ。

### C. LINE テスト送信と確認コード
- ② の欄：本人の line_user_id が無い＝「まだ LINE を連携していません（入社手続きの最後のページの QR から登録）」と出し、［テスト送信］は押せない。「LINE 登録しない」は今どおり選べる。
- ［テスト送信］：6 桁の数字（000000〜999999・暗号的な乱数）を作り、本人に次の文を送る（文面はこのとおり）：
  ```
  Garden からのテスト送信です。
  確認コード：258945
  ```
- コードは**ハッシュで保存**（平文で残さない）・有効 24 時間・送り直すと前のコードは無効・**5 回まちがえたら無効**（送り直しが要る）。
- 入力欄に 6 桁を打って［確認］→ 合えば `line_verified` を true（日時・確認した人を記録）。まちがい＝「コードが違います（あと N 回）」、期限切れ＝「期限が切れました。もう一度送ってください」。
- 送信に失敗したら、理由を赤字で（LINE 側のエラーをそのまま英語で出さず、日本語で）。
- 保存先：`system_hire_candidates` に列を足すか、別表 `system_hire_line_checks`（どちらでもよい・migration を作るだけ）。

### D. FileMaker と 2 分のタイマー
- ③［FileMaker に依頼］→ ChangeConfirm で確認 → 依頼（`requestFilemakerAccount`）→ **2 分のタイマー**を出す（残り 1:59 のように 1 秒ずつ減る・くるくる・二重押し不可・画面を閉じても依頼は止まらないと一言）。
- 2 分たったら状態を取り直し（reconcile）：作成済み＝「FileMaker のアカウントを作りました」＋3 ファイルの結果、まだ＝「まだ作成中です。数分後にもう一度確かめてください」＋［確かめる］、失敗＝理由を赤字＋［やり直す］。
- 作成済みになったら filemaker_added の印を付ける（今の印と同じ扱い）。

### E. 書類の PDF
- ① の欄に［書類の PDF を作る］：新入社員が入力した内容と事務の欄（雇用形態・給与など）を差し込んだ 3 点（雇用契約書・秘密保持誓約書・緊急連絡先）の PDF を作って、まとめてダウンロード（3 ファイル or zip）。本人の入力が未提出のときは押せない。
- 足りない項目があれば作らずに、何が足りないかを出す。
- Drive への保存は今の届出 PDF の決まり（todoke-drive）に合わせてよい。

### F. 権限
- 締結のレ点・テスト送信・確認コード・FileMaker 依頼は、今入社予定者を書き換えられる人（canWrite）だけ。閲覧権限の歯車で見られるようになった人は見るだけ。

## テスト（`npx vitest run` が全部通ること・FAIL 0）
- ［入社］で FileMaker が依頼されない。
- 順番：締結 2/3 でテスト送信不可（画面・API とも）／LINE 未確認で FileMaker 不可（API 409）／line_skipped なら FileMaker 可。
- コード：6 桁・ハッシュ保存・24 時間・送り直しで前のコード無効・5 回で無効・正しいと line_verified。
- タイマー：2 分で状態を取り直す（fake timers）・作成済み／作成中／失敗の 3 つの表示。
- PDF：未提出は押せない・足りない項目は名前を出す。

## 触らないもの
- 新入社員が入力する画面（OnboardingClient）・LINE の webhook の連携処理・FileMaker のホストPC の係（agent）。本番 DB・環境変数。**git は触らないでください。コミットは人間側が行います。** npm install はしない。

## 確認
`npx tsc --noEmit`・`npx vitest run`。日本語が「???」に化けていないこと。ファイルの先頭に BOM を付けないこと。画面の文言に開発者用語（API・409・hash など）を出さない。

## 完了報告（コードブロックで）
変更したファイル／migration のファイル名／テスト結果（件数・FAIL 0）／画面の 3 段の文言（押せないときの理由も）。

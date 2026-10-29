# Codex-486：「扶養の人数」に［変更する］を付ける（届出の種類「扶養の変更」を足す）（2026-10-29）

## 東海林さんの話
- 3 か月ごとの確認・自分の情報の「登録内容の確認」で、扶養の人数だけ［変更なし］しか選べない（［変更する］が無い）。

原因：区分 `dependents` に結びつく届出の種類が無いので［変更する］が出ない（`src/app/system/mypage/tabs/ProfileTab.tsx` の `types`）。

先に読む：`C:\Users\shoji\iCloudDrive\iCloud~md~obsidian\Knowledge\070_AI-Rules\050_Gardenスタイル・社長スタイル.md` の §2.7（フォームは form-kit）。画面の文字はきちんとした言い方。長い説明は不要・ファイルは必要な範囲だけ読む。

**触ってよい場所：`src/app/system/mypage/`・`src/app/api/system/mypage/`・`src/app/root/inbox/`・`src/app/my/`・migration・テストだけ。**

## 作るもの
1. 届出の種類 `dependents`＝「扶養の変更」を足す（`submission-types.ts` の `SUBMISSION_LABELS`・`submission-fields.ts`・入力の確認）。migration `20261029000486_submission_dependents.sql`（作成のみ・Claude が本番に当てる）で `system_mypage_submissions.submission_type` の決まり（check）に `dependents` を足す。
2. 入力の項目：
   - 1 変更後の扶養の人数（0 以上の整数・必須）
   - 2 変更の内容（必須・複数行）：増える人／外れる人の氏名・続柄・生年月日・その年の収入の見込み
   - 3 変更の日（必須・日付）
   - 4 補足（任意）
3. 区分 `dependents` の［変更する］でこの届出を開く（3 か月ごとの確認の小窓でも、自分の情報でも同じ）。送ったら「答えた」とみなす（ほかの区分と同じ）。
4. 受信箱（`/root/inbox`）で、ほかの届出と同じく見られる（状態の言葉は共通の `SUBMISSION_STATUS_LABELS`）。Kintone へは送らない（`kintone_status='not_applicable'`）・PDF は作らない（`pdf_status='not_applicable'`）。
5. テスト：扶養の人数のカードに［変更なし］［変更する］の両方が出る・入力の確認（人数は 0 以上の整数・必須）・受信箱に出る。

## 終わったら
- `npx tsc --noEmit` と関係するテスト（`src/app/system/mypage/__tests__/page.test.tsx` も）を通す。完了報告（コードブロック）。
- ファイルは UTF-8（BOM なし）。**git は触らない（commit しない）。npm install しない。本番の DB に当てない。**

## 実装時の取得回数
- 新しい取得・cron は無し。

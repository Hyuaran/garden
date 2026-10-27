# Codex-450c：FileMaker「社員情報」に社員のレコードも作る＋入社済みの人にも依頼できるように

あなたは Codex-450c です。作業場所は C:\garden\a-bloom-008（main）。**commit・push はしない**。Codex-450／450b で作ったファイルを直す。長い説明は不要。終わったら `npx tsc --noEmit` と関係するテスト（`src/app/system/onboarding/`・`src/app/api/system/filemaker-accounts/`）を流し、`src` と `scripts` を `???` で検索する。

## 1. 社員情報ファイルの「社員情報」表に 1 行作る（ホストPC の係が ODBC で直接 INSERT）
- FileMaker「社員情報」ファイルの表 **`社員情報`**（ODBC アカウント Garden は **作成のみ可・編集と削除は不可**。2026-10-27 設定済み）。入れる項目と値：
  - `社員ID`（数値）＝ その時点の最大値＋1。ODBC では MAX() が使えないので `SELECT "社員ID" FROM "社員情報" ORDER BY "社員ID" DESC` の 1 行目＋1（`FETCH FIRST` は使わず、読んだ 1 行目だけ使う）
  - `社員名_姓`・`社員名_名`＝ 姓・名（system_hire_candidates.last_name / first_name）
  - `社員名_姓カナ`・`社員名_名カナ`＝ カナ（last_name_kana / first_name_kana）
  - `雇用形態`＝ employment_type（正社員／アルバイト／役員／派遣／パートナー。FileMaker 側も同じ言葉）
  - `打刻ID`＝ 社員番号（employee_number。テキスト）
  - `入社日`（日付）＝ hire_date。ODBC の日付は `{d 'YYYY-MM-DD'}` ではなくパラメータ（OdbcType.Date）で渡す
  - それ以外（社員名_合体・社員名_合体カナ・在籍中 など）は FileMaker の自動計算に任せる。触らない
- **二重登録しない**：INSERT の前に `SELECT "社員ID" FROM "社員情報" WHERE "打刻ID" = ?` を見て、あれば作らずに「既にある」として done 扱い（社員ID を結果に入れる）
- Garden 側の状態は files に 4 つ目のキー **`roster`**（画面の表示名「社員情報の名簿」）として持つ。FM_FILES に足す（eigyo/shain/call と同じ waiting→sent→done/failed。ただし roster は INSERT した時点で done、`fmStatus` の代わりに作った社員ID を `fm_status` に入れる）。既にある依頼行（files に roster が無い）は roster を waiting として扱う
- GET の jobs に roster 用の値を足す：`roster:{lastName,firstName,lastNameKana,firstNameKana,employmentType,employeeNumber,hireDate}`（roster が waiting のときだけ）
- `config.example.json` の files に `"roster": "社員情報"`（ファイル名）を足し、ホストPC の係は roster のときは gardenaccountrequest ではなく上の INSERT を行う
- ODBC の例外は 450b と同じく送らずログだけ（次の回にやり直す）。ただし「社員番号が空」「カナが空」など Garden 側の不備は Garden 側（agentWork）で failed にする（error「入社情報（社員番号・カナ）を確認してください」）

## 2. 入社済みで依頼が無い人にも［FileMaker に依頼］を出す
- 画面（`HireCandidatesClient.tsx` の FileMaker の行）：status が hired で依頼が無い人に［FileMaker に依頼］ボタン（canWrite のときだけ）。押すと既存の `POST /api/system/hire-candidates/{id}/filemaker`。
- 入社済みの後道 愛美さん（1571）・足立 真美さん（1572）がこの対象になる（実データは触らない。ボタンを出すだけ）

## 3. README・テスト
- README に roster（社員情報の名簿の行を作る）の説明を足す
- vitest：roster の状態遷移・GET の roster 値・不備のときの failed・依頼が無い hired 行にボタンが出ること

## 完了報告（この形で）
- 変更ファイル
- tsc／テストの結果（コマンドと件数）
- `???` 検索の結果
- 迷って決めたこと

# Codex-217 届出PDF基盤＋緊急連絡先届（所属会社差し込み・Drive保存）

- 発行日: 2026-08-27
- 対象: マイページ「緊急連絡先変更」届出（/system/mypage）＋ Root 届出受信箱
- 作業ツリー: `C:\garden\a-bloom-008`（`main 264b2bc`〜最新 から feature ブランチで）
- 背景（東海林さん確定・2026-08-27）:
  - 従業員がマイページで入力 → **入力内容で所属会社に合わせた届出PDFを Garden が生成 → Google ドライブに保存**。
    事務は受信箱（＝Driveフォルダ）から PDF をダウンロードして電子契約サービスに乗せる
  - **Garden のスコープは「入力→PDF生成→Drive保存」まで**。電子契約サービスへの連携は今回スコープ外
  - 本人はDLしない（事務がDriveから取得）。緊急連絡先届の**住所は必須**
  - 元となる正式PDF（レイアウト・文面の見本）:
    緊急連絡先届 = `G:\マイドライブ\01_経理部\25_緊急連絡先届\緊急連絡先届_20260401_ver.1_ヒュアラン.pdf`

## 0. 使う既存資産（新規ライブラリ導入なし）

- **PDF生成**: `@react-pdf/renderer` + `fontkit`（既存実例 `src/app/system/_lib/call-metrics-pdf.tsx`）。
  日本語フォントは `public/fonts/NotoSansJP-Regular.ttf` / `NotoSansJP-Bold.ttf`（配置済み）
- **Drive保存**: `src/app/api/bud/expense-drive/_lib/drive.ts` の `uploadToFolder` / `findOrCreateSubfolder`
  （OAuth・本番の `GOOGLE_DRIVE_OAUTH_JSON` で稼働中・scope=drive.file）
- **所属会社**: `root_companies`（`company_id` / `company_name` / `representative` / `address`）。
  従業員の `root_employees.company_id`（例 COMP-001）で引く
- **届出テーブル**: `system_mypage_submissions`（Codex-216・既存）

## 1. 届出PDF生成の共通基盤（新規・後続の秘密保持誓約書でも使う）

- 新モジュール（例 `src/app/system/mypage/_lib/todoke-pdf.server.tsx`）:
  - `@react-pdf/renderer` の `renderToBuffer` で日本語PDFを生成する土台（フォント登録は call-metrics-pdf の流儀）
  - 所属会社の宛先ブロックを差し込む共通コンポーネント（「株式会社◯◯ 代表取締役 ◯◯ 様」）
    ＝ company_id → root_companies から会社名・代表者名を取得
- Drive保存の共通関数（例 `src/app/system/mypage/_lib/todoke-drive.server.ts`）:
  - **保存先は「従業員1人＝1フォルダ」（人優先）**（2026-08-27 東海林さん確定）。構造:
    `08_Garden入社書類（＝環境変数 GARDEN_TODOKE_DRIVE_ROOT_FOLDER_ID・値はClaudeが設定）` 配下に
    `findOrCreateSubfolder` で **`【社員番号_姓名】` フォルダ**（例 `0008_東海林美琴`）を作り、`uploadToFolder` で保存
  - フォルダ名の作り方: `{root_employees.employee_number}_{root_employees.name のスペース除去}`
    （既存の手運用フォルダと同形＝`0008_東海林美琴`。姓名分割不要・name をそのまま連結し空白/全角空白を除去）
  - ファイル名: `緊急連絡先届_YYYYMMDD.pdf`（フォルダが人別なので種別名でよい。同名衝突時は日時秒を付す）
  - 環境変数が未設定なら**PDF/Drive保存をスキップ**し、届出自体は成功させる（Kintone連携と同じ流儀）
  - ※マイページでの本人表示（従業員が自分の書類をマイページで見る）は**Gardenサーバ仲介**で後日追加する
    前提（Driveの共有権限は本人に渡さない）。今回は保存＋フォルダ作成まで。フォルダを社員番号で一意管理しておくこと

## 2. 緊急連絡先届フォームの拡張（PDFに項目を合わせる）

現状の「緊急連絡先変更」モーダルは項目が足りない（提出者本人の情報が無い）。PDFに合わせて拡張:
- **区分**: 新規／変更（ラジオ）
- **提出者本人**: 氏名（本人＝自動・編集不可）／**現住所（必須）**／個人電話（必須）
- **緊急連絡先**: 氏名（必須）／続柄（必須）／**住所（必須・「同上」入力可）**／電話（必須）
- payload のキー例: `kind`/`selfAddress`/`selfPhone`/`ecName`/`ecRelationship`/`ecAddress`/`ecPhone`
- `submission-types.ts` の emergency_contact の必須項目を上記に更新（住所必須化含む）

## 3. PDF生成のタイミングと受信箱

- **従業員が送信した時点**でPDFを生成→Drive保存する（事務は受信箱でDriveリンクを開くだけ）
- `system_mypage_submissions` に生成結果を持たせる（例 `pdf_drive_file_id` / `pdf_drive_url` / `pdf_status`）。
  migration で列追加（`pdf_status` in `not_applicable`/`generated`/`skipped`/`failed`）。適用はClaude
- 受信箱（/root/inbox）の緊急連絡先届の詳細に **「届出PDFを開く」（Drive webViewLink）** を表示。
  未生成・失敗時は「PDF再生成」ボタン（Kintone再実行と同じ作り）
- PDF生成が失敗しても届出の受付自体は成功させる（failed を受信箱に出す）

## 4. PDFの中身（見本PDFに合わせる）

- レイアウトは @react-pdf の JSX で見本PDFを再現。**文面（同意文）は見本PDFから一字一句正確に転記**する
  （タイトル「緊急連絡先届（□新規 □変更）」、同意文、1.提出者本人／2.緊急連絡先、提出日・署名㊞欄）
- 宛先の会社名・代表者名だけ所属会社で差し替え（見本はヒュアラン・後道翔太）
- 区分チェックは選択された方に✓
- 提出日＝送信日（JST）。署名欄は氏名を印字（電子契約でハンコ相当を付けるので㊞は空枠のまま）
- フォントは NotoSansJP でよい（明朝希望が出たら別対応）

## 5. 変えないこと

- Codex-216 の他4種の届出（通勤経路/口座/退職届/秘密保持）※秘密保持のPDF化は次の Codex-218
- タブ構成・4桁ゲート・Kintone連携・打刻
- 電子契約サービスとの連携（スコープ外）

## 6. テスト

- 会社差し込み: COMP-001/002/003 で宛先の会社名・代表者名が正しく出る
- 必須チェック: 住所を含む必須項目が空だと送信できない
- PDF生成: emergency_contact 送信→pdf_status=generated・Driveリンクが受信箱に出る（Drive呼び出しはモック）
- 環境変数未設定: pdf_status=skipped で届出は成功
- 生成失敗: failed・受信箱に再生成ボタン
- 既存の mypage テストが緑

## 8.【差し戻し 2026-08-27・保存先を人優先フォルダに】

初回実装（9e8c9ad）は着手後に §1 を更新したため、保存先が旧仕様（種別サブフォルダ「緊急連絡先届」・
ファイル名 `緊急連絡先届_氏名_日付.pdf`）になっている。**確定した人優先フォルダ**（東海林さん）へ直すこと。

1. **保存先＝「従業員1人＝1フォルダ」**：
   ルート（`GARDEN_TODOKE_DRIVE_ROOT_FOLDER_ID`）配下に `findOrCreateSubfolder` で
   **`【社員番号_姓名】` フォルダ**（例 `0008_東海林美琴`）を作り、その中に保存する
2. フォルダ名の生成: `{root_employees.employee_number}_{name のスペース除去}`
   （name 例「東海林 美琴」→ 半角/全角空白を除いて「東海林美琴」→ `0008_東海林美琴`）
3. **ファイル名から氏名を除く**（フォルダが人別のため）: `緊急連絡先届_YYYYMMDD.pdf`
   （同名衝突時のみ `_HHMMSS` を付す）
4. `saveTodokePdf` / `generateEmergencyContactPdf` に **employee_number** を渡す経路を追加
   （`submission-server.ts` の `requireEmployee` の select に `employee_number` を足す。
   呼び出し元 `submissions/route.ts` から number を渡す）
5. テスト（todoke-drive / todoke-generation）を人優先フォルダ名・新ファイル名に更新

補足（変更不要の良かった点）: PDF基盤の別モジュール化・会社差し込み・フォーム拡張・migration・
受信箱の見え方・folderHasFile 追加は指示書通りで良い。会社住所を宛先に出さない判断も正しい。

## 9.【差し戻し2 2026-08-27・日本語PDFの折り返しハイフン】

実PDF（本番相当・Drive保存まで成功）を目視確認したところ、**日本語の折り返し位置に不要なハイフンが入る**
（「連絡先として、-以下」「使用-される」「同上-」「デモアカウント-」等）。@react-pdf/renderer が
英語式ハイフネーションを日本語に適用しているのが原因。
Claudeが `Font.registerHyphenationCallback` を2通り（`[word]`＝分割なし／1文字分割）試したが、
前者はハイフンが残り、後者はハイフンが残るうえ署名が2ページ目に溢れてレイアウトも崩れた（両方revert済み）。
**正しい日本語対応を実装すること**。方針の候補（Codexが検証して最善を選ぶ）:
- 日本語テキストの各文字間に **ゼロ幅スペース（U+200B）** を挿入して改行させる（スペース境界の改行はハイフンを付けない）。
  共通ヘルパー（例 `jaWrap(text)`）を作り、consent／各Field の value／section 見出しなど**日本語を含むText全体**に適用する
  （英数字の番地・電話番号は分割されないよう、CJKを含む語だけに挟むなど副作用に注意）
- または @react-pdf で確実にハイフンを抑止できる別手段があればそれでよい
- 受け入れ基準: 見本PDF相当の本文で**折り返しにハイフンが1つも出ない**・
  住所/電話番号が不自然に縦分割されない。todoke-pdf のテストに「ハイフンが含まれないこと」の検証を足す

**署名まわりのレイアウト修正（東海林さん 2026-08-27）**:
- **署名の氏名と㊞を改行させず同一行に**。㊞は氏名の少し右に配置する
  （現状は全角スペース9個で右に寄せて折り返し→改行している。全角スペース連打をやめ、
  氏名と㊞を別要素にして横並び＝marginLeft等で㊞を氏名の右に置く。footerValue の幅も要調整）
- **全体を1ページに収める（2ページ目を作らない）**。現状は末尾がわずかに溢れて2ページ目
  （pageNo「1」だけの空ページ）ができている。余白（page paddingTop/Bottom、footer marginTop:72、
  各 field marginBottom:16、consent marginBottom:25 など）を詰めて A4 1枚に収める
- この基盤は秘密保持誓約書（218）・雇用契約書でも共通で使うので、todoke-pdf 側で直すこと

**あわせて（東海林さん 2026-08-27）**: 緊急連絡先の住所の **PDFラベルを「住所」だけに短縮**する
（見本の「住所（本人と同一の場合は「同上」と記載）」は紙で手書きする人向けの案内。Gardenは入力欄で
案内するので不要）。フォーム側は現状の「緊急連絡先の住所（同一の場合は「同上」）」のままでよい。
このラベル短縮でその行の折り返しハイフンも消える。

## 7. 完了時にやること

1. `npx tsc --noEmit`・対象テストが緑（AppHeader.test の既存1件は無関係）
2. migration・Drive/PDFの実生成テストは行わない（Claudeが env設定→実機E2E→テストPDF削除まで）
3. 完了報告を**コードブロックで**出力（変更ファイル・PDF基盤の作り・環境変数名・payload構造・
   migration内容・受信箱の見え方・tsc/テスト結果・迷った点）

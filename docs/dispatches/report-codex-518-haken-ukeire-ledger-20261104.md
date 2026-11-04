# Codex-518 派遣管理 実装レポート

作成日：2026-11-04

## 開始条件・制約
- pwd：C:\garden\a-bloom-008、git log -1 --format=%h：997f12c5。一致後に実装。
- 上記以外のgit操作・commitなし。computer-use・ブラウザ操作なし。
- 本番書き込み、migration適用、Chatwork・Googleドライブ・KING OF TIMEの実呼び出し、ホストPC操作なし。手本は指定されたローカルパスから読み取りのみ。
- vercel.jsonは変更なし。マニュアルのStorage掲載なし。

## 実装したもの
- /system/haken：受け入れた人・派遣会社・期限と未回収。共通の場所表示、最終更新、タブ、表、閲覧権限設定を使用。
- 受入台帳・派遣会社の発行初期値・受入事業所の待遇情報を専用詳細ページで編集。名簿の人を選ぶと氏名と派遣会社を反映。
- 派遣元からの通知、個別契約、書類の追加と論理削除、教育訓練・苦情、台帳Excel。
- 抵触日・意見聴取・更新確認・保存期限を純粋関数で計算。通知した日付との差を警告し、自動では書き換えない。
- 終了から３年以内の削除・保存期間短縮と物理削除を受け口およびデータベースで防止。
- PDF３点は手本の文面を使い、会社・事業所・日付・初期値を差し替える。ご確認事項が空なら見出しも省略。保存失敗でもPDFを渡し、画面上のエラーと発行履歴を残す。
- 登録前に発行した書類は発行単位を入社予定者に引き継ぎ、入社時に台帳へ紐付ける。
- 派遣の入社予定者は派遣会社・終了日が必須。入社時に従業員の派遣会社更新・契約と台帳の作成を同時処理。入社予定者の一意制約で二重作成を防ぐ。
- 従業員画面に派遣会社の列・絞り込みを追加。派遣だけ編集欄を表示。
- Excelは手本の項目順で１人１シート。保存期限、就業記録の枠、教育訓練・苦情を付ける。表の検索・列の絞り込み後の全員を出力。
- 通知は認証、一意の予約、送信時刻を使用。０件は送らず、送信失敗の知らせも１回。二重送信を避けるため失敗時の予約を残す。
- メニュー・検索・権限一覧・マニュアル（haken）を登録。

## 変更・追加ファイル
- `src/lib/haken/documents.test.ts`
- `src/lib/haken/excel.test.ts`
- `src/lib/haken/haken-drive.server.ts`
- `src/lib/haken/haken-excel.server.ts`
- `src/lib/haken/haken-pdf.server.ts`
- `src/lib/haken/ledger-fields.json`
- `src/lib/haken/ledger.test.ts`
- `src/lib/haken/ledger.ts`
- `src/lib/haken/notify.test.ts`
- `src/lib/haken/notify.ts`
- `src/lib/haken/reference-defaults.json`
- `src/lib/haken/reference-text.json`
- `src/lib/haken/rules.test.ts`
- `src/lib/haken/rules.ts`
- `src/lib/haken/server.ts`
- `src/lib/haken/types.ts`
- `src/app/system/haken/ExcelButton.tsx`
- `src/app/system/haken/haken.module.css`
- `src/app/system/haken/HakenClient.tsx`
- `src/app/system/haken/HakenDetail.tsx`
- `src/app/system/haken/HakenHireFields.test.tsx`
- `src/app/system/haken/HakenHireFields.tsx`
- `src/app/system/haken/IssueButtons.tsx`
- `src/app/system/haken/layout.tsx`
- `src/app/system/haken/offices/[id]/page.tsx`
- `src/app/system/haken/page.tsx`
- `src/app/system/haken/parties/[id]/page.tsx`
- `src/app/system/haken/ukeire/[id]/page.tsx`
- `src/app/api/system/haken/cron/route.ts`
- `src/app/api/system/haken/documents/route.test.ts`
- `src/app/api/system/haken/documents/route.ts`
- `src/app/api/system/haken/excel/route.ts`
- `src/app/api/system/haken/route.test.ts`
- `src/app/api/system/haken/route.ts`
- `supabase/migrations/20261104000519_haken_ledger.sql`
- `src/app/system/onboarding/HireCandidatesClient.tsx`
- `src/app/system/onboarding/onboarding.module.css`
- `src/app/system/onboarding/_lib/hire-candidates.ts`
- `src/app/system/onboarding/_lib/hire-candidates.server.ts`
- `src/app/system/onboarding/_lib/hire-candidates.test.ts`
- `src/app/root/employees/UrlViewClient.tsx`
- `src/app/root/_constants/types.ts`
- `src/app/api/root/employees/route.ts`
- `src/app/api/root/view-data/route.ts`
- `src/app/system/_components/ShachoShell/shacho-shell-config.ts`
- `src/lib/auth/system-view-scopes.ts`
- `src/lib/auth/permission-registry.ts`
- `src/lib/search/catalog.ts`
- `src/app/system/manuals/_lib/manuals-registry.ts`
- `docs/dispatches/dispatch-codex-518-haken-ukeire-ledger-20261104.md`

## migration
supabase/migrations/20261104000519_haken_ledger.sql：作成のみ、未適用、初期データなし。７表、従業員・入社予定者の追加列、保存制約、契約と台帳の同時保存処理、入社時の重複防止処理。全表RLS有効・ポリシーなし。public/anon/authenticatedをrevokeしservice_roleへgrant。実DBへの適用・トランザクション検証は行っていない。

## マニュアル
指定の33_派遣管理に④を先に作り、⓪①②③を派生。v1.0・2026-11-04。カード形式なし。①はタブごとの使い方。Storage未掲載。
- `C:/Claude/000_Garden/150_System_システム/00_マニュアル/33_派遣管理/Garden_System_派遣管理_0_要点サマリ.html`
- `C:/Claude/000_Garden/150_System_システム/00_マニュアル/33_派遣管理/Garden_System_派遣管理_1_操作マニュアル_研修用.html`
- `C:/Claude/000_Garden/150_System_システム/00_マニュアル/33_派遣管理/Garden_System_派遣管理_2_仕様書マニュアル_非エンジニア向け.html`
- `C:/Claude/000_Garden/150_System_システム/00_マニュアル/33_派遣管理/Garden_System_派遣管理_3_仕様書マニュアル_エンジニア向け.html`
- `C:/Claude/000_Garden/150_System_システム/00_マニュアル/33_派遣管理/Garden_System_派遣管理_4_仕様書_Claude読み込み用.md`

## テスト結果
- npx tsc --noEmit：成功。
- 指定範囲に入社予定者の既存回帰テストを加えて実行：12ファイル・89件成功。
- コマンド：npx vitest run src/lib/haken src/app/system/haken src/app/api/system/haken src/lib/auth/permission-registry.test.ts src/lib/ui/no-flicker-source.test.ts src/app/system/onboarding/_lib/hire-candidates.test.ts src/app/api/system/onboarding/hire-candidates/permission.test.ts
- 生成したPDF３点からpdfjsで文字を再抽出し、手本の2026-09-07の文面・順番と一致（空白・改行は正規化）。ご確認事項の見出し省略も確認。
- うるう年、３か月ちょうど／超え、重複期間、会社をまたぐ個人、無期・60歳以上、通知日との差、保存期限を確認。
- PDF以外・20MB超の拒否、保存先未設定、保存失敗でもPDFを返すこと、閲覧・編集・発行の403を確認。
- Excelを読み直して項目順・保存期限・付属シートを確認。通知０件・同時実行と失敗通知の重複防止を確認。
- 派遣欄の必須判定、親の再描画で再取得しないこと、派遣以外の従来処理、既存のちらつき防止検査を確認。
- 変更したコードの文字列・同梱資料・マニュアルに置換文字と連続した疑問符なし。指示書に元からある文字化け禁止の例示は検査から除外。

## 作れなかったもの・未確認
- **游明朝の同梱は未対応。** 利用できる游明朝がリポジトリにないため、現状は同梱NotoSansJP。GARDEN_HAKEN_PDF_FONT_PATHで利用可能なフォントを指定可能。指定字体への対応はClaude側で適法に配備できる游明朝の準備が必要。
- 画面・PDFの見た目、実際のドライブ保存・送信・入社、本番migrationは未確認。ユーザー指示どおりClaudeの確認対象。
- 通知の予約が残った場合は実送信の有無を人が確認し、再送を判断する。

## 実行回数の見積り
定時実行は未登録で０回／日。将来１日１回で登録するなら１回／日（月最大31回）。追加した画面の定期取得は０回／日。見積りは指示書にも追記した。

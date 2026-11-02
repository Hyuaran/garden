# Codex-507 作業レポート（2026-11-02）

## 実装
- 現在の root_employees.employment_type を本人の読み込み・入社後の確認一覧・締結変更API・締結PDF生成で参照。
- 派遣は締結3行の「締結しない」をチェック済み・操作不可にし、送った／締結済みも操作不可。「派遣のため締結しません」を表示。APIへの直接変更も409で拒否。
- 派遣本人は「あなたのこと」「住所と連絡先」「確認」の全3画面。進捗・戻る・確認からの修正・提出後の確認も同じ範囲。通常は11画面を継続。
- サーバー保存は派遣の表示項目だけ許可。非表示項目を送っても上書きせず、既存値・番号の暗号・同意日時も保持。
- 現在の雇用形態が派遣でなくなれば通常の表示と締結操作に戻る。既存の「締結しない」は通常どおり手で外せる。

## 変更ファイル
すべて src/app/system/onboarding/ 配下。
- HireCandidatesClient.tsx、HireConfirmationSteps.tsx、OnboardingClient.tsx
- _components/OnboardingReview.tsx
- _lib/hire-candidates.ts、_lib/hire-candidates.server.ts、_lib/hire-documents.server.ts
- _lib/onboarding.ts、_lib/onboarding.server.ts
- _lib/onboarding-admin.ts、_lib/onboarding-admin.server.ts
- admin/[employeeId]/OnboardingAdminDetailClient.tsx
- テスト：HireCandidatesClient.test.tsx、OnboardingClient.test.tsx、haken-steps.test.tsx、_lib/hire-candidates.test.ts、_lib/onboarding.server.test.tsx、_lib/onboarding-admin.server.test.ts

## 事務側
- みんなの入社手続きの一覧・詳細の未入力判定：派遣の非表示項目を対象外。
- 締結PDF3種：派遣では不足項目検査・生成を行わず、理由と空のファイル一覧を返す。画面の作成ボタンも無効。
- 扶養控除申告書・入社連絡表：空の家族・番号・口座・通勤情報を理由に拒否する必須検査はなく、空欄を許容する既存処理を継続。法人・テンプレート・保存先などの検査は維持。

## テスト
- 変更関連5ファイル：112件成功。3画面での提出・確認見出し・既存値保持・現在派遣の締結変更拒否を含む。
- 最後の締結完了判定変更後、hire-candidates.test.ts：51件成功。
- npx tsc --noEmit：失敗。今回のソースにエラーはなく、.next/dev/types/validator.ts が存在しない旧 api/system/hire-candidates の7ルートを参照（TS2307）。許可範囲外の生成物は編集していない。
- 指定の全体Vitest：65ファイル・515件中514件成功／1件失敗。失敗は src/app/system/mypage/__tests__/page.test.tsx の shows and submits the full NDA fields。既存の同意ラベル /(^|\s)内容に同意します$/ が見つからない（今回この画面・テストは未変更）。禁止範囲の共通フォームに関わるため変更せず記録。
- 日本語のUTF-8読み戻し確認済み。画面確認は指示どおり未実施。

## マニュアル（下書きのみ）
C:\Claude\000_Garden\150_System_システム\00_マニュアル\04_入社手続き\ の⓪①②③④を更新。
- 変更前を999_Archive/<元の名前>.bak-20261102dに保存。
- v1.16・2026-11-02の派遣向け説明を追記し、本文の「外せる」を訂正。①は業務の言葉で簡潔に記載。
- ④に§22を追加。3画面・確認表示・保存対象・締結固定・事務側の対象外を記載。
- ⓪のscript id="md4"は変更前と一致することを検証。
- Storageへのアップロードなし。

## 制約
- git、computer-use、ブラウザ操作、本番への書き込みは実施していない。
- forms/_components、globals.cssは変更していない。migration追加なし。
- cron・定期取得追加なし。増加0回/日。

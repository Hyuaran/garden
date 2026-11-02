# Codex-505 作業レポート（2026-11-02）

## 実施内容
- candidates／confirmations の閲覧権限を、そのタブの操作権限に使用。画面の登録・行の修正・入社・続きから・確認チェック等を許可。
- 既存の入社用 API は指示書の変更許可範囲外だったため、`src/app/api/system/onboarding/hire-candidates/**` に API を追加して画面の接続先を変更した。範囲外の `src/app/api/system/hire-candidates/**` は変更していない。旧 API の書き込みは全権管理者限定のまま。
- 新 API の登録・予定者修正・辞退・入社・選択肢は candidates、チェック・名前補完・書類・LINE・FileMaker は confirmations の canView で判定。在籍・ログイン確認は既存の viewPermissionContext を使用。タブを見られなければ 403。
- 派遣だけ名・メイ・生年月日・性別を空欄で保存可能。性別の空欄は「不明」。未入力項目がある派遣に注意色の「情報待ち」を表示。
- 派遣の KING OF TIME 登録では、空の名は「未定」、空のメイは「ミテイ」、空の生年月日は送信しない。名簿は名・生年月日を空で登録。生年月日が空の重複照合は社員番号と打刻 ID の両方で行う。Garden の氏名は姓のみ、生年月日は null。
- 入社後の確認に「⓪ 名前・生年月日」を追加。4 項目を保存すると KING OF TIME・名簿・Root・入社予定者を更新。KING OF TIME の変更停止・中継停止時は Garden と名簿を更新し「KING OF TIME は手で直してください」を表示。
- 締結 3 行に「締結しない」を追加。送った・締結済みは画面で灰色の操作不可にし、サーバー側でも変更を拒否する。監査記録 checked_at／checked_by を保存。見出し・一覧・後続段階・完了判定で締結済みと同様に集計。派遣は入社完了時に 3 つとも付く。外して戻せる。
- 雇用契約書が締結不要の間は中身の入力欄を非表示。
- 登録・修正・⓪の必須欄に garden-required と required／aria-required を追加。雇用形態を変えると派遣の任意欄の＊が即座に切り替わる。

## 変更ファイル
### 画面・共通処理
- `src/app/system/onboarding/page.tsx`
- `src/app/system/onboarding/HireCandidatesClient.tsx`
- `src/app/system/onboarding/HireConfirmationSteps.tsx`
- `src/app/system/onboarding/HireConfirmation.module.css`
- `src/app/system/onboarding/_lib/hire-candidates.ts`
- `src/app/system/onboarding/_lib/hire-candidates.server.ts`
### 追加 API
- `src/app/api/system/onboarding/hire-candidates/route.ts`
- `src/app/api/system/onboarding/hire-candidates/kot-options/route.ts`
- `src/app/api/system/onboarding/hire-candidates/[id]/route.ts`
- `src/app/api/system/onboarding/hire-candidates/[id]/hire/route.ts`
- `src/app/api/system/onboarding/hire-candidates/[id]/documents/route.ts`
- `src/app/api/system/onboarding/hire-candidates/[id]/line/route.ts`
- `src/app/api/system/onboarding/hire-candidates/[id]/filemaker/route.ts`
### テスト
- `src/app/system/onboarding/page.test.tsx`
- `src/app/system/onboarding/HireCandidatesClient.test.tsx`
- `src/app/system/onboarding/HireConfirmationSteps.test.tsx`
- `src/app/system/onboarding/_lib/hire-candidates.test.ts`
- `src/app/api/system/onboarding/hire-candidates/permission.test.ts`

## migration
`supabase/migrations/20261102000505_hire_candidates_haken_partial.sql`

first_name／first_name_kana／birthday／gender の NOT NULL を解除し、派遣以外では値を必須とする CHECK を追加。既存の gender 値の制約は維持。作成のみで、DB には適用していない。

## KING OF TIME で省けなかった項目・確認事項
- **性別**：現在の `src/lib/relay/types.ts` の KotEmployeeCreate は gender を必須としている。変更許可範囲外の共通中継型を変更せず、不明なら KING OF TIME 登録段階で明示的に止める。架空の性別は送信しない。
- KING OF TIME の実 API 自体が性別省略を受け付けるかは未確認。ユーザーの禁止事項に従い、ブラウザ・本番 API への書き込みによる確認は行っていない。省略可能なら共通中継型・中継処理も確認したうえで後続対応が必要。
- 生年月日は既存の中継型で任意であり、省略する実装とモック検証を行った。
- 既存の名簿同期は、生年月日が空の場合に本人用アカウントの作成をスキップする。派遣の生年月日が空の間は、その既知の理由に限り台帳登録を完了できるようにした。初期パスワードの基になる生年月日を仮入力しない。⓪で本当の生年月日を保存後に名簿同期を再実行し、通常の手順でアカウントを準備する。それまでは本人用アカウントが未準備の場合がある。
- 複数システムの更新は一括トランザクションではない。KING OF TIME の一般的な更新エラーは完了にせず、接続・内容を確認して再保存する案内とする。停止中の手動修正案内は保存結果として表示する。

## 検証結果
- `npx tsc --noEmit`：成功。
- `npx vitest run src/app/system/onboarding src/app/api/system/onboarding`：**41 ファイル・370 件すべて成功**。
- 確認対象：閲覧許可された責任者の画面上の書き込み許可、API のタブ別許可／拒否、派遣の任意入力・必須切り替え・情報待ち、KING OF TIME の「未定」「ミテイ」・生年月日省略、⓪で KING OF TIME と名簿更新、変更停止時の案内、締結不要の集計・入力欄の無効化・派遣の初期チェック。
- ログ：`outputs/codex-505-vitest.log`。React の act に関する警告あり。失敗はなし。
- 変更した日本語を UTF-8 で読み直し、置換文字・連続した疑問符の混入がないことを確認。
- computer-use・ブラウザ確認は未実施。画面の実表示と社長スタイル §2.6 の寸法点検は指示どおり Claude 側で実施する。
- cron・定期取得の追加なし。増加 **0 回/日**。既存の usePolling だけを継続。

## マニュアル
対象フォルダ：`C:\Claude\000_Garden\150_System_システム\00_マニュアル\04_入社手続き\`

- ⓪〜④の元ファイルを `999_Archive/<元の名前>.bak-20261102c` にコピーしてから編集。
- ④を v1.14 → **v1.15** に上げ、§21 に権限・派遣・締結不要・API・migration・制約を追加。古い書き込み権限の記述も修正。
- ②③も **v1.15／2026-11-02** にそろえて説明を追加。②の旧権限説明を修正。
- ①は使い方の決まりを読み、タブの見出し・派遣の登録・⓪の補完・締結不要・操作権限を短い業務文で更新。最終更新 2026-11-02。
- ⓪は表示側の概要・版情報を更新。**`<script id="md4">` 以降が退避ファイルと一致することを確認し、埋込み④は変更していない**。写し替えは Claude 側。
- いずれも下書き。Storage にはアップロードしていない。

## 未実施・引き継ぎ
- migration の本番適用・画面確認・マニュアルの公開は未実施。
- 性別不明のまま KING OF TIME に登録する処理は、上記の中継型・実 API の確認待ちで止めてある。
- 生年月日不明の派遣の本人用ログインは、⓪の補完前には未準備となる場合がある。
- git の操作、本番 DB・Kintone・KING OF TIME への書き込みは一切行っていない。forms の共通部品と globals.css は変更していない。

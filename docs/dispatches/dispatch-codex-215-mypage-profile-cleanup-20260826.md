# Codex-215 マイページ表示の整理（従業員展開準備・第1弾）

- 発行日: 2026-08-26
- 対象: マイページ「マイページ」タブ（/system/mypage・ProfileTab）
- 作業ツリー: `C:\garden\a-bloom-008`（`main da5c335` から feature ブランチで）
- 東海林さん確定事項（2026-08-26）:
  - 準備中箇所は「用意してから」展開する（隠して済ませない）
  - 緊急連絡先・パフォーマンス推移は別途展開の可能性 → **枠ごと「準備中」の予告表示**にして期待値を上げる
  - 通知音・音量は非表示。**パスワード変更機能は作らない**（ボタン削除）
  - 給与受取口座の表示は**銀行名・支店名まで**（番号・名義・種別は個人情報扱いで出さない）
  - マイナンバーは画面に**提出状況（提出済み／未提出）のみ**。番号は Root 側に貯めるが**画面にもAPIにも出さない**
  - 交通費は「申告された日額 × 出勤日数」で支給・**月の上限は個人ごと**（現行2万円・過去3万円の時期あり）
  - タブ構成（4タブ・全員表示）は現状のまま
- データの出どころ: Kintone アプリ**「従業員名簿　ヒュアラングループ」**（マイナンバー・交通費含む）。
  **取り込みは Claude の別作業**（トークン発行待ち）。この Dispatch は入れ物と表示まで。

---

## 1. 画面の変更（ProfileTab）

### 基本情報カード
- **マイナンバー** → 「提出済み」または「未提出」（番号は絶対に出さない）
- **交通費** → 「日額 ◯◯円（月の上限 ◯◯円）」。未登録なら「未登録」
- **給与受取口座** → 「◯◯銀行 ◯◯支店」のみ。未登録なら「未登録」
- 値が空のときにシステム用語や空白を出さない（「未登録」「記録なし」の日本語で）

### 緊急連絡先カード・パフォーマンス推移カード（枠ごと予告表示）
- ダミーの行やダミーの表は消し、**カード全体を「準備中」の予告デザイン**に:
  - 緊急連絡先: 「準備中 — 緊急連絡先の登録・確認がマイページでできるようになります」
  - パフォーマンス推移: 「準備中 — 架電数・有効率・順位の6ヶ月推移がここで見られるようになります」
- 見た目は既存カードに揃えつつ「もうすぐ来る機能」と分かるように（準備中バッジ等・文言は上記ベースでCodex調整可）

### 設定カード
- **丸ごと削除**（パスワード変更・通知音・音量すべて）

### 提出・登録情報カード
- **今回は触らない**（次の Codex-216 でモーダル送信化する）

## 2. データの入れ物（migration ファイル作成まで・適用はしない）

- `root_employees` に列追加:
  - `commute_daily_allowance integer`（交通費の申告日額・円）
  - `commute_monthly_cap integer`（交通費の月上限・円。入社時期で個人ごとに異なる）
- 新テーブル `root_employee_my_numbers`:
  - `employee_id`（root_employees への FK・PK）／`my_number text`／`submitted_at`／`created_at`／`updated_at`
  - **RLS: 全ロール拒否（サービスロールのみ）**。SELECT を許すポリシーを作らない
  - **番号を返す API・画面は一切作らない**。マイページが使うのは「行が存在するか」だけ
- migration の適用は Claude が行う（適用前に東海林さんへ一声のルール）。Codex はファイル作成と型対応まで

## 3. プロフィール受け渡しの拡張

- `MyPageProfile` に追加: `bankName` / `branchName` / `commuteDailyAllowance` / `commuteMonthlyCap` / `mynaSubmitted`
- 供給元は unlock API（/api/system/mypage/unlock）と生年月日未登録経路（page.tsx）の両方
- `mynaSubmitted` はサーバ側で `root_employee_my_numbers` の行の有無から判定（admin クライアント）
- **口座番号・名義・マイナンバー番号を API レスポンスに含めない**（テストで担保する）

## 4. 変えないこと

- タブ構成（4タブ・全員表示・並び）／4桁ゲート／3ヶ月定期確認
- 勤怠打刻・シフト・前確依頼タブ
- 提出・登録情報カードの中身（216で対応）

## 5. テスト

- 口座: 表示が「銀行 支店」のみで、口座番号・名義が**画面にもunlock応答にも現れない**
- マイナンバー: 提出済み／未提出の2態。番号がどこにも現れない
- 交通費: 値あり表示／未登録表示
- 設定カードが存在しない・通知音等の文言が消えている
- 緊急連絡先・パフォーマンスの予告カードが表示される
- 既存の mypage テストすべて緑

## 7.【差し戻し 2026-08-26・Claudeレビュー】実DBと食い違う3点の修正

初回実装（5b01ebf）は方針・画面・RLS設計は良いが、**実DBのスキーマと食い違い、このままマージすると全員のマイページが開けなくなる**。以下を修正すること。

1. **`root_employees` に `id` 列は存在しない**。主キーは **`employee_id`（text・例 "EMP-0009"）**（本番実測で
   `column root_employees.id does not exist` を確認。`supabase/migrations/20260813000004_system_attendance_punches.sql`
   冒頭にも「root_employees.employee_id must be the text primary key」と明記あり）。修正箇所:
   - `src/app/api/system/mypage/unlock/route.ts` の select「`id,`」→「`employee_id,`」
   - `src/app/system/mypage/page.tsx` の select 同上
   - `src/app/system/mypage/_lib/mypage-profile.server.ts` の `row.id` → `row.employee_id`
2. **migration の FK**: `references public.root_employees(id)` は適用時エラーになる。
   `employee_id text primary key references public.root_employees(employee_id) on delete cascade` に変更（uuid をやめる）
3. **テストのモックを実スキーマに合わせる**（`id` を持つ行をモックしない。`employee_id:"EMP-0009"` 形式で）。
   「SELECT列の検証」も employee_id 込みに更新

補足（変更不要の確認事項）:
- `bud_employee_bank_accounts.employee_id` は text 比較可を実測済み → 口座の取得元はこのままでよい
- 同テーブルは現在0件＝表示が「未登録」になるのは正しい（従業員名簿からの取り込みはClaude別作業）

## 6. 完了時にやること

1. `npx tsc --noEmit`・対象テストが緑（AppHeader.test の既存エラー1件は無関係）
2. **migration は適用しない**（Claudeが一声→適用→読み取り確認→実機の順で行う）
3. 完了報告を**コードブロックで**出力（変更ファイル、画面文言の一覧、migration内容、
   unlock応答に個人情報が乗らないことの担保方法、tsc/テスト結果、迷った点）

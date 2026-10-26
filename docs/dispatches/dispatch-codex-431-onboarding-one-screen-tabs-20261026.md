# Codex-431：入社手続きを 1 つの画面にまとめてタブで切り替える（2026-10-26）

## 目的（東海林さん 2026-10-26）
サイドバーの「入社手続き」を押すと本人用の入力画面（`/system/onboarding`）、事務の画面は別の URL（`/system/onboarding/admin`）で、行き来がボタン頼り。**1 つの画面にまとめ、1 タブ目＝本人の入社手続き、2 タブ目以降は権限が無い人には出さない**。1 タブ目の進捗バー（全○画面のうち○画面目）はいつも出しておく。
**権限は今のまま（決定＝A）**：入社予定者・入社後の確認＝全権管理者だけ／みんなの入社手続き＝責任者以上（`MANAGER_ROLES`）。権限を広げない。

## 画面の絵
```
System / 入社手続き
入社手続き                                         ← h1（サイドバーの名前と同じ）
 自分の入社手続き   入社予定者   入社後の確認   みんなの入社手続き
━━━━━━━━━━━──────────────────────────────── ← SystemTabs・線は右端まで
 ■■■□□□□□  全8画面のうち 3画面目              ← 1 タブ目だけ。スクロールしても画面の上に残る（position:sticky・ヘッダーの下）
 （今の本人の入力画面＝OnboardingClient をそのまま）

・トス／クローザー／一般社員など（責任者未満）：タブは「自分の入社手続き」1 つだけ（1 つだけでもタブの行は出してよいが、出さないほうが自然ならタブの行を出さない）
・責任者以上：自分の入社手続き／みんなの入社手続き
・全権管理者：4 つ全部
```

## やること
1. `src/app/system/onboarding/page.tsx` を 4 タブの画面にする。タブの中身：
   - 自分の入社手続き＝今の `OnboardingClient`（読み込み・エラー表示も今のまま）。進捗バー（`StepProgress`）を sticky に（スクロールしても上に残る。背景を付けて下の文字が透けない・明暗両方）。
   - 入社予定者／入社後の確認＝今の `HireCandidatesClient` の 2 タブ（`hireAdminContext` が通る人だけ）。
   - みんなの入社手続き＝今の `/system/onboarding/admin` の一覧（`onboardingAdminContext` が通る人だけ）。表の列・リンク・Clarity のマスクは今のまま。
   - 権限の判定はサーバーで行い、権限の無いタブは HTML にも出さない（中身のデータも読まない）。
   - 選んだタブは URL の `?tab=self|candidates|confirmations|all` に持つ（再読み込み・戻るで同じタブ）。権限の無いタブを URL で指定されたら「自分の入社手続き」を出す。
   - 今の `HireCandidatesClient` の中のタブ（入社予定者／入社後の確認／入社手続き）は、この 4 タブに統合して二重にしない。
2. `/system/onboarding/admin` を開いたら `/system/onboarding?tab=all`（全権管理者は `?tab=candidates`）へ移す（redirect）。1 人ぶんの詳細 `/system/onboarding/admin/[employeeId]` はそのまま残し、［戻る］・場所の表示のリンク先を `/system/onboarding?tab=all` に。
3. 消すボタン：［みんなの入社手続きを見る（事務）］［自分の入社手続きへ］。
4. ログイン直後に入社手続きへ飛ばす動き（`isOnboardingLoginTarget` 等）は `/system/onboarding` のままで変えない。
5. `src/lib/auth/permission-registry.ts` の入社手続きの項目の説明・パスを実態に合わせる（権限の中身は変えない）。
6. テスト：役職ごとに見えるタブ（トス＝1 つ／manager＝2 つ／super_admin＝4 つ）／権限の無いタブを URL で指定→自分の入社手続き／admin への redirect／進捗バーが出ている。

## 触らないもの
- `src/app/bud/bank/` 配下。本番・DB・API の権限。**git は触らないでください。コミットは人間側が行います。** npm install はしない。

## 確認
`npx tsc --noEmit`・`npx vitest run src/app/system/onboarding src/lib/auth`。日本語が「???」に化けていないこと。

## 完了報告（コードブロックで）
変更ファイル／テスト結果／気になった点。

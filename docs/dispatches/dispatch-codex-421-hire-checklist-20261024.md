# Codex-421：入社の確認表（入社済みの人の残りの作業を一覧で）（2026-10-24）

## 目的
設計書 C:\Claude\000_Garden\150_System_システム\02_入社手続き\004_設計_入社の流れの自動化_20261024.md の §3-3（順番 D）。
［出社を確認して入社にする］で入社済みになった人について、残りの作業（入社手続き・公式 LINE・MF 電子契約の書類・FileMaker のアカウント）を事務が一目で確認し、手作業の分は印を付けられるようにする。
置き場所は Codex-418 で作った「入社予定者」タブ（`src/app/system/onboarding/HireCandidatesClient.tsx`・super_admin のみ）。

## 画面の絵（入社予定者タブの表に「入社後の確認」列を足す。入社済みの行だけ）
```
入社日      氏名        状態              入社後の確認
2026-10-27  山田 太郎   入社済み（1571）  入社手続き：提出済み ／ 公式LINE：登録済み ／
                                          雇用契約書：□送った □締結済み ／ 秘密保持：□送った □締結済み ／
                                          緊急連絡先：□送った □締結済み ／ FileMaker：□追加済み
                                          （全部そろうと「完了」）
```
- 自動で決まるもの：入社手続き（`system_onboarding.status`＝未・入力中・提出済み）、公式 LINE（`root_employees.line_user_id` の有無）。
- 手で付けるもの（チェックボックス・押したらすぐ保存・楽観更新）：雇用契約書・秘密保持・緊急連絡先（MF 電子契約で「送った」「締結済み」の 2 段）、FileMaker のアカウント（追加済み）。誰がいつ付けたかも残す。
- 全部そろったら状態の横に「完了」。そろっていない入社済みの人が上に来るように並べる。

## やること
1. migration `supabase/migrations/20261024000004_system_hire_checklist.sql`：`system_hire_candidates` に `checklist jsonb not null default '{}'`（キー＝contract_sent・contract_signed・nda_sent・nda_signed・emergency_sent・emergency_signed・filemaker_added。値＝{ checked_at, checked_by }）。
2. API：`PATCH /api/system/hire-candidates/[id]` に `{ checklist: { key: boolean } }` を足す（super_admin のみ・キーは上の 7 つだけ・入社済みの行だけ）。一覧 GET は入社済みの行に onboarding の状態と LINE の有無を付けて返す（管理者側の接続で読む）。
3. 画面：上の「入社後の確認」列。
4. テスト：キーの制限・入社済み以外は 400・super_admin 以外 403・完了の判定・並び。

## 触らないもの
- `src/app/bud/bank/` 配下。本番 DB・Vercel・Kintone・KOT。**git は触らないでください。コミットは人間側が行います。**

## 確認
`npx tsc --noEmit` と変更範囲の `npx vitest run <対象>`。画面の文言に開発者用語を出さない。

## 完了報告（コードブロックで）
変更・追加ファイル／migration の要点／テスト結果／気になった点。

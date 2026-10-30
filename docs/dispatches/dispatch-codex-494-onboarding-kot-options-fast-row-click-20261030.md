# Codex-494 入社手続き：KING OF TIME の選択肢を速く出す・入社後の確認の表を行全体で押す（2026-10-30）

作業場所：C:\garden\a-bloom-008（main）
**git は触らない（add / commit / push / checkout / stash すべて禁止）。** ファイルを直すだけ。
社長スタイル §2.5 の型・§2.6 の点検に従う。

## 東海林さんの依頼（画面の言葉）
1. KING OF TIME の選択肢の読み込みを速くする
2. 入社後の確認の表は、行全体を押す形に直す

## 今の作り（原因）
1. `src/app/system/onboarding/_lib/hire-candidates.server.ts` の `candidateOptions`（`GET /api/system/hire-candidates/kot-options`）は、毎回 KING OF TIME に取りに行き（`fetchKotHireOptions`）、本番で **毎回 4.4〜4.6 秒** かかっている。控えの表 `system_kot_options_cache`（id="hire"）はあるが、KING OF TIME が読めないときにしか使っていない。画面（`HireCandidatesClient.tsx` 96 行目付近）は書ける人がタブを開くたびにこれを読む。
2. 同じファイルの `confirmationColumns` の最後に「操作」列（［確認する］ボタン）がある。行を押すと開く作り（`onRowClick`）はもうあるので、ボタンの列だけが決まり（表にボタンの列を置かない）に反している。

## やること

### A. KING OF TIME の選択肢は控えをすぐ返す
- `candidateOptions`：
  - 控え（`system_kot_options_cache` id="hire"）が**あれば、KING OF TIME を待たずに控えをすぐ返す**（法人の一覧は今どおり DB から）。
  - 控えの `updated_at` が **10 分より古ければ**、応答を返したあとに裏で KING OF TIME から取り直して控えを更新する（Next.js の `after()`（`next/server`）を使う。リポジトリ内の既存の使い方に合わせる）。取り直しに失敗しても何もしない（ログだけ）。KING OF TIME が止まる時間（8:30〜10:00・17:30〜18:30）は今の `fetchKotHireOptions` の動きに任せる。
  - 控えが**無いときだけ**、今どおりその場で KING OF TIME に取りに行き、控えを作ってから返す。
  - 返す形（`divisions`・`workingTypes`・`companies`・控えのときの `cached`）は今と同じ。画面側は変えなくてよい。
- 目標：2 回目以降は 0.5 秒以内に返る。

### B. 入社後の確認の表
- `confirmationColumns` の「操作」列（［確認する］）を消す。行を押すと今と同じ確認の小窓が開く（`onRowClick` はそのまま）。キーボードは共通の表の作り（Tab で行へ・Enter で開く）。
- 「入社予定者」の表（`columns` の「操作」列）は今回は触らない。

### C. テスト
- `hire-candidates.test.ts`：控えがあるときは KING OF TIME を呼ばずに返す／控えが 10 分より古いと裏で取り直す（after に渡ることを確かめる）／控えが無いときはその場で取りに行き控えを作る／取り直しの失敗で応答が壊れない。
- `HireCandidatesClient.test.tsx`：入社後の確認の表に［確認する］ボタンが無いこと・行を押すと小窓が開くこと。
- `npx tsc --noEmit` と `npx vitest run src/app/system/onboarding src/app/api/system/hire-candidates` が通ること。

## やらないこと
### 取り直し回数の見積もり（実装時追記）
- 定期実行は追加せず、選択肢を読むリクエスト時だけ判定する。アクセスがなければ 0 回/日。
- 更新成功後の控えを順に読む場合、10 分超ごとの更新で約 144 回/日以下。1 回につき KOT の所属・雇用区分の 2 API を読むので約 288 API 呼び出し/日以下（停止時間を考慮すると成功回数は減る）。
- 同時アクセス時は更新完了まで複数の取り直しが予約される可能性がある。停止中・更新失敗中は古い控えが残るため、再試行回数はその間の選択肢取得リクエスト数に依存する。この実装は 144 回/日の厳密な上限を設けない。

- 定期実行（cron）は足さない
- DB の表は作らない（控えの表は今のものを使う）
- git は触らない

## 終わったら
`docs/dispatches/report-codex-494-onboarding-kot-options-fast-row-click-20261030.md` に、直したファイル・テストの結果・迷った所を書く。

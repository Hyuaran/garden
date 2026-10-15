# Codex-381：前から落ちているテスト 2 ファイル（7 本）を直す（2026-10-15）

## やること
作業ツリー `C:\garden\a-bloom-008`（main）で、前から落ちている次の 7 本のテストを通るようにする。

- `src/app/_components/__tests__/KpiCard.test.tsx` > getVisibleKpiCards > returns all 4 for super_admin／returns all 4 for admin
- `src/components/shared/garden-view/__tests__/BackgroundCarousel.test.tsx` > keyboard shortcuts の 5 本（ArrowRight／ArrowLeft／Space／'1'〜'6'／'A'・'a'）

## 進め方
1. まず原因を切り分ける：テストが古い（本体の仕様が変わったのにテストが追いついていない）のか、本体の不具合なのか。`git log -p` で本体とテストの変更の経緯を見る。
2. テストが古いだけなら、今の本体の正しい振る舞いに合わせてテストを直す。本体の不具合なら本体を最小限で直す。どちらにしたか、理由を報告に書く。
3. 関係の無いファイルは触らない。特に `src/app/system/` と `src/lib/mail-payment-check/` と `scripts/innovera-backfill/`（別の作業が動いている）は読むのも不要。
4. 確認：`npx vitest run src/app/_components src/components/shared/garden-view` が全部通ること。最後に `npx vitest run` 全体と `npx tsc --noEmit -p .` を流して、新しく落ちたものが無いこと。

## 守ること
- **commit しない・push しない**（Claude が差分を確かめてからコミットする）
- 表示の文言を変える場合は、開発者用語を画面に書かない

## 報告（日本語・コードブロックで）
- 原因（ファイルごと）と、テスト／本体のどちらを直したか
- 変更したファイル
- テストの結果（対象・全体・型チェック）

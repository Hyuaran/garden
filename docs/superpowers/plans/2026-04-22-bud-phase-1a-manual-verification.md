# Phase 1a 手動動作確認手順

## 目的

`generateZenginCsv` が出力する CSV が、実際の銀行（楽天・みずほ・PayPay）の総合振込データ取込画面で**エラーなく受け付けられる**ことを確認する。

**実送金はしない**（画面上の取込チェックだけで、最終実行前の確認画面で中止）。

## 事前準備

1. Phase 1a の全テストが PASS している（`npm test` で緑）
2. 各銀行のネットバンキングにログインできる（担当: 東海林さん）

## サンプル CSV の生成

一時的な Node.js スクリプトで CSV を保存する:

```typescript
// temp/generate-sample.ts
import { writeFileSync } from "fs";
import { generateZenginCsv } from "../src/lib/zengin";
import {
  SAMPLE_SOURCE,
  SAMPLE_TRANSFERS,
} from "../src/lib/zengin/__tests__/fixtures/sample-transfers";

for (const bank of ["rakuten", "mizuho", "paypay"] as const) {
  const r = generateZenginCsv(SAMPLE_TRANSFERS, SAMPLE_SOURCE, { bank });
  writeFileSync(`temp/${r.filename}`, r.content);
  console.log(`Generated: temp/${r.filename}`);
}
```

実行: `npx tsx temp/generate-sample.ts`

## 楽天銀行 での取込確認

1. 楽天銀行ビジネスダイレクトにログイン
2. 「総合振込」→「データ受信（総振・一括取込）」メニュー
3. 「ファイルを選択」で `temp/zengin_YYYYMMDD_rakuten.csv` をアップロード
4. 画面にエラーが出ないことを確認（振込先・金額・合計件数・合計金額）
5. **中止**（実送金しない）
6. 確認結果をチームに共有

## みずほ銀行 での取込確認

1. みずほビジネスWEB にログイン
2. 「総合振込」→「データ送信」メニュー
3. ファイル `temp/zengin_YYYYMMDD_mizuho.txt` をアップロード
4. EOF マークが原因のエラーが出ないこと、レコード数表示が正しいことを確認
5. **中止**

## PayPay 銀行 での取込確認

1. PayPay 銀行法人アカウントにログイン
2. 「振込」→「総合振込」→「ファイル取込」メニュー
3. ファイル `temp/zengin_YYYYMMDD_paypay.csv` をアップロード
4. エラーが出ないことを確認
5. **中止**

## 結果記録

`docs/effort-tracking.md` の Phase 1a 行に以下を記入:

- 実績（d）: 実際にかかった日数
- 差分: 実績 - 見積（0.5d）
- Notes: 「3 銀行すべて取込成功」or 発生したエラーの修正内容

## エラー発生時の対応

| エラー例 | 対応 |
|---|---|
| 「レコード長が違う」 | `records/*.ts` のオフセット再確認、テスト追加 |
| 「文字コードエラー」 | `encoding.ts` の Shift-JIS 変換確認 |
| 「受取人名が読めない」 | `kana-converter.ts` の変換テーブル追加 |
| 「合計件数が合わない」 | `buildTrailerRecord` 引数の確認 |

対応後、必要に応じてテスト追加 + Task のコミットを追加。

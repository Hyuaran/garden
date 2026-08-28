# Codex-220 Root会社マスタの拡張（法人名簿の会社情報・番号類を全集約）

- 発行日: 2026-08-28
- 対象: `root_companies` の列追加 migration ＋ `/root/companies` の表示・編集拡張
- 作業ツリー: `C:\garden\a-bloom-008`（Codex-219 のブランチがマージされた後の `main` 最新 から feature ブランチで）
- 背景（東海林さん指示・2026-08-28）:
  - 会社に関する情報は**住所・代表者だけでなく、各種届出番号など全てを Root（Garden）へ集約**して一元管理する
  - 源泉データ: Kintone「法人名簿　ヒュアラングループ」。**データ投入は Claude が行う**ので、
    Codex の担当は「列の追加＋画面で見える・直せるようにする」まで
  - 表形式のデータ（金融機関情報・法人履歴・契約車・契約物件・サブスク）は**第2弾（今回スコープ外）**

## 1. root_companies への列追加（migration ファイル作成のみ・適用はClaude）

すべて NULL 許可で追加（既存データに影響しない）:

| 列名 | 型 | 中身 |
|---|---|---|
| fax | text | 法人FAX番号 |
| fiscal_end_month | integer | 決算月（1〜12） |
| invoice_registration_number | text | インボイス登録番号（T+13桁） |
| telecom_notification_number | text | 電気通信事業届出番号（E-XX-XXXXX） |
| employment_insurance_number | text | 雇用保険事業所番号 |
| labor_insurance_number | text | 労働保険番号 |
| tax_office | text | 管轄税務署 |
| agency_notification_number | text | 代理店届出番号（GXXXXXXX） |
| industry_classification | text | 産業分類番号（例 92-Q） |
| domain | text | メールドメイン |
| representative_gender | text | 代表者性別 |
| representative_birthday | date | 代表者生年月日 |
| representative_address | text | 代表者住所（「〒NNN-NNNN 住所」1本） |
| representative_mobile | text | 代表者携帯番号 |
| contact1_name / contact1_phone | text | 担当者1の氏名・電話 |
| contact2_name / contact2_phone | text | 担当者2の氏名・電話 |

- 既存列（company_name_kana / corporate_number / established_on / phone / representative_kana /
  website / default_bank / address / representative）は**そのまま使う**。重複列を作らない
- fiscal_end_month に CHECK (1〜12) を付ける

## 2. /root/companies の画面拡張

- **一覧は現状維持**（列を増やしすぎない。今の見え方を壊さない）
- **編集モーダルに新項目を追加**。項目が多いので見出しでグループ分け:
  - 基本: 既存項目＋FAX・決算月・ドメイン・Webサイト
  - 番号類: 法人番号・インボイス・電気通信・雇用保険・労働保険・代理店届出・産業分類・管轄税務署
  - 代表者: 氏名・カナ（既存）＋性別・生年月日・住所・携帯
  - 担当者: 担当者1/2の氏名・電話
- 保存は既存の更新経路（canWrite 権限・削除不可ポリシー）を踏襲
- 決算月は 1〜12 の選択（表示は「3月」のように月表記）
- 画面文言に開発者用語を出さない（migration 等の語を出さない）

## 3. 変えないこと

- company_id の体系・既存列の意味・法人の追加/無効化の挙動
- 他画面（Bud の bud_corporations との統合は**しない**。今回は Root 側の拡張のみ）
- Kintone との自動同期は作らない（投入は Claude が手動スクリプトで行う）

## 4. テスト

- migration ファイルに全列が含まれること（218までの migration テストの流儀）
- 編集モーダル: 新項目の入力→保存で PATCH に載る・decimal/date の型崩れがない
- fiscal_end_month の範囲外（0/13）が保存できないこと
- 既存の root 系テストが緑のまま

## 5. 完了時にやること

1. `npx tsc --noEmit`・対象テストが緑
2. migration 適用・データ投入・実機確認は行わない（Claude 側）
3. 完了報告を**コードブロックで**出力（変更ファイル・migration DDL・モーダルの構成・tsc/テスト結果）

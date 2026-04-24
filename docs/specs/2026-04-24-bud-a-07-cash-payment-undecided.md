# Bud A-07: 手渡し現金支給 未決事項整理

- 対象: 給与を銀行振込ではなく**現金手渡し**で受取る従業員の扱い
- 見積: **0.25d**（約 2 時間、主に業務ヒアリング + 合意形成）
- 担当セッション: a-bud（**本 spec は東海林さん + 経理担当との合意を経て確定する下敷き**）
- 作成: 2026-04-24（a-auto / Phase A 先行 batch5 #A-07）
- 元資料: Bud CLAUDE.md「⚠️ 未決事項（Phase 3 着手前に東海林と方針決定）」, `05_Garden-Bud/未決事項_20260419.md`

---

## 1. 目的とスコープ

### 目的
Bud CLAUDE.md で**未決事項として明記されている**「手渡し現金支給」の業務フローを**論点整理 + 選択肢列挙 + 推定スタンス**で構造化し、Phase 3 着手前に東海林さんと合意可能な状態にする。

### 含める
- 5 論点の整理（識別 / bud_transfers 扱い / 明細配信 / 現金原資 / 受領確認）
- 各論点の選択肢とトレードオフ
- auto の推奨スタンス
- 合意後のデータモデル変更差分

### 含めない
- 合意そのもの（東海林さんの判断待ち）
- 実装（合意後の別 spec）
- 業務委託向け個別 Excel 処理（Bud スコープ外と明記）

---

## 2. 既存実装との関係

### Phase 0 既存
- `root_employees` マスタ（給与振込口座等を保持）
- `bud_transfers`（振込レコード）
- 未だ給与処理モジュール自体が実装されていない（Phase B で着手予定）

### 本 spec の位置づけ
- **未決事項**を整理する下敷きドキュメント
- 合意事項は別 spec（Phase B の給与処理仕様書）に移植

---

## 3. 論点と選択肢

### 論点 1: 手渡し受給者の識別方法

| 選択肢 | 内容 | Pros | Cons |
|---|---|---|---|
| A | `root_employees.payment_method` カラム追加 | マスタ集約、複数モジュールで参照可 | マスタ変更の管理負荷 |
| B | `bud_salary_config` テーブル新設、従業員別設定 | Bud 内完結 | 参照粒度が Bud 限定 |
| C | `bud_transfers.transfer_type = '給与(手渡し)'` で区別 | 既存型の拡張のみ | 設定情報が振込レコードにしか残らない |

**auto 推奨**: **A 案**（`root_employees.payment_method` カラム追加）
- 理由: MF クラウド給与との連携でも必要になる情報、マスタ側で管理するのが自然
- ENUM: `'bank_transfer' | 'cash' | 'other'`（デフォルト 'bank_transfer'）

### 論点 2: `bud_transfers` への扱い

| 選択肢 | 内容 | Pros | Cons |
|---|---|---|---|
| A | 登録しない（現金は振込ではない）| データ単純 | 給与明細配信と分離、月次集計漏れ |
| B | 種別付きで登録（`transfer_type='給与(手渡し)'`）| 集計一元化 | 振込 CSV 出力対象から除外ロジック必要 |
| C | 別テーブル `bud_cash_payments` | 完全分離 | テーブル数増、集計時に JOIN |

**auto 推奨**: **B 案**（種別付きで登録）
- 理由: 給与計算ロジック・明細配信を共通化、CSV 出力時に `transfer_type != '給与(手渡し)'` でフィルタ
- `bud_transfers.transfer_type` enum に `'給与(手渡し)'` を追加

### 論点 3: 給与明細の配信（Garden-Tree 側）

| 選択肢 | 内容 |
|---|---|
| A | **全員**（銀行振込も手渡しも）Garden-Tree マイページで閲覧可 |
| B | 手渡し受給者のみ、別ルートで PDF メール |
| C | 手渡し受給者は明細配信なし（紙で手渡し時に同梱）|

**auto 推奨**: **A 案**（全員 Garden-Tree 閲覧可）
- 理由: 配信元を一本化、従業員にとっての UX 統一、紙印刷コスト削減
- Tree マイページ機能（Phase D 予定）で明細閲覧を実装（Bud からの PDF 生成 or HTML 表示）

### 論点 4: 現金原資の管理

| 選択肢 | 内容 | Pros | Cons |
|---|---|---|---|
| A | ATM 引出し分を `bud_statements` の出金として記録、費目 '現金原資' | 透明性 | 引出担当・タイミング定義必要 |
| B | 現金原資は経理担当の手元現金として Bud 外管理 | 手軽 | 監査で追跡困難 |
| C | 前月末に **次月必要額を予算化**、実績と突合 | 予算管理可能 | 予算画面が必要 |

**auto 推奨**: **A + C の併用**
- A: `bud_statements.category='現金原資引出'` で記録（自動照合時に ATM 出金はこのカテゴリで既定）
- C: 月次集計画面で「給与(手渡し)合計」と「現金原資引出合計」を比較表示（Phase B）

### 論点 5: 受領確認

| 選択肢 | 内容 |
|---|---|
| A | 紙の受領書（押印 or 署名）を手渡し時に徴求、スキャンして `bud_transfers.attachment_storage_path` に格納 |
| B | Garden-Tree マイページで「受領確認」ボタン（本人が押下）|
| C | 経理担当が「渡した」フラグを入れるだけ（受領側の確認なし）|

**auto 推奨**: **A + B の併用**
- A: 監査対応（税務調査時に物理証拠）
- B: 従業員側の記録、トラブル時の二重防御

### 未確認事項（東海林さんに要ヒアリング）

| # | 未確認 | a-auto の推測 |
|---|---|---|
| U1 | 現在何名が手渡しか | 1〜3 名（小規模）と想定、確定要 |
| U2 | どの法人の誰か | 法人単位で集中していない想定、ランダムの可能性 |
| U3 | 現金原資の引出しルール（担当・金額予測・タイミング）| 月末に経理担当が ATM で引出と推測、実運用確認要 |
| U4 | MF クラウド給与での計算対象か | 業務委託は対象外とされているので、手渡し **正社員** は MF 計算対象と推測 |
| U5 | 給与日（手渡し日）が振込日と同じか別か | 同日想定、ズレがある場合は別運用 |

---

## 4. データモデル提案（合意後の変更差分）

### 4.1 `root_employees` 追加カラム
```sql
ALTER TABLE root_employees
  ADD COLUMN payment_method text NOT NULL DEFAULT 'bank_transfer'
    CHECK (payment_method IN ('bank_transfer', 'cash', 'other'));
```

### 4.2 `bud_transfers.transfer_type` enum 拡張
```sql
-- 現状: TransferType = '給与' | '外注費' | '経費精算' | 'その他'
-- 追加: '給与(手渡し)'

-- CHECK 制約更新
ALTER TABLE bud_transfers DROP CONSTRAINT bud_transfers_transfer_type_check;
ALTER TABLE bud_transfers ADD CONSTRAINT bud_transfers_transfer_type_check
  CHECK (transfer_type IN ('給与', '給与(手渡し)', '外注費', '経費精算', 'その他'));
```

### 4.3 `bud_statements` カテゴリ定数（A-06 との連携）
```sql
-- category で '現金原資引出' を予約カテゴリに
-- A-06 §4.1 の bud_statements.category の運用に追加
```

### 4.4 受領確認テーブル（任意、論点 5 で A/B 併用採用時）
```sql
CREATE TABLE bud_cash_payment_receipts (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id          uuid NOT NULL REFERENCES bud_transfers(id) ON DELETE CASCADE,
  receipt_method       text CHECK (receipt_method IN ('paper', 'app', 'both')),
  paper_storage_path   text,                  -- A 案のスキャン
  app_confirmed_at     timestamptz,            -- B 案のボタン押下時刻
  app_confirmed_by     uuid REFERENCES auth.users(id),
  notes                text,
  created_at           timestamptz NOT NULL DEFAULT now()
);
```

---

## 5. API / Server Action 契約

本 spec は**未決事項整理**のため具体 API は未定。合意後の別 spec で定義。参考スケッチ：
- `setEmployeePaymentMethod(employeeId, method)` — admin 権限
- `markCashPaymentReceived(transferId, receiptInput)` — 経理担当 + 本人

---

## 6. 状態遷移

手渡し給与も振込管理の 6 段階遷移（A-03）に準拠するが、以下の差異：
- 「CSV出力済み」→「振込完了」: 銀行 CSV 経由ではなく「経理担当が手渡し」で admin が手動マーク
- `bud_cash_payment_receipts` が作成されたら自動的に「振込完了」へ遷移

---

## 7. Chatwork 通知

- **給与支給日前日**: 手渡し対象者リストを admin に送信（「明日の手渡し: X 名合計 Y 円」）
- **ATM 引出し通知**: 任意（現状は運用でカバー）

---

## 8. 監査ログ要件

- `root_employees.payment_method` 変更は `root_audit_log` に必ず記録（給与計算に直結する情報のため）
- `bud_cash_payment_receipts.paper_storage_path` は**削除禁止**（税務調査対応）

---

## 9. バリデーション規則

| # | ルール |
|---|---|
| V1 | `payment_method='cash'` の従業員のみ `bud_cash_payment_receipts` 作成可 |
| V2 | 受領書（paper）は PDF/JPG/PNG のみ |
| V3 | 受領確認が 1 度で完結（重複登録禁止、UNIQUE 制約）|
| V4 | ATM 引出し額が給与合計より不足していたら警告 |

---

## 10. 受入基準（本 spec は「合意完了」が基準）

1. ✅ 論点 1〜5 すべてで東海林さんの採択案が決定
2. ✅ 未確認事項 U1〜U5 の回答が得られる
3. ✅ 採択案に基づいた spec（Phase B 給与処理設計書の一部）が起草される
4. ✅ `root_employees.payment_method` カラム追加 migration が Root チームに共有
5. ✅ `bud_transfers.transfer_type` への `'給与(手渡し)'` 追加が合意

**合意に至らない論点は引き続き本 spec §12 に残す**。

---

## 11. 想定工数（内訳）

| # | 作業 | 工数 |
|---|---|---|
| W1 | 東海林さん + 経理担当へのヒアリング | 0.1d |
| W2 | 5 論点の採択案合意（ミーティング）| 0.1d |
| W3 | 採択案を Phase B 給与処理 spec に移植 | 0.05d |
| **合計** | | **0.25d** |

※ 実装工数は含まない（Phase B で別計算）

---

## 12. 判断保留（すべて東海林さん判断）

| # | 論点 | 選択肢 | a-auto 推奨 |
|---|---|---|---|
| 判1 | 論点 1: 識別方法 | A (root マスタ) / B (bud_salary_config) / C (transfer_type) | **A** |
| 判2 | 論点 2: bud_transfers 扱い | A (登録しない) / B (種別付き) / C (別テーブル) | **B** |
| 判3 | 論点 3: 明細配信 | A (全員 Tree) / B (手渡しは PDF メール) / C (配信なし) | **A** |
| 判4 | 論点 4: 現金原資管理 | A (bud_statements記録) / B (外管理) / C (予算化) | **A + C 併用** |
| 判5 | 論点 5: 受領確認 | A (紙) / B (アプリ) / C (経理のみ) | **A + B 併用** |
| 判6 | 未確認 U1: 手渡し受給者数 | — | ヒアリング |
| 判7 | 未確認 U2: 法人分布 | — | ヒアリング |
| 判8 | 未確認 U3: 現金引出ルール | — | ヒアリング |
| 判9 | 未確認 U4: MF 計算対象 | — | ヒアリング |
| 判10 | 未確認 U5: 給与日の同期 | — | ヒアリング |
| 判11 | 本 spec の Phase B 取込時期 | Phase B-1（M3）or Phase B-2（M4）| **Phase B-1** 推奨（給与計算の前提）|

---

## 13. ヒアリング用質問リスト（東海林さん向け）

1. 現在、手渡しで給与を受取っている従業員は何人ですか？
2. 法人はどこに集中していますか（ヒュアラン・センターライズ等）？
3. 現金の原資は誰がいつどのように引き出しますか？
4. MF クラウド給与で計算対象に含めていますか？
5. 給与の「渡す日」と一般従業員の振込予定日は同じですか？
6. 受領書は現在紙でやり取りしていますか、それとも無し？
7. 税務調査時、手渡し給与はどのように説明・証明していますか？
8. 今後の方針として、手渡しを減らしたい意向はありますか？

— end of A-07 spec —

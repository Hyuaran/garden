# Forest Phase B 着手前メモ（前提条件・確定事項）

> Forest モジュール Phase B 着手前に確認すべき確定事項・前提条件を集約。  
> 横断調整セッション（a-main）で承認済の判断のみを記載し、設計の単一情報源とする。

---

## 1. fiscal_periods は Garden 内 master、Kintone App 85 はアーカイブ取込元（2026-04-26 確定）

### 1.1 確定内容

| 項目 | 確定 |
|---|---|
| Forest 既存 `fiscal_periods` テーブル | **Garden 内 master**（変更なし、既存設計のまま継続） |
| Kintone App 85（決算書 ヒュアラングループ、28 fields） | **移行元アーカイブ**（読込専用、書込先ではない） |
| Forest 既存設計への影響 | **なし**（migration spec に Kintone 取込ロジックのみ追加予定） |

### 1.2 出典

- 確定ログ: `C:\garden\_shared\decisions\decisions-kintone-batch-20260426-a-main-006.md` §2.4 #21
- 関連 memory:
  - `project_forest_files_in_google_drive.md`
  - `feedback_kintone_app_reference_format.md`
- 承認: 2026-04-26、東海林さん即決承認、a-main 006 セッション
- 影響度: 🟢 低（Forest 既存設計の追認、変更なし）

### 1.3 設計上の意味

Forest の財務関連スキーマは以下 2 階層で運用：

| 階層 | テーブル | 用途 | 由来 |
|---|---|---|---|
| Master | `fiscal_periods` | 確定決算期（ki / yr / uriage / 純資産 等） | Garden 内 master、既存運用 |
| Master | `shinkouki` | 進行期（暫定値、reflected note） | 同上 |
| Master | `forest_hankanhi`（T-F10 で追加） | 販管費内訳 8 項目 | 同上 |
| Master | `forest_nouzei_*`（T-F4/T-F11 で追加） | 納税スケジュール | 同上 |
| Master | `forest_tax_files`（T-F5 で追加） | 税理士連携ファイルメタ | 同上 |
| Archive | Kintone App 85 | 過去決算書履歴 | 移行元、Phase B 取込時のみ参照 |

### 1.4 Phase B での具体的アクション

#### 含まれる
- App 85 → `fiscal_periods` の **片方向取込ロジック**（spec として整備、別 migration spec で起草）
- 取込時のフィールドマッピング表（App 85 28 fields → fiscal_periods 既存列）
- 重複検出ロジック（`(company_id, ki)` UNIQUE 制約に依存）
- 取込履歴ログ（`forest_kintone_import_log` 等の新テーブルは Phase B 着手時に判断）

#### 含まれない（既存設計通り）
- `fiscal_periods` のスキーマ変更（列追加・型変更・FK 変更）
- App 85 への書込（Kintone 側へのフィードバックは無し）
- 双方向同期（master は Garden 側、Kintone は read-only archive）

### 1.5 現状の TypeScript 型定義（参考）

```ts
// src/app/forest/_constants/companies.ts より引用（既存、変更不要）
export type FiscalPeriod = {
  id: number;
  company_id: string;
  ki: number;
  yr: number;
  period_from: string;
  period_to: string;
  uriage: number | null;
  gaichuhi: number | null;
  rieki: number | null;
  junshisan: number | null;
  genkin: number | null;
  yokin: number | null;
  doc_url: string | null;
};
```

App 85 取込ロジックは上記列に対する片方向 mapping を行うのみ。型変更は行わない。

---

## 2. Storage 戦略（ハイブリッド、2026-04-25 確定）

### 2.1 確定内容

| 段階 | 戦略 | 状態 |
|---|---|---|
| 第 1 段階（即実行） | 候補 1: 東海林さん手動アップロード（Supabase Storage `forest-tax/` バケット） | T-F5 閲覧 PR #64 で対応済 |
| 第 2 段階（後日整備） | 候補 2: Google Drive API batch スクリプト | Phase B Storage 統合バッチで整備 |
| 不採用 | 候補 3: 並行運用（Storage と Drive 両方参照可） | 二重管理回避のため不採用 |

### 2.2 出典

- 確定: 2026-04-25、東海林さん回答、a-main 経由
- 関連 PR: #64（T-F5 閲覧、レビュー待ち）

### 2.3 Phase B での Storage 拡張範囲

- T-F6 (Download Section + ZIP) で `forest-docs` / `forest-downloads` バケット追加
- 既存決算書 PDF (Drive 保管) を `forest-docs` へ手動 / API batch 移行
- ZIP は Edge ではなく **Node ランタイム**確定（Edge 4.5MB 上限のため）

---

## 3. Phase B 着手前チェックリスト

Phase B 開始時、下記が完了していることを確認すること：

### Phase A 完了確認
- [ ] PR #49 (T-F7-01 InfoTooltip) merged
- [ ] PR #50 (T-F4 Tax Calendar + T-F11 Detail Modal) merged
- [ ] PR #56 (T-F9/T-F8 audit) merged
- [ ] PR #62 (T-F9 採用差分実装) merged
- [ ] PR #64 (T-F5 閲覧) merged
- [ ] T-F6 着手判断項目（ZIP TTL / ファイル名規則 等）確定

### 東海林さん手動タスク確認
- [ ] migration SQL 適用（`forest_tax_files` 等、本番 Supabase）
- [ ] bucket 物理作成 (`forest-tax`、Dashboard で 50MB private)
- [ ] 既存 PDF / Excel 手動アップロード（候補 1 戦略）

### Kintone 取込前確認（本ドキュメント §1）
- [ ] App 85 → fiscal_periods のフィールドマッピング表確定
- [ ] 取込スクリプトの dry-run（重複検出 + 差分確認）
- [ ] 取込履歴ログテーブル設計（必要時）

### Storage 戦略確認（本ドキュメント §2）
- [ ] T-F6 Storage 統合 spec 起草（forest-docs / forest-downloads）
- [ ] Drive API batch 設計（候補 2、Phase B 整備）
- [ ] Edge / Node ランタイム選定（Node 確定済）

---

## 4. 改訂履歴

- 2026-04-26：初版作成。a-main 006 で東海林さんから即決承認を受けた Kintone batch 32 件のうち、Forest 担当 #21（fiscal_periods master 確定）を反映。

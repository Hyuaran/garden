# Leaf 他商材 #10: 既存商材データ移行戦略

- 対象: Leaf 全商材（関電含む）の既存システムからの移行方針
- 優先度: **🟡 中**（Phase C 各商材展開時の必須プロセス）
- 見積: **0.1d**
- 担当セッション: a-leaf + a-main
- 作成: 2026-04-25（a-auto 002 / Batch 12 Leaf 他商材 #10）
- 前提:
  - `spec-leaf-others-00`〜`-03`（本 Batch の他 spec）
  - Phase B での Bud 既存データ移行ノウハウ

---

## 1. 目的とスコープ

### 目的

各商材を Garden Leaf に移行する際、**既存データの取扱方針を統一**し、移行リスクを最小化する。

### 含める

- 既存データソース別の移行難度評価
- 移行戦略 4 種の説明
- 商材ごとの推奨戦略マッピング
- データ整合性検証
- 並行運用期間の運用ルール

### 含めない

- 個別商材の詳細移行手順（各商材実装時に作成）
- DB スキーマ設計（各商材 spec 参照）

---

## 2. 既存データソース別の難度

### 2.1 ソース 4 分類

| ソース | 難度 | 自動化可否 | 例 |
|---|---|---|---|
| FileMaker | 🟡 中 | 半自動 | Tree FM、Bud 一部、Leaf 関電 旧 |
| Excel / CSV | 🟢 低 | ほぼ自動 | スタッフ管理用エクセル |
| 紙台帳 / TimeTree | 🔴 高 | 手入力 | 紙書類、TimeTree カレンダー |
| 他社 SaaS | 🟡 中 | API 依存 | 業者ポータル、CRM SaaS |

### 2.2 ソース別の特徴

#### FileMaker
- ODBC 経由でアクセス可
- スキーマと Garden の対応関係を SQL マッピング
- Python スクリプトで一括移行（Tree 移行で実績）

#### Excel / CSV
- Garden 側に CSV import UI を提供
- ヘッダーマッピング画面（admin+ 操作）
- バリデーションエラー時は行単位スキップ + ログ

#### 紙台帳 / TimeTree
- **自動化不可、手入力必須**
- 移行担当者の工数大
- 段階的移行（古いデータは保留、新規のみ Garden 入力）

#### 他社 SaaS
- 業者の API 開放状況による
- CSV エクスポート機能があれば Excel 経由
- API 直接連携は Phase D 以降

---

## 3. 移行戦略 4 種

### 3.1 Strategy A: 一括移行（Big Bang）

```
[既存システム]   [Garden]
      ↓
   旧停止 → 全データ移行 → 新運用開始
```

- メリット: シンプル、並行運用なし
- デメリット: 移行失敗時の業務停止リスク
- 適用: データ量小（< 1000 件）、シンプルな商材

### 3.2 Strategy B: 段階移行（Phased）

```
[既存システム]   [Garden]
      ↓             ↑
  既存維持     新規データのみ投入
                    ↓
              一定期間後、旧データ移行
```

- メリット: リスク分散、新規業務から徐々に Garden 化
- デメリット: 一定期間 2 システム並行運用
- 適用: データ量中、移行しても業務影響少

### 3.3 Strategy C: 並行運用（Parallel）

```
[既存システム]   [Garden]
      ↑             ↑
  両方記録    両方記録（リアルタイム同期）
      ↓             ↓
  比較検証 → 一致したら旧停止
```

- メリット: データ整合性の最高保証
- デメリット: スタッフの二重入力負担
- 適用: ミッションクリティカル業務（Tree、Bud 月次）

### 3.4 Strategy D: 紙ベース廃止のみ（New System Only）

```
[既存紙台帳]     [Garden]
      ↓             ↑
   過去保管      新規のみ Garden
                    ↓
                  古いデータは紙アーカイブ
```

- メリット: 移行コストゼロ
- デメリット: 過去データへのアクセスが紙のみ
- 適用: 紙台帳・古いデータ参照頻度低の商材

---

## 4. 商材別の推奨戦略

### 4.1 関電業務委託（001_kanden）

- 既存: FileMaker 11
- 推奨: **Strategy C（並行運用）** + Strategy B 部分採用
  - Phase C-1 で並行運用 2 週間
  - 並行運用期間後に旧停止 + Garden 単独運用
- 既に Batch 8 で実装済方針

### 4.2 光回線（002_hikari）

- 既存: 業者ポータル + 営業 Excel + 紙
- 推奨: **Strategy B**（段階移行）
  - 新規申込から Garden 入力
  - 過去データは Excel 取込（オプション）
  - 紙台帳は廃止対象、保管のみ

### 4.3 クレジットカード（010_credit）

- 既存: カード会社ポータル + 紙
- 推奨: **Strategy D + B**（紙廃止 + 新規 Garden）
  - 過去申込は紙保管継続（個情法、5 年保存）
  - 新規申込から Garden 必須
  - 移行はしない（カード会社管轄データを Garden 化しない）

### 4.4 水サーバー（020_water）

- 既存: Excel 中心
- 推奨: **Strategy B**
  - Excel 取込 UI で過去データ移行（任意）
  - 新規は Garden 入力

### 4.5 太陽光（030_solar）

- 既存: TimeTree + 紙
- 推奨: **Strategy D**（紙廃止のみ）
  - 過去案件は紙保管のみ、Garden に移行しない
  - 新規から Garden 必須

### 4.6 モバイル（040_mobile_carrier / mvno）

- 既存: キャリアポータル + Excel
- 推奨: **Strategy B**
  - Excel エクスポート → Garden import
  - 新規は Garden 入力

### 4.7 保険（050_insurance_*）

- 既存: 保険会社ポータル + 紙
- 推奨: **Strategy D**（紙廃止のみ）
  - 過去契約は紙保管継続（保険業法 10 年保存）
  - 新規のみ Garden

### 4.8 エコ商材（060_eco）

- 既存: Excel + 紙
- 推奨: **Strategy B**
  - Excel 取込 + 新規 Garden

---

## 5. 並行運用期間の運用ルール

### 5.1 期間設定

| 商材種別 | 並行運用期間 | 旧停止判断 |
|---|---|---|
| ミッションクリティカル（関電・Tree）| 1-2 週間 | 整合性 99.5% 超 |
| 通常業務 | 1 週間 | 整合性 99% 超 |
| 補助業務 | 並行運用なし | 即切替 |

### 5.2 整合性検証

- 日次バッチで両システム比較
- 件数 / 金額 / 主要日付 の差分チェック
- 差分 > 0.5% で Chatwork アラート + 担当者確認

### 5.3 二重入力の負担軽減

- スタッフへの説明・トレーニング
- 並行運用期間は **明確に通告**（「9 月末まで両方入力、10 月から Garden のみ」等）
- 短くする努力（理想は 1 週間以内）

---

## 6. CSV import UI の標準仕様

### 6.1 共通機能

- ファイル選択（.csv, .xlsx, .xls）
- ヘッダー自動検出 + マッピング画面
- バリデーション結果プレビュー（エラー行ハイライト）
- インポート実行 + 結果サマリ
- ロールバック（直近 import の取消）

### 6.2 配置

- `src/components/shared/CsvImporter.tsx` 共通コンポーネント
- 各 Leaf 商材で利用

### 6.3 マッピング保存

- マッピング設定を商材ごと localStorage 保存
- 再 import 時に同じマッピング自動適用

---

## 7. データ整合性検証ツール

### 7.1 比較スクリプト

```python
# scripts/migration/compare_kanden.py
import psycopg2  # FileMaker ODBC 経由
import supabase

def compare(fm_data, garden_data):
    fm_keys = {row['case_number'] for row in fm_data}
    g_keys = {row['case_number'] for row in garden_data}

    only_in_fm = fm_keys - g_keys
    only_in_garden = g_keys - fm_keys
    in_both = fm_keys & g_keys

    # 共通レコードの差分検証
    diffs = []
    for key in in_both:
        fm = next(r for r in fm_data if r['case_number'] == key)
        g = next(r for r in garden_data if r['case_number'] == key)
        if fm['status'] != g['status'] or fm['amount'] != g['amount']:
            diffs.append({key, fm, g})

    return { only_in_fm, only_in_garden, diffs }
```

### 7.2 結果出力

- CSV ファイル: `migration-compare-{module}-{yyyymmdd}.csv`
- Chatwork 通知: 差分件数のサマリ（admin DM）

---

## 8. 移行スケジュール（Phase C-D）

### 8.1 Phase C 内（M3-M5）

| 月 | 移行対象 | 戦略 |
|---|---|---|
| M3 後半 | 020_water | Strategy B |
| M4 前半 | 040_mvno | Strategy B |
| M4 後半 | 040_mobile_carrier | Strategy B |
| M5 前半 | 060_eco | Strategy B |

### 8.2 Phase D（M6-M8）

| 月 | 移行対象 | 戦略 |
|---|---|---|
| M6 | 030_solar | Strategy D |
| M7-M8 | 010_credit | Strategy D + B |
| M7-M8 | 050_insurance | Strategy D |

---

## 9. 注意点・トラブル対策

### 9.1 移行中のデータ齟齬

- 二重入力の取り扱いルール：**Garden 優先**（新システム）
- 矛盾時は admin が手動解決

### 9.2 スタッフ教育

- 各商材の移行前に 1 時間程度のトレーニング
- マニュアル PDF 配布
- Chatwork での質疑応答チャンネル

### 9.3 ロールバック計画

- 移行直後 1 週間は旧データを残す（削除しない）
- Garden 大障害時は旧システム再活性化（手順書）

---

## 10. 判断保留事項

- **判1: 過去データの保存期間**
  - 商材ごと法令準拠 / 一律 7 年
  - **推定スタンス**: 法令準拠（保険 10 年、税務 7 年、その他 5 年）
- **判2: CSV import UI の実装時期**
  - 各商材別 / 共通コンポーネント
  - **推定スタンス**: 共通コンポーネント `src/components/shared/CsvImporter.tsx`、Phase 1 から実装
- **判3: 並行運用期間の最大上限**
  - 1 ヶ月 / 3 ヶ月 / 半年
  - **推定スタンス**: 最長 1 ヶ月、それ以上は計画変更検討
- **判4: 紙データの廃止判断**
  - 全商材廃止 / 法令で必要な分のみ保管
  - **推定スタンス**: 法令準拠（保険・クレカは紙保管継続）
- **判5: 移行担当者の確保**
  - 既存スタッフ / 一時雇用 / 業者
  - **推定スタンス**: 既存スタッフ（業務知識保有）+ a-auto 移行スクリプト支援
- **判6: 移行失敗時の対応**
  - 旧システム継続 / 緊急修正 / 業者依頼
  - **推定スタンス**: 旧システム継続 + admin 手動修正、業者依頼は最終手段

---

— spec-leaf-others-10 end —

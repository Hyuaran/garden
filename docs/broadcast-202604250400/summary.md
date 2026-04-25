# Batch 12 Leaf 他商材スケルトン 全体サマリ

- 発動: 2026-04-25 03:10 頃 / a-auto 002 セッション就寝前モード継続
- 完了: 2026-04-25 約 04:00
- ブランチ: `feature/leaf-others-skeleton-batch12-auto`（develop 派生）
- 対象: Garden-Leaf 関電以外の他商材（Phase C 展開準備、軽量バッチ）

---

## 🎯 成果物

| 優先度 | # | ファイル | 行 | 見積 |
|---|---|---|---|---|
| 🔴 最高 | 1 | [#00 template-pattern](../specs/2026-04-25-leaf-others-00-template-pattern.md) | 417 | 0.3d |
| 🟡 中 | 2 | [#01 hikari-skeleton](../specs/2026-04-25-leaf-others-01-hikari-skeleton.md) | 344 | 0.2d |
| 🟡 中 | 3 | [#02 credit-card-skeleton](../specs/2026-04-25-leaf-others-02-credit-card-skeleton.md) | 340 | 0.2d |
| 🟡 中 | 4 | [#03 other-options-inventory](../specs/2026-04-25-leaf-others-03-other-options-inventory.md) | 305 | 0.2d |
| 🟡 中 | 5 | [#10 migration-strategy](../specs/2026-04-25-leaf-others-10-migration-strategy.md) | 335 | 0.1d |

**合計**: **1,741 行**、実装見積 **1.0d**（spec 起草想定どおり）

> Batch 12 起草時見込 1.0d → 実見積 1.0d（ピタリ）。軽量バッチで判断少なく順調完走。

---

## 🔑 各 spec の核心

### #00 Template Pattern 🔴
- Batch 8 関電パターンの **汎用化テンプレ**
- 6 spec 構成（schema / backoffice / input / batch / chatwork / test）の標準化
- 商材固有 vs 横断汎用の分類表
- 商材 ID 命名規則（001_kanden / 002_hikari / 010_credit 等）
- 7 ステップ標準手順（リサーチ → spec 草稿 → 実装 → 展開）

### #01 光回線 Skeleton 🟡
- NURO / au / SoftBank 等の業者複数対応
- 関電との差異: 工事日管理 / 業者ごと API 差 / クーリングオフ
- ステータス 7 段階暫定案
- ⭐ 東海林さん再ヒアリング必須項目 8 件

### #02 クレカ Skeleton 🟡
- イオン / 楽天 / エポス / 三井住友等
- 関電との差異: **金融商材**、与信プロセス、個人信用情報
- ステータス 9 段階暫定案
- カード番号フル保存禁止（PCI DSS）、マイナンバー暗号化
- 法令: 割賦販売法 + 個情法 + 犯収法

### #03 Other Options Inventory 🟡
- 7 候補商材の棚卸し（水サーバー / 太陽光 / モバイル / MVNO / 保険 / エコ）
- 実績規模 × 実装難度マトリクス
- 推奨展開順: 020_water → 040_mvno → 040_mobile → 060_eco → 030_solar → 010_credit → 050_insurance
- 法令厳格度評価（保険 🔴🔴 が最厳格）

### #10 Migration Strategy 🟡
- 移行戦略 4 種（Big Bang / Phased / Parallel / New System Only）
- 既存ソース 4 分類（FileMaker / Excel / 紙 / SaaS）
- 商材別の推奨戦略マッピング
- 並行運用期間（1-2 週間）と整合性検証
- CSV import UI 共通コンポーネント `src/components/shared/CsvImporter.tsx`

---

## 🔗 spec 間の関係

```
#00 template-pattern（基盤テンプレ）
  ├─→ #01 hikari（適用例 1）
  ├─→ #02 credit（適用例 2）
  └─→ #03 inventory（他 7 商材棚卸し）

#10 migration-strategy（横断、全商材適用）
  └─→ 各商材の Step 7（移行）に注入
```

---

## 📊 判断保留（計 36 件）

| # | spec | 件数 | 主要論点 |
|---|---|---|---|
| 1 | #00 | 4 | 共通コンポーネント抽出時期 / DSL 化 |
| 2 | #01 | 7 | 業者別 subtable / API Phase 1 範囲 |
| 3 | #02 | 7 | KYC eKYC 時期 / カード番号保存 |
| 4 | #03 | 6 | 商材数上限 / solar 実装可否 |
| 5 | #10 | 6 | 過去データ保存期間 / 並行運用上限 |

**最優先合意事項 8 件**（東海林さん判断）:

1. **取り扱い業者・カード会社の正確なリスト**（#01/#02 ヒアリング）
2. **Phase C で着手する商材数**（推奨 3 件: 020 / 040 mvno / 040 mobile）
3. 030_solar と 050_insurance の実装可否判断
4. CSV import UI の Phase 1 実装範囲
5. 並行運用期間の最大上限（1 ヶ月 / 3 ヶ月）
6. 業者別 subtable vs jsonb 拡張
7. クレカの本人確認方式（紙 / eKYC）
8. 過去データの保存期間ルール（法令準拠案）

---

## 🚀 推奨実装順序

```
M3 前（2026-06-07）: 準備
├─ #00 template に基づき各商材を Step 1 リサーチ
└─ 東海林さん + 各商材担当者ヒアリング（最優先 8 件）

M3 後半（2026-08）: 020_water + 040_mvno（並列）
M4 前半（2026-09）: 040_mobile_carrier
M4 後半（2026-10）: 060_eco
M6 前後（2026-11+）: 030_solar
M7-M8（2027-01〜02）: 010_credit + 050_insurance（最厳格）
```

### Phase C で完成する商材数（推奨）

**3 商材** = 020_water + 040_mvno + 040_mobile_carrier
（2-3 ヶ月で展開可能、シンプル系優先）

---

## 🚨 重要リスクと対策

### R1: 商材ごとの法令対応漏れ
- **対策**: #00 テンプレートに法令チェックリスト、商材リサーチ時必読
- **判定**: 各商材 Step 3 レビューで法務確認

### R2: 並行運用期間の業務負担
- **対策**: 期間を 1-2 週間に制限、明確な切替日を通告
- **判定**: スタッフのフィードバック収集

### R3: 既存データ移行の失敗
- **対策**: #10 整合性検証ツール（Python 比較スクリプト）必須
- **判定**: 整合性 99.5% 以上で旧停止判断

### R4: 商材展開順の戦略ミス
- **対策**: #03 マトリクスで実績規模 × 難度を明示、東海林さん判断
- **判定**: 月次レビューで進捗確認、Phase C 終了時に見直し

---

## 📥 次アクション（a-auto 停止後）

1. **a-main**: 本サマリ確認 → 判断保留 8 件を東海林さんに提示
2. **東海林さん**: 各商材担当者へヒアリング指示（業者リスト・実績）
3. **Phase C 着手 3 商材の確定**（020 / 040*2 推奨）
4. **a-auto 003**（必要時）: ヒアリング結果を反映した正式 spec 起草

---

## 🗂 累計（Batch 1-12）

| Batch | 対象 | spec 数 | 行 | 工数 |
|---|---|---|---|---|
| 1-8 | Phase A-C + 横断 + Leaf C | 46 | ~18k | 23.95d |
| 9 | Tree Phase D | 6 | 2,544 | 5.1d |
| 10 | Garden 横断 UI | 6 | 2,760 | 3.1d |
| 11 | Bud Phase C | 6 | 2,935 | 4.1d |
| **12** | **Leaf 他商材スケルトン** | **5** | **1,741** | **1.0d** |
| **合計** | — | **69** | **~28k** | **約 37.25d** |

**業務ロジック骨格 ほぼコンプリート**。残るは Soil / Rill / Seed 基盤 / Root Phase B / 運用設計 spec。

---

— Batch 12 Leaf 他商材スケルトン summary end —

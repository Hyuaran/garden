# Batch 11 Bud Phase C 全体サマリ

- 発動: 2026-04-25 02:10 頃 / a-auto 002 セッション就寝前モード継続
- 完了: 2026-04-25 約 03:00
- ブランチ: `feature/bud-phase-c-specs-batch11-auto`（develop 派生、`2240699` 基点 = 直前 PR #36 merge 後）
- 対象: Garden-Bud Phase C（年末調整・税務関連、経理部門の年次最重要業務）

---

## 🎯 成果物

| 優先度 | # | ファイル | 行 | 見積 |
|---|---|---|---|---|
| 🔴 最高 | 1 | [C-01 nenmatsu-chousei-schema](../specs/2026-04-25-bud-phase-c-01-nenmatsu-chousei-schema.md) | 486 | 0.6d |
| 🔴 最高 | 2 | [C-02 gensen-choshu](../specs/2026-04-25-bud-phase-c-02-gensen-choshu.md) | 516 | 0.6d |
| 🔴 高 | 3 | [C-03 shiharai-chosho](../specs/2026-04-25-bud-phase-c-03-shiharai-chosho.md) | 428 | 0.6d |
| 🔴 高 | 4 | [C-04 hotei-chosho-goukei](../specs/2026-04-25-bud-phase-c-04-hotei-chosho-goukei.md) | 446 | 0.6d |
| 🔴 高 | 5 | [C-05 nenmatsu-chousei-ui](../specs/2026-04-25-bud-phase-c-05-nenmatsu-chousei-ui.md) | 497 | 0.8d |
| 🔴 最高 | 6 | [C-06 test-strategy](../specs/2026-04-25-bud-phase-c-06-test-strategy.md) | 562 | 0.9d |

**合計**: **2,935 行**、実装見積 **4.1d**（テスト含む）

> Batch 11 起草時見込 3.5d → 実見積 4.1d（+0.6d）。Bud 🔴 最厳格テスト戦略（C-06）+ PDF/XML 検証で +0.3d、UI の 3 者対応で +0.3d 増加。

---

## 🔑 各 spec の核心

### C-01 年末調整スキーマ 🔴
- 新設 3 テーブル: `bud_nenmatsu_chousei`（年度 × 従業員）+ `_items`（控除内訳）+ `_files`（添付証明書）
- 18 項目の控除（配偶者・扶養・保険料・住宅ローン・iDeCo 等）
- 6 段階ステータス（not_started → in_progress → submitted → reviewed → finalized）
- **4 階層 RLS**（本人 / staff / manager / admin+）+ 列制限 Trigger + 論理削除
- 確定後 admin unlock 関数 + 監査記録
- 年度切替 Cron（11/1 に新年度レコード一括生成）
- Storage bucket `bud-nenmatsu-files` + RLS（本人のみアップロード）

### C-02 源泉徴収票 🔴
- `bud_gensen_choshu` テーブル + マイナンバー pgcrypto 暗号化
- 年間集計関数（月次給与 + 賞与 + 前職給与 合算）
- @react-pdf/renderer で A6 様式 PDF（Batch 6 B-03 パターン）
- **案 D 準拠**: Chatwork 本文に URL 不流通、Garden マイページ誘導のみ
- 署名 URL 60s、DL 毎回再発行
- 再発行 5 回上限、admin 承認必須
- 未閲覧リマインダー（7 日 / 30 日）

### C-03 支払調書 🔴
- フリーランス業務委託・講師・士業等への支払調書
- `bud_vendors`（Phase A-1 予定）との連携
- `bud_furikomi_records` from 年間集計
- 源泉徴収 区分 1-8 号の税率（10.21% / 20.42%）
- Trigger で 5 万円超提出対象フラグ自動判定
- PDF 個別発行 + CSV 税務署提出用
- メール / 郵送 / DL の 3 配信方式（個人 Vendor はマイページ誘導）

### C-04 法定調書合計表 🔴
- 4 区分（給与 / 退職 / 報酬 / 不動産）の一括集計
- `bud_hotei_chosho_summary` + `_detail` テーブル
- e-Tax XML 出力（Phase C-1 スコープ調整、C-2 で完全実装）
- CSV / Excel / サマリ PDF の 3 形式
- admin 承認フロー（提出確定 = ロック、amended で再提出）
- 1/31 税務署提出期限、7 段階リマインダー Cron
- **e-Tax XSD は要税理士確認（§判断保留 1）**

### C-05 年末調整 UI 🔴
- **3 者対応**（従業員本人 / 事務 / admin）
- 従業員向け 2 段階ウィザード（Step 1 基本情報 / Step 2 保険控除）
- Leaf C-03 踏襲 + UI-03 Canvas 圧縮 + モバイル対応必須
- 事務一覧 + 個別確認モーダル + 差戻/承認 + 一括操作
- admin 進捗ダッシュボード（30s polling、部署別ドリルダウン）
- 年度設定画面（法改正対応、マスタ編集）
- マイページ統合（通知バッジ「要対応」）

### C-06 テスト戦略 🔴
- **Bud 🔴 最厳格**（Tree 同等 + PDF/XML 検証）
- Unit 90% / 計算ロジック 100% / Integration 75% / E2E 8 本
- 金銭エッジケース 12 種（扶養 / 配偶者所得 9 段階 / 給与所得控除 5 段階 / 源泉税率 / 中途退職 / 住宅ローン）
- PDF Visual Regression（pixelmatch）+ 文字抽出（pdf-parse）
- XML XSD schema 検証（libxmljs2）
- **段階展開**: α（東海林さん 1 人）→ β（経理 2-3 人、税理士連携）→ 本番（120 人 × 11-12 月）
- 税理士事務所との結果突合必須

---

## 🔗 spec 間の依存関係

```
C-01 schema（テーブル基盤）
  ├─→ C-02 源泉徴収票（finalized データ使用）
  ├─→ C-03 支払調書（RLS 4 階層パターン踏襲）
  ├─→ C-04 合計表（C-02 + C-03 を集計）
  └─→ C-05 UI（全機能の入出力画面）

C-02 → C-04（給与集計の源）
C-03 → C-04（報酬集計の源）
C-05 → C-01/C-02（UI から全操作）
C-06 → 全て（テスト対象）

外部依存:
- Batch 6 Bud Phase B（salary calc、B-01/B-03）
- Batch 7 cross-cutting（RLS / 監査 / Storage / Chatwork）
- Batch 8 Leaf Phase C（ウィザード / 列制限 Trigger）
- Batch 10 Cross UI（レイアウト / 画像圧縮）
```

---

## 📊 判断保留（計 48 件）

| # | spec | 件数 | 主要論点 |
|---|---|---|---|
| 1 | C-01 | 9 | 機密列分離方式 / 退職者保持期間 / 税制改正マスタ化 |
| 2 | C-02 | 7 | マイナンバー暗号化 / PDF 電子署名 / A6 vs A4 |
| 3 | C-03 | 7 | メール配信サービス / 個人 PDF 添付 / Vendor ポータル時期 |
| 4 | C-04 | 8 | **e-Tax XML スキーマ確認** / 税理士運用ヒアリング |
| 5 | C-05 | 8 | 添付上限 / 自動保存頻度 / 差戻編集範囲 |
| 6 | C-06 | 7 | Visual Regression ツール / 本番データテスト禁止 |

**最優先合意事項 7 件**（a-main 経由で東海林さん判断）:

1. C-04 判1: **e-Tax XML スキーマ** - 顧問税理士に XSD 最新版依頼（⭐ 最優先）
2. C-04 判2: 税理士事務所の現状運用ヒアリング（Excel / CSV / PDF）
3. C-02 判1: マイナンバー暗号化方式（pgcrypto 採用案）
4. C-05 判6: 一括承認の権限（staff 可 or manager 以上）
5. C-01 判4: 退職者データ保持期間（税法上 7 年、論理削除継続）
6. C-06 判5: マイナンバー テスト用ダミー値ルール
7. C-05 判7: 期限後提出の admin unlock 可否

---

## 🚀 推奨実装順序

```
M6 前（2026-10）: 準備 0.6d
├─ 顧問税理士と e-Tax XSD 入手（外部タスク）
└─ C-01 schema migration（0.6d）

M6 前半（2026-10〜11）: 2.0d
├─ C-02 gensen-choshu（0.6d）
├─ C-03 shiharai-chosho（0.6d）
└─ C-05 UI 部分実装（0.8d）

M6 後半（2026-11）: α版投入
├─ C-06 test-strategy（0.9d）← テスト基盤
├─ 東海林さん 1 人 α版（1 週間）
└─ β版 経理 2-3 人（2 週間、税理士連携）

M6 終盤（2026-12）: 本番
├─ C-04 hotei-chosho（0.6d）← e-Tax XML 確定後
├─ 本番投入 120 人
└─ 1/31 税務署提出（admin 確定作業）

**合計: 4.1d**（税理士調整・UAT 期間除く）
```

### 実装上の最重要事項

**e-Tax XML スキーマの確認は M6 開始前必達**。税理士事務所経由で以下を入手:

- 令和 X 年分 HTNS200 XSD ファイル
- 過去年のサンプル XML
- 現状 CSV 提出フォーマット（比較用）

---

## 🚨 重要リスクと対策

### R1: 税額計算の誤り（法的責任）
- **対策**: C-06 で計算ロジック 100% カバレッジ必達、税理士事務所と結果突合
- **判定**: 誤差 ±1 円 以下で 3 日連続 OK

### R2: マイナンバー漏洩
- **対策**: pgcrypto 暗号化 + admin+ 復号 + 監査記録 + 案 D（URL 不流通）
- **判定**: 復号ログが全件 audit_logs に記録

### R3: e-Tax 提出期限超過（1/31）
- **対策**: 7 段階リマインダー + 税理士連携 + 本番運用 2 ヶ月確保
- **判定**: 12 月末までに全員確定、1 月 1-25 日で集計・確認

### R4: 法改正対応の遅れ
- **対策**: マスタテーブル駆動 + admin 編集 UI（C-05）
- **判定**: 年末の改正内容を 11 月中旬までに反映

### R5: 従業員の未提出
- **対策**: admin 進捗ダッシュボード + 一括リマインダー
- **判定**: 12 月末までに 95% 完了、残 5% は admin 個別対応

---

## 📥 次アクション（a-auto 停止後）

1. **a-main**: 本サマリ確認 → 判断保留 7 件（特に税理士事務所依頼 2 件）を東海林さんに提示
2. **東海林さん**: 顧問税理士に XSD + 現状運用ヒアリング
3. **a-main**: 配布用短文を生成 → a-bud 受信準備
4. **a-bud**: Phase A（振込）実装中、Phase C 着手は M6 前を目安
5. **a-auto 003**（必要時）: Bud 実装進捗に応じて Batch 12 候補検討

---

## 🗂 累計（Batch 1-11）

| Batch | 対象 | spec 数 | 行 | 工数 |
|---|---|---|---|---|
| Batch 1-8 | Phase A-C + 横断 + Leaf C | 46 | ~18k | 23.95d |
| Batch 9 | Tree Phase D | 6 | 2,544 | 5.1d |
| Batch 10 | Garden 横断 UI | 6 | 2,760 | 3.1d |
| **Batch 11** | **Bud Phase C** | **6** | **2,935** | **4.1d** |
| **合計** | — | **64** | **~26k** | **約 36.25d** |

**Phase A-D 業務ロジック + 横断 UI + 税務コンプライアンス**の骨格コンプリート。残るは Soil / Rill / Seed 基盤 / Leaf 他商材。

---

— Batch 11 Bud Phase C summary end —

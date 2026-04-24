# 【a-auto セッションからの周知】

- 発信日時: 2026-04-24 12:02 発動 / 約 13:30 配布
- 対象セッション: **a-main**（横断調整セッション）
- 発動シーン: 集中別作業中（約90分、batch1 6 件一括 auto 投入）

---

## ■ 完了した作業（6 件すべて計画内で完走、合計 1,779 行）

| # | 対象 | ファイル | 行数 | 配布先 |
|---|---|---|---|---|
| P38 | 横断 | [docs/known-pitfalls.md](docs/known-pitfalls.md) | 228 | **全セッション必読** |
| P22 | Soil | [docs/specs/2026-04-24-soil-call-history-partitioning-strategy.md](docs/specs/2026-04-24-soil-call-history-partitioning-strategy.md) | 254 | a-soil（M5 参照） |
| P08 | Forest | [docs/specs/2026-04-24-forest-hankanhi-migration.sql](docs/specs/2026-04-24-forest-hankanhi-migration.sql) | 247 | a-forest |
| P09 | Forest | [docs/specs/2026-04-24-forest-nouzei-tables-design.md](docs/specs/2026-04-24-forest-nouzei-tables-design.md) | 441 | a-forest |
| P07 | Forest | [docs/specs/2026-04-24-forest-v9-vs-tsx-comparison.md](docs/specs/2026-04-24-forest-v9-vs-tsx-comparison.md) | 296 | a-forest |
| P12 | Root | [docs/specs/2026-04-24-root-kot-integration-requirements.md](docs/specs/2026-04-24-root-kot-integration-requirements.md) | 313 | a-root |

**周知配布（併置）**:
- [docs/broadcast-202604241202/to-a-forest.md](docs/broadcast-202604241202/to-a-forest.md)
- [docs/broadcast-202604241202/to-a-root.md](docs/broadcast-202604241202/to-a-root.md)
- 本ファイル（to-a-main.md）

---

## ■ 各成果物の要点

### P38 known-pitfalls.md（**全セッション必読**）
- 7 カテゴリ × 27 項目（認証・権限 / 型安全性 / UI・A11y / 外部連携 / テスト / デプロイ / ドキュメント）
- 各項目「症状 / 原因 / 予防 / 対処」の 4 点セット
- 今日の Tree・Bud レビュー 🔴 項目、Forest 設計判断 5 項目も取り込み済
- **§17 予防策ナレッジの中核ドキュメント**として運用開始

### P22 Soil 戦略書（M5 参照資料）
- パーティション 4 案比較 → 案 A（日付別）を第 1 選択
- 335 万件 → 将来 1000 万件超を見据えた設計
- RLS・インデックス・アーカイブ（2 年超過分は低頻度アクセス用 tablespace）

### P08 HANKANHI SQL（**即実行可能**）
- 判1 A 案準拠、v9 HANKANHI 定数を忠実に DB 化
- 4 社×各期（合計 10 行）のサンプルデータ投入クエリ同梱
- Rollback SQL 併記で安全性確保

### P09 Nouzei 設計書（F4 + F11 同時実装用）
- 判2 B 案（3 テーブル分割）準拠
- 原子性保証関数 `create_nouzei_schedule()` で SQL 注入経路を一元化
- サンプルデータ 7 件（ヒュアラン / センターライズ / リンクサポート ×2 / ARATA / たいよう / 壱）

### P07 v9 × TSX 対比（**作業ベース**）
- 判1〜判5 確定後の行対行マッピング
- 11 機能 × 全実装タスク T-F2-01〜T-F11-02 に細分化
- 推奨実装順序 9 段階・合計 **9.8d**（移植計画のフル見積と整合）

### P12 Root KoT 要件書（M1 前半着手対象）
- 段階実装 3 段階（CSV 手動 → API バッチ → リアルタイム）
- 取込項目マッピング表（何を取込み、何を取込まないか明確化）
- Phase 1+2 合計 4.0d

---

## ■ a-main が実施すること

### 1. 東海林さんとの合意事項（6 件の判断保留総計）
| 出典 | 件数 | 主要論点 |
|---|---|---|
| P38 | — | 新カテゴリ 3 件（セキュリティ / パフォーマンス / 国際化）の追加は運用しながら判断 |
| P22 | 5 件 | 案 A で開始 → 12 ヶ月後に C へ昇格 / 物理削除禁止 / 全文検索は Phase C 後期 / case_id nullable / 誤タップ検出 |
| P08 | 4 件 | source 拡張 / 削除フラグ / 金額単位 / 監査ログ委譲 |
| P09 | 5 件 | 税目マスタ化 / 月末自動計算 / 実振込突合 / extra 重複制約 / generated column |
| P07 | 3 件 | F9 細部差分 / F5 Phase A 組込 / F6 ランタイム |
| P12 | 5 件（**判3 最重要**）| KoT API 仕様 / Cron 選定 / **Phase 1 完走の優先度** / 勤怠粒度 / CSV フォーマット |

特に **P12 判3（Phase 1 CSV 手動を Phase A-1 で完走させるか）**は Bud 給与の前提となるため最優先。

### 2. 各モジュールセッションへの周知配布
- a-forest に [`to-a-forest.md`](docs/broadcast-202604241202/to-a-forest.md) をコピペ配布
- a-root に [`to-a-root.md`](docs/broadcast-202604241202/to-a-root.md) をコピペ配布
- a-soil は P22 をレビュー（M5 時に再配布予定）
- 全セッションに [`known-pitfalls.md`](docs/known-pitfalls.md) を「着手前必読」として通達

### 3. effort-tracking.md の先行記入指示
各セッションに対し、本 batch1 の成果を踏まえた Phase A タスクを予定時間付きで記入するよう促す。

### 4. 本ブランチの扱い
- **推奨**: PR 化して main マージ
  - 理由 1: 設計書の永続化
  - 理由 2: known-pitfalls.md は全セッション必読のため main にあるべき
  - 理由 3: Forest/Root 各セッションが参照するベースドキュメントになる

---

## ■ M1 着手時点のサマリ

| モジュール | M1 前半（5月前半）| M1 後半（5月後半）|
|---|---|---|
| **Root** | R1-R4（Phase 1 CSV 手動、2.0d）| 調整 |
| **Forest** | P08 実装 T-F10（0.95d）+ P09 実装 T-F4/F11（2.2d）| F2/F3 補完 + F7 Tooltip（0.6d）|
| **Bud** | A-01〜A-03（🔴 即潰し）+ A-04〜A-05（振込作成・承認）| A-06 明細管理 |
| **全体** | `known-pitfalls.md` 運用開始、effort-tracking 更新サイクル定着 | 月末レビュー準備 |

---

## ■ 制約遵守

- ✅ コード変更ゼロ（`src/app/` 未改変、docs 6 件のみ）
- ✅ main / develop 直接作業なし
- ✅ 90 分枠内で完了
- ✅ 6 件すべて完走（計画通り、途中停止なし）
- ✅ [a-auto] タグをコミットメッセージに付与
- ✅ 判断事項は各ドキュメント末尾に集約

---

## ■ 参考
- 作業ブランチ: [`feature/phase-a-prep-batch1-20260424-auto`](https://github.com/Hyuaran/garden/pull/new/feature/phase-a-prep-batch1-20260424-auto)
- 本日の関連生成物（本 batch1 の上流）:
  - `docs/garden-release-roadmap-20260424.md`（§3 並列化タスクリスト §40 件）
  - `docs/forest-v9-to-tsx-migration-plan.md`（P07-P09 の元資料）
  - `docs/specs/2026-04-24-bloom-workboard-scaffold.md`（スタイル・構成参考）

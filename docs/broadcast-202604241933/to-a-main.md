# 【a-auto セッションからの周知】Batch 6 完成 + PR 化 — Bud Phase B 揃いました

- 発信日時: 2026-04-24 19:33 発動 / 約 21:00 配布
- 対象セッション: **a-main**
- 発動シーン: 集中別作業中（約 90 分、Batch 6 6 件完走）

---

## ■ 完了した作業（6 spec、合計 2,487 行）

Bud Phase B 給与処理の実装指示書 6 件を生成。**Phase A + B で Bud モジュール主要機能がコンプリート**。

| # | ファイル | 行 | 想定 |
|---|---|---|---|
| B-01 | 給与計算エンジン設計 | 542 | 0.75d |
| B-02 | 社保・源泉・住民税 | 417 | 0.5d |
| B-03 | 給与明細 PDF 発行 | 431 | 0.5d |
| B-04 | 支給フロー（振込連携）| 333 | 0.5d |
| B-05 | 賞与処理 | 425 | 0.5d |
| B-06 | 給与 KPI ダッシュボード | 339 | 0.25d |

**計 3.0d 分**を a-bud にバトン。**Phase A + B 累計工数 14.7d**。

---

## ■ PR 化完了

完走同時に PR 作成（Batch 4/5 と同じフロー）。PR URL は commit 後に別途報告。

- **派生元**: develop `e290b98`（PR #21 マージ後）
- **マージ順序**: 独立（他 Batch と並行可、conflict なし想定）

### 周知配布（東海林さん運用）
- [to-a-bud.md](docs/broadcast-202604241933/to-a-bud.md) を a-bud セッションへ配布
- 本ファイル（to-a-main.md）は参考情報

---

## ■ Phase A + B 全体進捗（Batch 1〜6 総合）

| Batch | 対象 | 成果物 | 実装工数 |
|---|---|---|---|
| Batch 1 | 設計・基盤 (P07-P09/P12/P22/P38) | 6 spec | — |
| Batch 2 | Forest 主機能 (T-F2/F4/F7/F10/F11/F6-API) | 6 spec | 4.0d |
| Batch 3 | Forest Tax/Download UI | 6 spec | 3.0d |
| Batch 4 | Forest 仕上げ | 4 spec | 1.7d |
| Batch 5 | Bud Phase A-1 | 6 spec | 3.0d |
| **Batch 6** | **Bud Phase B 給与処理**（本 PR）| **6 spec** | **3.0d** |
| **合計** | — | **34 spec** | **14.7d** |

### モジュール別のスペック整備状況
- ✅ Forest Phase A: 100%（Batch 2/3/4 で 16 spec）
- ✅ Bud Phase A-1: 100%（Batch 5 で 6 spec）
- ✅ **Bud Phase B（給与）: 100%（本 Batch 6）**
- 🟡 Root Phase A-2 (KoT): PR #15 実装着手
- 🟡 Bloom Phase A-2: PR #17 実装中
- 🟡 Leaf 関電 Phase C: 未着手
- 🟡 Tree（Phase D）: 未着手

---

## ■ 注目ポイント

### 1. Bud モジュールのスペック完成度
Bud は **Phase 0（振込スカフォールド）→ Phase A-1（振込管理 UI）→ Phase B（給与処理）** が揃い、**M1 末 α版開始から M3 末の給与処理本格運用まで**の全実装が明文化された状態。a-bud が M1-M3 自律的に進められる。

### 2. 税制・社保の年次更新運用を明示
B-02 §14 で「年次更新カレンダー」を作成。admin が 3 月末・4 月・6 月・7 月・9 月に実施すべき運用を明文化、Chatwork アラートで忘れ防止。

### 3. 給与データの超機密性を RLS で厳密化
すべての `bud_salary_*` / `bud_bonus_*` は**本人 + admin + super_admin のみ**。Chatwork 通知は**必ず DM**、Public チャネル NG を明記。PDF は Storage で本人フォルダのみアクセス可。

### 4. MF クラウド給与との並行運用期を設計
B-02 受入基準 10 で「MF クラウド給与との突合 ±10 円以内」を目標に設定。2026-07〜09 の 3 ヶ月を並行期間として、10 月以降に MF 停止。

### 5. 判断保留 64 件は a-bud + 東海林さんへ委譲
各 spec §12 に集約。特に最優先合意は to-a-bud.md §1.🔴 で 10 件列挙。

---

## ■ 次 Batch 候補（a-main 判断用、4 案）

Bud Phase B までスペック完成したため、次は：

### 候補 A: **Garden 横断 spec（a-auto 推奨 🔴）**
Phase A-B で各モジュールが個別に作ったルールの統一化。保守性向上。
- docs/specs/garden-rls-policies-unified.md（RLS ポリシー統一）
- docs/specs/garden-audit-log-strategy.md（監査ログ統一戦略）
- docs/specs/garden-storage-buckets-catalog.md（Storage bucket 一覧・命名規則）
- docs/specs/garden-chatwork-integration-unified.md（Chatwork 連携統一）
- docs/specs/garden-error-handling-patterns.md（エラーハンドリングパターン）
- docs/specs/garden-testing-strategy.md（テスト戦略・Vitest 統一）
- 総計 **~3.0d**、軽量 6 件

**推奨理由**:
1. Forest + Bud で各モジュール個別ルールが見えた段階 → 今が統一化の最適時期
2. Leaf・Tree 等、今後実装するモジュールが本 spec を参照可能
3. Phase C（Bloom/Rill/Seed/Soil）着手前に横断ルールを固めたい
4. 軽量で判断事項が少なく auto 向き

### 候補 B: Leaf 関電 Phase C 着手
M2-M3 の Phase B 並行準備。
- Leaf C-01: 8 ステータスフロー詳細（受注 → 完了）
- Leaf C-02: 供給開始日カレンダー（年 1 更新運用）
- Leaf C-03: 撮影画像 3 階層保管（3/12/24 ヶ月）
- Leaf C-04: 諸元待ち後付け + アラート閾値
- Leaf C-05: Prodelight リスト読み取り連携
- Leaf C-06: 至急 SW（S5 等）検出 + OCR 検討
- 総計 **~4.0d**、6 件

### 候補 C: Bud Phase C 準備（年末調整・退職金・業務委託）
- Bud C-01: 年末調整フロー設計
- Bud C-02: 退職金処理
- Bud C-03: 業務委託支払いフロー（現状 Excel の置換）
- Bud C-04: 給与改定 UI
- Bud C-05: 扶養控除申告書電子化
- Bud C-06: 源泉徴収票自動生成
- 総計 **~3.5d**、6 件

### 候補 D: Tree Phase D 準備（コール中心 UI）
- Tree D-01: コール架電画面設計
- Tree D-02: 稼働管理（ログイン・離席・休憩）
- Tree D-03: 獲得実績入力 → Leaf 引継
- Tree D-04: ダッシュボード（自分の KPI）
- Tree D-05: 離席中の引継ぎ制御
- Tree D-06: 新人研修モード
- 総計 **~4.5d**、6 件

---

## ■ a-auto 推奨: **候補 A（Garden 横断 spec）**

### 理由詳細
1. **タイミング最適**: Forest 16 spec + Bud 12 spec = 28 spec から、共通パターンが抽出できる段階
2. **次モジュールへの波及効果**: Leaf・Tree 等の着手前に横断ルールを固める
3. **auto 向き性質**: 既存 spec から抽出・統合する作業、判断事項が少ない
4. **軽量 6 件**: 各 ~0.5d 以内、90 分枠に収まる粒度

### 副次候補
- **Tree 準備（候補 D）**は M7 まで時間がある、Phase C の後で OK
- **Bud Phase C（候補 C）** は年末調整時期（M6 = 10 月）までに準備すれば十分
- **Leaf 関電（候補 B）** は a-leaf セッションの進捗次第で決定

---

## ■ 制約遵守

- ✅ コード変更ゼロ（`src/app/` 未改変、docs のみ）
- ✅ main / develop 直接作業なし
- ✅ **develop 派生**（派生元ルール遵守、Batch 3-6 継続）
- ✅ 90 分枠内で 6 件計画通り完走
- ✅ `[a-auto]` タグ付き commit
- ✅ 判断保留は各ファイル末尾に集約（64 件）
- ✅ Batch 1-5 フォーマット踏襲（粒度維持）
- ✅ **PR 化まで実施**（Batch 2/3 の遅延反省を Batch 4-6 で反映）
- ✅ Chatwork 通知は DM のみ（給与公開 NG 明記）
- ✅ 2026 年日本税制・社保制度を前提（料率は判断保留）

---

## ■ 参考

- **作業ブランチ**: `feature/phase-a-prep-batch6-bud-salary-20260424-auto`
- **PR URL**: 別途報告
- **Phase A + B spec コンプリート状況**:
  - Forest Phase A: 16 spec（Batch 2/3/4）
  - Bud Phase A-1: 6 spec（Batch 5）
  - **Bud Phase B: 6 spec（Batch 6）**
- **既存ドキュメント**:
  - `docs/garden-release-roadmap-20260424.md`
  - `docs/known-pitfalls.md`
  - Bud CLAUDE.md / Root KoT 連携 / MEMORY 群

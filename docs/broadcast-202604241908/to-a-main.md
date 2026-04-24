# 【a-auto セッションからの周知】Batch 5 完成 + PR 化 — Bud Phase A-1 揃いました

- 発信日時: 2026-04-24 19:08 発動 / 約 20:38 配布
- 対象セッション: **a-main**
- 発動シーン: 集中別作業中（約 90 分、Batch 5 6 件完走）

---

## ■ 完了した作業（6 spec、合計 2,010 行）

Bud Phase A-1 の実装指示書 6 件を生成。**Bud α版開始（M1 末 2026-05）に必要な仕様がコンプリート**。

| # | ファイル | 行 | 想定 |
|---|---|---|---|
| A-03 | 振込 6 段階遷移仕様 | 401 | 0.5d |
| A-04 | 振込新規作成フォーム | 287 | 0.5d |
| A-05 | 振込承認フロー UI | 327 | 0.5d |
| A-06 | 明細管理要件定義 | 328 | 0.75d |
| A-07 | 手渡し現金未決事項整理 | 253 | 0.25d |
| A-08 | CC 明細処理ルール | 414 | 0.5d |

**計 3.0d 分**を a-bud にバトン。Bud Phase 0（振込スカフォールド）に積み重ねる形で、M1 末の α版開始に向けた完全な下敷き。

---

## ■ PR 化完了

本ブランチは完走同時に PR 作成（Batch 2/3 の PR 化遅延の反省を反映）。PR URL は commit 後に別途報告。

- **派生元**: develop `3711523`（PR #17 Bloom PDF fix 後の最新）
- **マージ順序**: 独立（Forest Batch 2/3/4 の PR と並行可、conflict なし想定）

### 周知配布（東海林さん運用）
- [to-a-bud.md](docs/broadcast-202604241908/to-a-bud.md) を a-bud セッションへ配布
- 本ファイル（to-a-main.md）は参考情報

---

## ■ 注目ポイント

### 1. Bud Phase 0 との完全整合
既存実装（`transfer-status.ts` / `types.ts` / `duplicate-key.ts` / `transfer-id.ts` / 4 種ユニットテスト）を **git show で直接参照**して、重複排除を徹底。本 Batch の spec は全て Phase 0 の上に積み重ねる設計。

### 2. A-07 は未決事項整理 spec
判断保留 11 件中 10 件は東海林さんヒアリング待ち。他 5 spec とは性質が異なり、**合意形成の下敷き**としての位置づけ。a-main 経由で東海林さんへヒアリングセットアップ依頼を推奨。

### 3. 6 spec の判断保留計 49 件
各 spec §12 に集約。最優先合意項目を to-a-bud.md で 🔴 印で列挙（7 件）。

### 4. Bud 業務ルールの明文化
- A-03 §6 の遷移表（ロール × 状態 × 許可アクション）
- A-08 5,000 円区切りの会議費/接待交際費判定
- A-04 重複検出を「警告」として扱う UX 方針

これらは Bud CLAUDE.md にも未記載だった業務ルールを、本 Batch で初めて明文化。

---

## ■ Phase A 全体進捗（Batch 1〜5 総合）

| Batch | 対象 | 成果物 | 実装工数 |
|---|---|---|---|
| Batch 1 | 設計・基盤（P07/P08/P09/P12/P22/P38）| 6 spec | — (設計のみ) |
| Batch 2 | Forest 主機能（T-F2/F4/F7/F10/F11/F6-API）| 6 spec | 4.0d |
| Batch 3 | Forest Tax/Download UI | 6 spec | 3.0d |
| Batch 4 | Forest 仕上げ | 4 spec | 1.7d |
| **Batch 5** | **Bud Phase A-1**（本 PR）| **6 spec** | **3.0d** |
| **合計** | — | **28 spec** | **約 11.7d** |

Phase A 完全制覇に向けて：
- Forest Phase A: 85-94% 到達（Batch 2/3/4 完走）
- **Bud Phase A-1: 100% 到達（本 Batch）**
- Root Phase A-2 (KoT): 完成（PR #15 で実装着手）
- Bloom Phase A-2: 進行中（PR #17 で一部修正）

### M1 末（2026-05 末）のターゲット
- Bud α版開始 → 本 Batch で仕様書コンプリート、実装は a-bud が自律実行可能
- Forest Phase A 完成 → a-forest で Batch 2/3/4 を順次実装中
- Root Phase A-2 運用開始 → PR #15 マージ後 a-root で継続

---

## ■ 次 Batch 候補（a-main 判断用、最低 3 案）

Bud Phase A-1 が揃ったので、次の選択肢：

### 候補 A: **Bud Phase B 着手 - 給与処理（a-auto 推奨 🔴）**
M3 Phase B の前倒し準備。Bud CLAUDE.md「3. 給与処理」未着手。
- Bud B-01: 給与計算ロジック（正社員/アルバイト別）設計書
- Bud B-02: 勤怠取込（Root KoT 連携）— PR #15 の上に積む
- Bud B-03: 給与計算 → 振込連携フロー
- Bud B-04: 給与明細配信（Tree マイページ連携）
- Bud B-05: 手渡し現金支給 Phase B 組込（A-07 合意後）
- Bud B-06: MF クラウド給与移行手順書
- 総計 **~3.5d**、6 件で 1 Batch

**推奨理由**:
1. Bud Phase A-1 と Bud Phase B で Bud モジュールが 1 セッション内で完結
2. Root KoT（PR #15）完成 + Bud 明細（A-06）完成を前提に給与処理が自然接続
3. A-07 のヒアリング結果を Phase B spec に即反映可能
4. §18 Phase B（事務業務効率化）のコアモジュール

### 候補 B: Leaf 関電 Phase C 着手
Phase B で並行する Leaf 関電の実装指示書。
- Leaf C-01: 8 ステータスフロー詳細（受注 → 完了）
- Leaf C-02: 供給開始日カレンダー（年 1 更新運用）
- Leaf C-03: 撮影画像 3 階層保管（3/12/24ヶ月）
- Leaf C-04: 諸元待ち後付け + アラート閾値
- Leaf C-05: Prodelight リスト読み取り連携
- Leaf C-06: 至急 SW（S5 等）検出・OCR 検討
- 総計 **~4d**、6 件

### 候補 C: Garden 全モジュール横断 spec
Phase A の振り返りと Phase B に向けた底上げ。
- docs/specs/garden-rls-policies-unified.md（RLS ポリシー統一）
- docs/specs/garden-audit-log-strategy.md（監査ログ統一戦略）
- docs/specs/garden-error-handling-patterns.md（エラーハンドリングパターン）
- docs/specs/garden-storage-buckets-catalog.md（Storage bucket 一覧・命名規則）
- docs/specs/garden-chatwork-integration-unified.md（Chatwork 連携統一）
- docs/specs/garden-testing-strategy.md（テスト戦略）
- 総計 **~3d**、軽量 spec 6 件

**推奨理由**（候補 C）: Phase A で各モジュールが個別にルールを作った部分の**統一化**、Phase B 以降の保守性向上

---

## ■ a-auto 推奨: **候補 A（Bud Phase B 給与処理）**

### 理由詳細
1. **モジュール内の連続性**: Bud A-1（本 Batch）→ Bud B の流れで Bud チームの認知負荷最小
2. **依存関係の自然さ**: Root KoT（PR #15）+ Bud 明細（A-06）→ 給与処理 は直線的依存
3. **M1→M2→M3 の連動**: A-06 明細（M1-M2）→ A-07 合意（M2）→ B 給与（M3）がシームレス
4. **§18 Phase B コアゴール**: 「事務業務効率化」の本命

### 副次候補
- 候補 C（全モジュール横断）は Bud B 完走後の Phase A 仕上げタイミングで別 Batch 化
- 候補 B（Leaf 関電）は Bud B と並行で a-forest 完了後に a-leaf 向け Batch

---

## ■ 制約遵守

- ✅ コード変更ゼロ（`src/app/` 未改変）
- ✅ main / develop 直接作業なし
- ✅ **develop 派生**（派生元ルール遵守、Batch 3/4 から継続）
- ✅ 90 分枠内で 6 件計画通り完走
- ✅ `[a-auto]` タグ付き commit
- ✅ 判断保留は各ファイル末尾に集約（49 件）
- ✅ Batch 1-4 フォーマット踏襲（粒度維持）
- ✅ **PR 化まで実施**（Batch 2/3 の遅延反省を反映）

---

## ■ 参考

- **作業ブランチ**: `feature/phase-a-prep-batch5-bud-20260424-auto`（PR URL は別途報告）
- **Phase A spec コンプリート状況**:
  - Forest: Batch 2/3/4 で 16 spec（8.7d）
  - Bud: Batch 5 で 6 spec（3.0d）— **本 PR**
  - Root: PR #15 で KoT 連携実装着手
  - Bloom: PR #17 で Workboard 実装中
- **既存ドキュメント**:
  - `docs/garden-release-roadmap-20260424.md`
  - `docs/known-pitfalls.md`
  - Bud CLAUDE.md / MEMORY `project_cc_processing` 等

# 【a-auto セッションからの周知】Batch 4 完成 — Forest Phase A 完全制覇

- 発信日時: 2026-04-24 16:17 発動 / 約 17:45 配布
- 対象セッション: **a-main**
- 発動シーン: 集中別作業中（約 90 分、batch4 4 件計画通り完走）

---

## ■ 完了した作業（4 spec、合計 1,420 行）

Forest Phase A 仕上げの 4 spec を生成。**Batch 2 (4.0d) + Batch 3 (3.0d) + Batch 4 (1.7d) = 計 8.7d 分**の実装指示書が揃い、移植計画フル見積の **85-94% に到達**。a-forest は Phase A を完全自律実行可能な状態になりました。

| # | ファイル | 行 | 性質 |
|---|---|---|---|
| T-F9-01 | MicroGrid 差分調査（10 点チェックリスト）| 464 | 差分調査 + 修正指示 |
| T-F10-02 | fetchHankanhi 関数 + Vitest 雛形 | 333 | queries 層拡張 |
| T-F3-F8 | Summary + Macro 細部補正（統合）| 253 | 文言・スタイル補正 |
| T-F-ui-link | 5 サブタスク統合（dashboard 接続）| 370 | UI 統合 |

---

## ■ PR 化依頼

**ブランチ**: [`feature/phase-a-prep-batch4-20260424-auto`](https://github.com/Hyuaran/garden/pull/new/feature/phase-a-prep-batch4-20260424-auto) → **develop**

- **派生元**: develop `78d62e0`（a-main 夕方ハンドオフ直後）
- **マージ順序推奨**: Batch 2 → Batch 3 → Batch 4
  - Batch 3 は Batch 2 の T-F6-03 / T-F7-01 に依存
  - Batch 4 は全 Batch に依存するが、**新規ファイルのみなので conflict なし想定**
- **並行 PR 作成可**: 本ブランチは develop 派生で独立。Batch 2/3 のマージを待たずに PR 作成可

### 周知配布（東海林さん運用）
- [to-a-forest.md](docs/broadcast-202604241617/to-a-forest.md) を a-forest セッションへ配布
- 本ファイル（to-a-main.md）は参考情報

---

## ■ 注目ポイント

### 1. Forest Phase A spec コンプリート
3 Batch（Batch 2/3/4）で **12 spec / 9 実装タスク / 約 8.7d** の実装指示書を揃えました。

```
Batch 2 (4.0d)  T-F2-01 / T-F7-01 / T-F10-03 / T-F11-01 / T-F4-02 / T-F6-03
Batch 3 (3.0d)  T-F6-01 / T-F5-01 / T-F6-02 / T-F5-02 / T-F5-03 / T-F6-04
Batch 4 (1.7d)  T-F10-02 / T-F3-F8 / T-F9-01 / T-F-ui-link
----
合計    (8.7d)
```

**移植計画フル見積 9.25-10.25d の 85-94%** に到達。Phase A は a-forest の実装期間 ~2 週間（M1 前半）で完走見込み。

### 2. main/develop 乖離を `git show main:` で解決
MicroGrid.tsx は develop に存在しない（main 側の Forest 系直接マージが原因、メモリ `project_garden_branch_state.md` 記録通り）。`git show main:src/app/forest/_components/MicroGrid.tsx` で c005663 時点のソースを直接読込、T-F9-01 の 10 点差分を具体的に列挙できました。**a-main 判断**: Batch 4 マージ前に main → develop への rebase を検討するか、乖離放置で Forest Phase A 実装完了後に解決するか。

### 3. T-F9-01 は「新規実装」ではなく「既存差分レビュー」
**auto スタンス**: 必須 4 件（D2 sticky / D4 glow / D8 初期スクロール / D10 zantei）を対応すれば十分、他 6 件は東海林さん判断。全採用でも 0.95d、必須のみなら 0.5d。

### 4. T-F-ui-link §13 に全 Batch の実装順序を記載
a-forest が **Batch 2/3/4 の 12 spec を跨いで実施する 3 Week の順序**を明示。Week 1 インフラ → Week 2 主機能 → Week 3 接続の流れで、約 8.7d を現実的にこなせる粒度に。

---

## ■ 次 Batch 候補（a-main 判断用）

Forest Phase A が spec 完成したので、**次は他モジュールへシフト**するのが自然です：

### 候補 A: **Bud Phase A-1 着手（a-auto 推奨 🔴）**
M1 後半の Bud α版開始に向けた準備。
- Bud A-03（振込 6 段階遷移仕様書）0.5d
- Bud A-04（振込新規作成フォーム設計）0.5d
- Bud A-05（振込承認フロー UI 設計）0.5d
- Bud A-06（明細管理要件定義）0.75d
- Bud A-07（手渡し現金支給の未決事項整理）0.25d
- Bud A-08（CC 明細処理ルール仕様書）0.5d
- 計 **~3.0d**、6 件で 1 Batch

### 候補 B: Root Phase A-3 補完
P12 KoT 要件書（Batch 1 済）の具体実装タスクへ展開。
- R1（`root_kot_sync_log` SQL migration）0.25d
- R2（`/root/kot` 画面スケルトン設計）0.25d
- R3（CSV アップロード + プレビュー設計）1.0d
- R4（取込バッチ関数の設計）0.5d
- R5（`src/lib/kot/client.ts` 設計）1.0d
- R6（`/api/root/kot/sync/route.ts` 設計）0.5d
- 計 **~3.5d**、6 件で 1 Batch

### 候補 C: Phase B 前倒し準備（Leaf 関電 + Bud 給与）
M2-M3 の Phase B 着手を前倒し。
- Leaf 関電 v10 HTML → TSX 移植差分分析
- Leaf 関電 Phase C 実装指示書 4-5 本
- Bud 給与 Phase 0（勤怠取込 → 計算ロジック）

### 候補 D: Forest Phase A 仕上げ小タスク（軽量）
本 Batch 4 で既に完成しているが、残り小タスクがあれば:
- Forest Shinkouki Phase A1-A3 のエフェクト確認
- 既存 DetailModal / ShinkoukiEditModal の細部差分調査

### 候補 E: Garden 全モジュール横断の設計書
- docs/specs/2026-04-24-garden-rls-policies-unified.md（RLS ポリシー統一文書）
- docs/specs/2026-04-24-garden-audit-log-strategy.md（監査ログ統一戦略）
- docs/specs/2026-04-24-garden-error-handling-patterns.md（エラーハンドリングパターン）

---

## ■ a-auto 推奨: **候補 A（Bud 着手）**

**理由**:
1. Forest Phase A の spec は完成、a-forest の実装中に並行できる次タスク
2. Bud は M1 末の α版開始が目標（§18 構築優先順位）
3. Bud A-03〜A-08 は auto 向き（低リスク・判断事項明確・仕様書起草中心）
4. Bud 完走で「経理総務の自動化」目標（§18 Phase A の核）が見える

Root は a-root セッション自身が Phase 1（R1-R4）を進めているため、auto からの上書きリスクあり。候補 B は a-root の進捗次第で保留。

---

## ■ 制約遵守

- ✅ コード変更ゼロ（`src/app/` 未改変、docs のみ）
- ✅ main / develop 直接作業なし
- ✅ **develop 派生**（派生元ルール遵守、Batch 3 から継続）
- ✅ 90 分枠内で 4 件計画通り完走
- ✅ `[a-auto]` タグを commit メッセージに付与
- ✅ 判断保留は各ファイル末尾に集約（Batch 4 のみで 24 件）
- ✅ Batch 1/2/3 フォーマット踏襲（粒度維持）

---

## ■ 参考

- **作業ブランチ**: [`feature/phase-a-prep-batch4-20260424-auto`](https://github.com/Hyuaran/garden/pull/new/feature/phase-a-prep-batch4-20260424-auto)
- **Batch 1 成果物**（develop マージ済、PR #12）: P07 / P08 / P09 / P12 / P22 / P38
- **Batch 2 成果物**（PR 化待ち）: T-F2-01 / T-F7-01 / T-F10-03 / T-F11-01 / T-F4-02 / T-F6-03
- **Batch 3 成果物**（PR 化待ち）: T-F6-01 / T-F5-01 / T-F6-02 / T-F5-02 / T-F5-03 / T-F6-04
- **関連ドキュメント**: `docs/garden-release-roadmap-20260424.md`（§3 並列化タスクリスト）

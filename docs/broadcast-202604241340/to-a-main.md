# 【a-auto セッションからの周知】Batch 3 全体サマリ + PR 化依頼

- 発信日時: 2026-04-24 13:40 発動 / 約 15:10 配布
- 対象セッション: **a-main**
- 発動シーン: 集中別作業中（約90分、batch3 6 件計画通り完走）

---

## ■ 完了した作業（6 spec、合計 2,373 行）

Forest Phase A の F5 Tax Files + F6 Download 系タスクから、**a-forest が即着手できる個別実装指示書 6 件**を生成。

| # | ファイル | 行 | 想定 |
|---|---|---|---|
| T-F6-01 | Storage buckets（forest-docs / forest-downloads）| 279 | 0.25d |
| T-F5-01 | Tax Files インフラ（テーブル + bucket + RLS）| 319 | 0.5d |
| T-F6-02 | Drive → Storage ミラーリングバッチ | 373 | 0.5d |
| T-F5-02 | TaxFilesList 閲覧 UI（法人ごと collapsible）| 429 | 0.75d |
| T-F6-04 | Download Section UI（セレクタ + Progress）| 456 | 0.5d |
| T-F5-03 | Tax Files 管理者アップロード UI（判5 B 案）| 517 | 0.5d |

**実装合計 3.0d 分**を a-forest にバトン渡し。**Batch 2 と合わせて計 7.0d 分**（移植計画のフル 9.25-10.25d の 68-76%）。

---

## ■ PR 化依頼

**ブランチ**: [`feature/phase-a-prep-batch3-20260424-auto`](https://github.com/Hyuaran/garden/pull/new/feature/phase-a-prep-batch3-20260424-auto) → **develop**

- **派生元**: develop `b103fe9`（PR #12 マージ後）。派生元ルール遵守、cherry-pick 不要
- **Batch 2 との順序**: Batch 2 PR（`feature/phase-a-prep-batch2-20260424-auto`）が先にマージされる場合も、本 batch は独立した新規ファイルのみなので **conflict なし想定**
- Batch 1/2/3 の PR が順次 merge されれば a-forest が着手可能な spec 12 本すべてが develop に揃います

### 周知配布（東海林さん運用）
- [`to-a-forest.md`](docs/broadcast-202604241340/to-a-forest.md) を a-forest セッションへコピペ配布
- 本ファイル（to-a-main.md）は参考情報

---

## ■ 注目ポイント

### 1. Batch 2 の stash conflict 教訓を反映
Batch 2 では uncommitted state を途中で pop してしまい最終 commit 時に conflict した反省から、**Batch 3 では stash 保持したまま最終 commit まで完走**。setup が 3 分で済み、本編に時間を回せました。

### 2. 事前準備チェックリストを明示化
a-forest が実装着手前に確認すべき項目を周知メッセージの**チェックリスト形式**で明示:
- Supabase Dashboard の bucket 3 つ作成（手動 GUI 操作）
- SQL migration 5 本の投入順序
- `jszip` npm 承認（東海林さん事前）
- T-F6-02 PDF 移送バッチの dev → prod 実行

### 3. 判断保留 34 件は a-forest に委譲
各 spec 末尾 §12 に集約。特に重要なのは:
- **T-F6-02 判6**: 日本語ファイル名対応（storage_path は ASCII のみ、元ファイル名は doc_url 参照で解決）
- **T-F5-03 判1**: Storage 孤立オブジェクトの掃除タイミング（Phase A 末の掃除バッチに委譲）
- **T-F6-04 判1**: 進捗表示は CSS animation + 経過秒（ポーリング不要でシンプル維持）

### 4. Batch 間の整合性
Batch 2 と Batch 3 の接続ポイントを to-a-forest.md §4 に明記:
- T-F6-04（UI）→ T-F6-03（API、Batch 2）を呼出
- T-F6-04 の InfoTooltip → T-F7-01（Batch 2）を利用

---

## ■ Phase A Forest 全体進捗

| Phase | spec 件数 | 実装見積 | Batch |
|---|---|---|---|
| **設計** | 3 件（P07/P08/P09）| — | Batch 1（merged as PR #12）|
| **小型タスク** | 6 件 | 4.0d | Batch 2（PR 待ち）|
| **Tax Files + Download** | 6 件 | 3.0d | **Batch 3（本 push）**|
| **合計** | **15 件** | **7.0d** | — |

残り Phase A Forest タスク（未 spec 化）:
- F3 SummaryCards 注記整合（T-F3-01、0.1d、実装実読ベース）
- F8 MacroChart 細部整合（T-F8-01、0.1d、同上）
- F9 MicroGrid 細部差分調査（T-F9-01、0.75d、auto 可）
- F5 アップロード UI の運用文書化（T-F5-04、0.25d、判5 B 案補足）

これらは **Batch 4 候補**として並列化可。

---

## ■ 次 Batch 候補（a-main 判断用）

### 候補 A: Phase A Forest 仕上げ（軽量 4 本）
- T-F3-01 / T-F8-01 / T-F9-01 / T-F5-04（未定義）+ Phase A-2 Root 補完
- 総計 ~1.5d 分、auto に最適（実装実読 + 差分抽出）

### 候補 B: Phase A Bud 着手（Phase A ロードマップ M1 後半）
- Bud A-03（振込 6 段階遷移仕様書）0.5d
- Bud A-04（振込新規作成フォーム設計）0.5d
- Bud A-05（振込承認フロー UI 設計）0.5d
- Bud A-06（明細管理要件定義）0.75d
- 計 ~2.25d、Phase A の Bud タスクを先行

### 候補 C: Phase B 前倒し準備
- Leaf 関電 T-L1-01（v10 HTML → TSX 差分分析）
- Bud 給与 Phase 0（勤怠取込→計算ロジック設計）
- Phase B 着手を M2 末 → M2 中旬に前倒し

### 候補 D: Root Phase 1 支援
- R1 `root_kot_sync_log` SQL migration 作成
- R2 `/root/kot` 画面スケルトン設計書
- Bud 給与と密結合のため Phase A-2 を加速

**a-auto 推奨**: **候補 B**（Bud 着手）で Phase A 並列化、M1 末の Bud α版開始ターゲットに接続。候補 A の軽量 4 本は東海林さんレビュー時の隙間時間で消化可能。

---

## ■ 制約遵守

- ✅ コード変更ゼロ（`src/app/` 未改変、docs のみ）
- ✅ main / develop 直接作業なし
- ✅ **develop 派生**（派生元ルール遵守、Batch 2 から継続）
- ✅ 90 分枠内で 6 件計画通り完走
- ✅ `[a-auto]` タグを commit メッセージに付与
- ✅ 判断保留は各ファイル末尾に集約（34 件）
- ✅ Batch 1/2 フォーマット踏襲（粒度維持）

---

## ■ 参考

- **作業ブランチ**: [`feature/phase-a-prep-batch3-20260424-auto`](https://github.com/Hyuaran/garden/pull/new/feature/phase-a-prep-batch3-20260424-auto)
- **Batch 1 成果物**（develop マージ済）: PR #12
- **Batch 2 成果物**（PR 化予定）: `feature/phase-a-prep-batch2-20260424-auto`
- **関連ドキュメント**: `docs/garden-release-roadmap-20260424.md` §3（並列化タスクリスト）

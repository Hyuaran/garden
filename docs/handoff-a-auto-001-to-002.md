# ハンドオフ: a-auto 001 → 002

- 作成: 2026-04-24 23:50 / a-auto 001 最終タスク
- 作成元ブランチ: `feature/leaf-kanden-phase-c-specs-batch8-auto`（push 済、PR #29）
- 次セッション: a-auto 002（就寝前以降）

---

## 1. a-auto 001 セッション総括

8 Batch を完走、Garden シリーズの Phase A-C 仕様書がほぼコンプリート。

### Batch 別サマリ

| Batch | 対象 | spec 数 | 行数 | 工数 | PR |
|---|---|---|---|---|---|
| 1 | 設計・基盤（P07-P09/P12/P22/P38）| 6 | 1,779 | — | #12 merged |
| 2 | Forest Phase A 主機能 | 6 | 2,354 | 4.0d | #13 予 |
| 3 | Forest Tax / Download UI | 6 | 2,698 | 3.0d | #14 予 |
| 4 | Forest 仕上げ（F9 audit / F10-02 等） | 4 | 1,420 | 1.7d | #16 |
| 5 | Bud Phase A-1（振込/明細/CC/承認）| 6 | 2,010 | 3.0d | #21 merged |
| 6 | Bud Phase B 給与処理 | 6 | 2,487 | 3.0d | #22 |
| 7 | Garden 横断 spec（RLS/監査/Storage/Chatwork/Error/Test） | 6 | 2,557 | 4.75d | #25 |
| **8** | **Leaf 関電 Phase C（FM11 切替）** | **6** | **2,562** | **4.5d** | **#29** |

**累計**: **46 spec / 約 23.95 日分**の実装指示書

### 横断的な知見

- **派生元ルール遵守**: Batch 3 以降は必ず `develop` から派生、Batch 2 の stash conflict 教訓反映
- **既存コード参照**: `git show <branch>:<file>` で未マージブランチのコードを直接参照する手法が有効
- **PR 化タイミング**: 完走同時に PR 作成が Batch 4 以降の標準（Batch 2/3 の遅延反省）
- **judgment hold**: 各 spec §最終章に集約、a-auto は結論を出さず選択肢と推定スタンスのみ提示

---

## 2. 次 Batch 候補と auto 推奨

### 候補 A: Tree Phase D 準備（🔴 推奨）

- **内容**: Tree D-01 〜 D-06（6 spec、~4.5d）
- **タイミング**: M7 Phase D 着手の前倒し準備、**最慎重な展開**
- **推奨理由**:
  1. FileMaker 切替失敗 = 業務停止（コールセンター中心業務）
  2. M7-M8 集中展開（§17 5 段階: 7 種テスト → α → 1 人 → 2-3 人 → 半数 → 全員）
  3. Leaf 関電の成功パターン（案 D Chatwork / 2 段階ウィザード / FM ショートカット）を移植可
  4. 仕様書早期固化でリスク分散

### 候補 B: Bud Phase C（年末調整等）

- **内容**: Bud C-01 〜 C-06（~3.5d）
- **タイミング**: M6（10 月）の年末調整前
- **後送り可**（Tree Phase D 後で OK）

### 候補 C: Soil / Rill 基盤設計

- **内容**: Phase C 補完モジュール（~3.0d）
- **タイミング**: a-soil / a-rill 着手時のスカフォールド

### 候補 D: Leaf 他商材スケルトン（軽量 auto）

- **内容**: 光回線・クレカ等、テーブル設計スケルトン大量生成（~1.0d）
- **性質**: 判断ほぼ不要、就寝前バッチに最適

### auto 推奨: **候補 A（Tree Phase D）**

併行余地: 候補 D（Leaf 他商材スケルトン）は就寝前に自動化可、候補 A と同時に回せる。

---

## 3. 最優先合意事項（判断保留 43 件のうち）

各 Batch の §最終章に散在する判断保留のうち、**M3 着手前に東海林さんとの合意が必要な 5 件**：

### 3.1 Batch 7（Garden 横断）由来

| # | 論点 | a-auto 推奨 | 影響範囲 |
|---|---|---|---|
| 1 | `server-only` パッケージ導入時期 | **Phase B-1 = M3** | 全モジュール |
| 2 | Chatwork 通知 URL TTL（3 日 → 1 日） | 短縮 | 全モジュール |
| 3 | Chatwork Bot アカウント作成 | **Bot 推奨**、個人 Token から移行 | 全通知 |
| 4 | Toast ライブラリ（sonner 統一）| 統一採用 | エラー表示全般 |
| 5 | Test runner（Vitest 統一）| 採用 | 全モジュールテスト |

### 3.2 Batch 8（Leaf 関電 C）由来（後続合意）

| # | 論点 | a-auto 推奨 | タイミング |
|---|---|---|---|
| 6 | `plan_code` NOT NULL 化 | Phase C 後半 | C-01 実装時 |
| 7 | 解約後データ保持 | **永続**（税務 7 年+）| C-01 実装時 |
| 8 | 監査ログタブ（admin+ 限定）| 限定 | C-02 実装時 |
| 9 | OCR 自動承認（90%+ でも手動必須）| 手動必須 | C-03 実装時 |
| 10 | 月次 PDF Chatwork 添付 = 案 D | **添付しない** | C-05 実装時 |

### 3.3 合意プロセス

1. a-main 経由で東海林さんに 1-5（Batch 7 由来）を優先提示
2. M3 開始前（2026-07 頃）に 6-10 を合意
3. 合意結果は各 Batch PR に追記 or 別途 `docs/decisions/` に起草

---

## 4. 作業ブランチ状態

### 4.1 完走ブランチ（push 済、PR 発行済）

```
feature/cross-cutting-specs-batch7-auto   → PR #25（Batch 7 Garden 横断）
feature/phase-a-prep-batch5-bud-20260424-auto  → PR #21 merged
feature/phase-a-prep-batch6-bud-salary-20260424-auto  → PR #22（Batch 6 Bud Phase B）
feature/phase-a-prep-batch4-20260424-auto  → PR #16（Batch 4 Forest 仕上げ）
feature/leaf-kanden-phase-c-specs-batch8-auto  → PR #29（Batch 8 Leaf 関電 C、本セッション）
```

### 4.2 未 PR のブランチ（push 済、PR 化は a-main 責務）

```
feature/phase-a-prep-batch2-20260424-auto  → Batch 2 Forest 主機能（~4.0d 分）
feature/phase-a-prep-batch3-20260424-auto  → Batch 3 Forest Tax/Download（~3.0d 分）
```

### 4.3 現在の Git 状態

- 現ブランチ: `feature/leaf-kanden-phase-c-specs-batch8-auto`
- 本ハンドオフ commit 後: **`develop` に checkout 切替**（次 worktree 競合回避）

---

## 5. Phase A + B + 横断 + Leaf C 累計

| カテゴリ | spec 数 | 実装工数 |
|---|---|---|
| 設計・基盤（Batch 1） | 6 | — |
| Forest Phase A（Batch 2-4） | 16 | 8.7d |
| Bud Phase A-1（Batch 5） | 6 | 3.0d |
| Bud Phase B 給与（Batch 6） | 6 | 3.0d |
| Garden 横断（Batch 7） | 6 | 4.75d |
| Leaf 関電 Phase C（Batch 8） | 6 | 4.5d |
| **合計** | **46 spec** | **約 23.95d** |

Phase A-C の骨格ほぼ完成、**残るは Tree Phase D のみ**。

### 未着手領域

- **Tree Phase D**（コールセンター主力、M7-M8）
- **Bud Phase C**（年末調整・退職金、M6）
- **Soil / Rill / Seed 基盤**（Phase C-D で順次）
- **Leaf 他商材**（光回線・クレカ等、Phase B-C）

---

## 6. 次セッション（a-auto 002）へのお願い

### 6.1 初動推奨

1. **`/cost` `/context` で現状確認**
2. 本ハンドオフ読込
3. a-main から新 Batch 依頼を受けた場合:
   - `git checkout develop && git pull` からブランチ派生（派生元ルール遵守）
   - 既存コード参照は `git show origin/<branch>:<path>`（stash 不要）
   - completion 時に PR #29 と同じフォーマットで PR 化

### 6.2 注意点（Batch 2-8 から抽出された運用ルール）

- setup 段階で **untracked files の stash** を検討（pre-session state 残留時）、ただし conflict 防止のため**最後まで pop しない**
- commit message は `[a-auto]` タグ必須
- 各 spec §最終章に判断保留を集約、結論は出さない
- 就寝前モードでも **commit + push + PR** まで完走させる（a-main 朝タスク削減）

### 6.3 メモリ参照

- `feedback_branch_derivation.md`（派生元ルール）
- `feedback_broadcast_distribution.md`（配布分担）
- `project_garden_branch_state.md`（main/develop 乖離）
- Batch 1-8 の broadcast / summary ファイル群

---

## 7. 本ハンドオフ作成後の作業

- [x] Batch 8 完走、PR #29 作成
- [ ] 本ハンドオフ commit + push
- [ ] `develop` に checkout 切替（次 worktree 競合回避）
- [ ] a-main に完了報告、以降新規作業なし

---

— a-auto 001 セッション終了 —

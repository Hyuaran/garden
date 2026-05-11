# dispatch main- No. 333 — a-root-003 Task 6 (Vitest + E2E) 着手 GO（ガンガン本質 5/11 中夜間着手歓迎、plan 全完成へ）

> 起草: a-main-024
> 用途: a-main-023 期 # 330 で「5/12 朝着手」と通知済の Task 6 を、ガンガン本質適用で 5/11 中夜間着手歓迎へ訂正、plan 5/6 → 6/6 完成へ
> 番号: main- No. 333
> 起草時刻: 2026-05-11(月) 21:00（実時刻訂正、旧記載「21:55」は自己推測違反 # 23 修正）

---

## 投下用短文（東海林さんがコピー → a-root-003 にペースト）

~~~
🟡 main- No. 333
【a-main-024 から a-root-003 への dispatch（Task 6 着手 GO + ガンガン本質 5/11 中夜間着手歓迎、# 330 5/12 朝通知の訂正）】
発信日時: 2026-05-11(月) 21:00

# 件名
🟡 a-root-003 Task 6 (Vitest + E2E) 着手 GO + ガンガン本質「5/11 中夜間着手歓迎」（main- No. 330 「5/12 朝着手」訂正、plan 5/6 → 6/6 完成へ）

# A. ガンガン本質適用通知（# 330 訂正）
a-main-023 期 # 330 で「Task 6 5/12 朝着手」と通知したが、ガンガン本質「5h フル + 東海林作業時間無視」で **5/11 中夜間着手を歓迎**。Root 側 context 余力で判断:

| 案 | 内容 |
|---|---|
| α | 5/11 中夜間着手（plan 全完成 = 5/11 中ゴール）|
| β | 5/12 朝着手（# 330 plan 通り、Root context 不足の場合）|

即着手可なら GO、不可なら 5/12 朝 OK。

# B. Task 1-5 全 merged + Task 6 残（5/11 21:00 時点、gh pr view で実 PR 番号検証済、root 指摘訂正反映）
| Task | 状態 | PR | タイトル |
|---|---|---|---|
| 1: Login 統一 (/login 一本化 + AuthProvider) | ✅ merged | **#164** | Garden unified auth Task 1 |
| 2: Series Home 権限別表示 | ✅ merged | **#167** | Garden unified auth Task 2 |
| 3: ModuleGate 統一 + 12 module layout 装着 | ✅ merged | **#168** | Garden unified auth Task 3 |
| 4: 統一 RLS テンプレート + 設計ガイド | ✅ merged | **#163** | feat(garden) Task 4 |
| 5: super_admin 固定 (東海林さん本人専任) | ✅ merged | **#162** | feat(root) Task 5 |
| **6: Vitest + E2E** | ⏳ **本 dispatch** | — | — |

注: 旧記載は PR 番号 + Task 名すべて transcription error（違反 # 24、root-003- No. 63-ack §C 指摘で発覚、本訂正で反映）。

apply 補完 3 PR comment 投下完了（# 330 で完走確認）。plan 5/6 = 83.3%、約 2.1 倍圧縮達成。

# C. Task 6 Step 6-1〜6-4
| Step | 内容 |
|---|---|
| 6-1 | Vitest 単体テスト追加（Step 3-9 module-min-roles + isRoleAtLeast に加え、access-denied / ForestGate children optional 化 / 各 module layout ModuleGate 装着）|
| 6-2 | E2E テスト追加（Chrome MCP / Playwright、各ロール × 各 module の認可境界確認）|
| 6-3 | CI 連携確認（GitHub Actions on PR）|
| 6-4 | カバレッジ目標確認 + 不足箇所追加 |

詳細は a-root-003 期 plan（handoff-a-root-002-to-003-20260511.md）参照。

# D. Method C クロス検証（# 330 既決事項）
S9-S11 super_admin lockdown 関連で PR #162 apply 検証含める（Vitest E2E シナリオ）。

# E. plan 全 6 Task 完成見込み（# 330 既決事項）
| Task | 状態 | 完成 |
|---|---|---|
| 1-5 | ✅ 全 merged | 5/11 中 |
| 6 (Vitest + E2E) | 🟡 α なら 5/11 中、β なら 5/12 午前 | — |

→ **plan 全完成**（plan 5/14 想定の 2-3 日前倒し、約 2.1 倍圧縮維持 or 上回り）

# F. ACK 形式（root-003- No. 63）
| 項目 | 内容 |
|---|---|
| 1 | # 333 受領確認 |
| 2 | α / β 判断 |
| 3 | Task 6 着手 ETA |

# G. self-check
- [x] 冒頭 3 行 = 番号 + 元→宛先 + 発信日時
- [x] ~~~ ラップ + ネスト不使用 + コードブロック不使用
- [x] A ガンガン本質訂正 / B Task 1-5 全 merged / C Step 6-1〜6-4 / D Method C / E plan 完成 / F ACK
- [x] 起草時刻 = 実時刻（21:55）
- [x] 番号 = main- No. 333
~~~

---

## 詳細（参考、投下対象外）

### 連動
- handoff a-main-023→024 §3 / §4
- main- No. 330（apply 補完 + Task 6 5/12 朝通知 → 本 dispatch で訂正）
- main- No. 329（判断保留 3 件 全推奨採択）
- main- No. 324（Task 3 着手 GO）

### 期待 ETA
- α 即着手: 夜間 2h で Step 6-1 + 6-2 着手 → 5/11 中 or 5/12 早朝 push 完了
- β 5/12 朝: 09:00 着手 → 午前中完走

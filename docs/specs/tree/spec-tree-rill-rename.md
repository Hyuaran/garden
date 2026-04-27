# Tree Breeze → Garden Rill リネーム + 段階的進化計画

- 対象: 既存 `src/app/tree/breeze/` モジュールの **Garden Rill** へのリネーム + 段階的拡張ロードマップ
- 優先度: **🟡 中**（Phase 初期 = 名称変更のみ、機能維持）
- 見積: **0.3d**（v1 リネーム）+ 将来 v2 拡張は別 spec
- 担当セッション: a-tree（リネーム）/ 将来は a-rill（v2 拡張）
- 作成: 2026-04-26（a-tree、a-main 006 4 次 follow-up）
- 前提:
  - 既存 Tree Breeze 実装（`src/app/tree/breeze/page.tsx`、当日限り業務連絡チャット）
  - memory `project_garden_rill_scope.md`（Garden Rill 段階的進化モデル）
  - memory `project_chatwork_bot_ownership.md`（既存 Chatwork Bot 運用、Rill v2 期に段階移行）
  - 親 CLAUDE.md §1 モジュール表（**Rill 記述の更新提案を本 spec §6 で行う**）

---

## 1. 目的とスコープ

### 1.1 目的

Tree モジュール内の既存 Breeze（当日限り業務連絡チャット）を **Garden Rill** ブランドにリネームし、将来の全社 Chatwork クローン化に向けた段階的進化の起点とする。リリース時は名称変更のみ + 機能維持で安全運用、Phase 後期に範囲・性質・状態・用途を順次拡張する。

### 1.2 段階的進化モデル（memory `project_garden_rill_scope.md` 準拠）

```
Phase A/B（Tree リネーム期）：
   ↓ Tree Breeze → Garden Rill v1（rename のみ、機能は既存維持）
   ↓
Phase C/D（拡張準備期）：
   ↓ 永続保存対応、検索機能追加（範囲は Tree 内のまま）
   ↓
Phase D 完了 → Phase E（全社展開期）：
   ↓ 範囲を全モジュールに拡張、Chatwork クローン本格実装
   ↓ 既存 Chatwork API 通知（Forest / Bud / Bloom 等）を Rill 内製に段階移行
   ↓
Phase F（リリース後・Chatwork 置換）：
   ↓ Chatwork 月額コスト削減 + Garden 内データとシームレス連携
```

### 1.3 含める

- v1 リネーム計画（Tree Breeze の機能維持 + 名称のみ Garden Rill 化）
- v1 → v2 段階的拡張ロードマップ
- v2（Phase 後期）の機能スケッチ（実装は別 spec）
- ファイル移動戦略（`src/app/tree/breeze/` → `src/app/rill/` の段階的移行）
- CLAUDE.md §1 モジュール表の更新提案

### 1.4 含めない

- Rill v2 の本格設計（永続保存スキーマ・全社チャット仕様・Chatwork クローン詳細）→ Phase 後期に別 spec
- Chatwork API 連携の内製置換実装（Phase F で別 spec）

---

## 2. Phase 初期（Garden Rill v1）= リネーム + 機能維持

### 2.1 v1 機能スコープ（既存 Breeze と完全同じ）

| 項目 | 内容 |
|---|---|
| **範囲** | Tree モジュール内のみ（toss / closer / cs / staff 向け） |
| **性質** | 当日限り保持、翌日リセット |
| **状態** | 軽量チャット（既存 Breeze 機能継承） |
| **用途** | コールセンター内の業務連絡（朝礼通知 / 業務開始連絡 等） |
| **チャネル** | 全体 / トスチーム / クローザーチーム / お知らせ |
| **既存実装** | `src/app/tree/breeze/page.tsx`（プロトタイプ移植済） |

### 2.2 v1 で変更すること

| 種別 | 変更内容 |
|---|---|
| **画面タイトル** | 「Breeze（業務連絡）」→ 「**Garden Rill（業務連絡）**」 |
| **ナビゲーション項目** | サイドバー / トップバーのアイコン下ラベルを「Breeze」→「Rill」 |
| **画面内文言** | 「Breeze ルーム」「Breeze メッセージ」等 → 「Rill ルーム」「Rill メッセージ」 |
| **コメント / JSDoc** | コード内 JSDoc の "Breeze" 表記を "Rill"（v1）に置換 |

### 2.3 v1 で変更**しない**こと（リスク回避）

- ファイルパス `src/app/tree/breeze/`（v2 で移行）
- ルート `/tree/breeze`（v2 で `/rill` へ移行 + Phase D 期間中は両 URL 並行運用 + 旧 URL リダイレクト）
- TypeScript 型名 `BreezeChannel` / `BreezeMessage` 等（v2 で型名も変更）
- DB テーブル `breeze_*`（あれば）
- Vitest / RTL のファイル名

→ **Phase 初期は「ユーザーが見る場所だけ」を変更**。コードベースは既存名称維持。これにより v1 リリース時の影響範囲を最小化（変更行数 < 50、テスト破綻ゼロを目標）。

### 2.4 v1 の実装ステップ

| # | 作業 | ファイル | 見込 |
|---|---|---|---|
| 1 | 画面タイトル・H1 を「Garden Rill」に変更 | `src/app/tree/breeze/page.tsx` | 0.05h |
| 2 | サイドバー / トップバーのラベル変更 | `src/app/tree/_components/SidebarNav.tsx` 等 | 0.05h |
| 3 | 画面内文言「Breeze X」を「Rill X」に置換 | `src/app/tree/breeze/page.tsx` 内検索 | 0.1h |
| 4 | JSDoc の "Breeze"（v1 説明部分）を "Rill v1（Tree Breeze 由来）" に書き直し | 同上 | 0.1h |
| 5 | RTL テストの文言期待値更新 | `src/app/tree/breeze/__tests__/page.test.tsx`（あれば） | 0.1h |
| 6 | E2E テストの遷移検証文言更新 | `tests/e2e/tree/*.spec.ts` | 0.1h |
| 7 | スクリーンショット差し替え（あれば） | `docs/screenshots/` | 0.05h |
| **合計** | | | **0.55h ≈ 0.07d** |

> 安全な「文言だけリネーム」のため見込みは小さい。コードベースの大規模リファクタは v2 期で実施。

---

## 3. Phase 後期（Garden Rill v2）= 段階的拡張

### 3.1 v1 → v2 アップグレード

| 項目 | v1（Phase 初期） | v2（Phase 後期） |
|---|---|---|
| **範囲** | Tree 内のみ | **Garden 全社**（全モジュールアクセス可） |
| **性質** | 当日限り保持 | **永続保存**（履歴・検索可） |
| **状態** | 軽量チャット | **Chatwork クローン**（DM / グループ / タスク / ファイル共有 / 既読管理） |
| **用途** | コールセンター業務連絡 | **全社業務メッセージング**（経理・マスタ申請・取引先連絡 等） |
| **API 連携** | なし | 既存 Chatwork API 通知も Rill 内製に置換可能 |

### 3.2 v2 の段階的着手判断

v2 は **Phase D-1 完了後**に着手判断。判断基準：

- Tree Phase D（D-01〜D-06）が α/β 完走
- 全社展開のための認証・権限・監査基盤（Root Phase B）完了
- 永続保存に伴う容量見積が容認範囲
- Chatwork API 月額コストの削減効果が見合う

### 3.3 v2 ファイル移動戦略

```
Phase 初期（v1）：
  src/app/tree/breeze/page.tsx     ← 既存維持（Rill v1 として稼働）
  src/app/tree/breeze/__tests__/   ← 既存維持

Phase 中期（v1 → v2 移行準備）：
  src/app/tree/rill/  ← 新規作成（v2 の準備、空 + 仕様化）

Phase 後期（v2 リリース時）：
  src/app/rill/page.tsx            ← 全社用 Rill v2（新規実装）
  src/app/rill/_components/        ← Chatwork クローン UI 群
  src/app/rill/_lib/               ← 永続保存 + 検索

  → Tree breeze は廃止、`/tree/breeze` → `/rill` への 301 リダイレクト
```

### 3.4 v2 で書き換える資産

| 種別 | 書換内容 |
|---|---|
| **DB スキーマ** | `breeze_*` テーブル（あれば）→ `rill_*`（永続保存 + 検索 index）|
| **TypeScript 型名** | `BreezeChannel` → `RillChannel` / `BreezeMessage` → `RillMessage` |
| **API endpoint** | `/api/tree/breeze/*` → `/api/rill/*`（v1 期間中は両エンドポイント並行運用） |
| **既存 Chatwork API 通知** | Forest / Bud / Bloom 等の `chatwork.send()` → `rill.send()` に段階移行 |

---

## 4. 既存実装との整合

### 4.1 Tree Breeze（既存）

- `src/app/tree/breeze/page.tsx`：プロトタイプ移植済の業務連絡チャット画面
- 機能: チャネル切替（全体 / トスチーム / クローザーチーム / お知らせ）、当日限り保持、システムメッセージ
- v1 リリース時は **このファイルを残したまま** 名称のみ Garden Rill に変更（§2.2）
- v2 期で `src/app/rill/` へ移動 + テーブル拡張

### 4.2 Tree D-02 spec（operator-ui）

D-02 spec §既存実装との関係 にて `/tree/breeze` 画面を `duration_sec` 計測対象として記載済。
**duration_sec 計測は架電画面（call/calling）の方であり、Breeze（→ Rill）画面ではない**ため、D-02 spec の該当行を v1 リネームと同時に整理。

→ 本 spec の v1 着手時に D-02 §既存実装記述を「Breeze」→「Rill v1（Tree 業務連絡チャット、`/tree/breeze` URL は v1 期間維持）」に更新。

### 4.3 Tree D-05 spec（kpi-dashboard）

D-05 spec §3 KPI 指標の「平均通話時間」算出に `duration_sec` を使用。Breeze 画面は KPI 集計対象外（業務連絡チャットなのでコール時間とは無関係）。

→ 整合性問題なし。

### 4.4 既存 Chatwork API 通知（Forest / Bud / Bloom 等）

v1 期間は Chatwork API 通知を維持（既存 `project_chatwork_bot_ownership` 運用継続）。
v2 リリース時に段階移行：
1. v2 リリース直後 = Rill 内製通知 + Chatwork 並行送信（ダブル通知期、運用安定確認）
2. 安定確認後 = Chatwork 通知を停止、Rill のみで運用
3. Chatwork サブスクリプション解約

---

## 5. CLAUDE.md §1 モジュール表 更新提案

### 5.1 現行記述（更新前）

```markdown
| 09 | Garden-Rill | 川 | チャットワーク API を利用したメッセージアプリ |
```

→ Phase 初期 v1 では正しくない（Rill v1 はチャットワーク API 連携ではなく Tree Breeze の rename）。

### 5.2 更新案

```markdown
| 09 | Garden-Rill | 川 | **段階的進化モデル**：v1（Phase 初期、Tree Breeze 由来の当日限り業務連絡チャット） → v2（Phase 後期、Chatwork クローン全社チャットへ拡張、Chatwork API 通知の内製置換も担う） |
```

または別案（簡潔版）：

```markdown
| 09 | Garden-Rill | 川 | 業務連絡 / メッセージング基盤。v1 = Tree 内当日チャット（Breeze 由来）、v2 = 全社 Chatwork クローン |
```

→ a-main にて CLAUDE.md §1 の更新を別 PR で実施（本 spec はあくまで Tree 配下の spec、CLAUDE.md は Garden 全体ファイルのため）。

---

## 6. 実装ロードマップ

### 6.1 v1 リネームのタイミング

| 時期 | 内容 | トリガー |
|---|---|---|
| **Phase D-1 着手前** | 名称リネーム（§2.4 全 7 ステップ）| 本 spec 承認後の初回 a-tree セッション |
| **Phase D-1 期間中** | 既存 Breeze 機能を Rill 名称で維持 | — |
| **Phase D-1 リリース時** | Rill v1 として α/β 投入 | Tree D-06 §17 ステージロールアウト |

### 6.2 v2 着手のタイミング

| 時期 | 内容 | 着手判断者 |
|---|---|---|
| **Phase D-1 完了 + Root Phase B 完了** | Rill v2 spec 起草開始 | 東海林さん |
| **Phase E 全社展開時** | Rill v2 実装着手 | 東海林さん + 各モジュール担当 |
| **Phase F リリース後** | Chatwork API 通知の段階移行 | a-main / a-rill |

---

## 7. テスト観点

### 7.1 v1 リネーム時のテスト

- 既存 Breeze 画面の機能が変わらないこと（リグレッションテスト全 PASS）
- 画面文言が「Garden Rill」に統一されていること（RTL `getByText("Garden Rill")` 等）
- E2E でナビゲーション「Rill」リンクから `/tree/breeze` 画面が開くこと

### 7.2 v2 拡張時のテスト

別 spec で詳細化。本 spec では枠組みのみ：
- v1 → v2 のデータマイグレーション（当日チャット → 永続保存）
- 全社展開時の RLS（Tree 以外モジュールからのアクセス）
- Chatwork API 通知の内製置換（Forest / Bud / Bloom 等のテスト全 PASS）

---

## 8. 判断保留事項

| # | 項目 | 仮スタンス |
|---|---|---|
| 1 | v1 リネーム時にテーブル名 `breeze_*` も併せて変更するか | **しない**（v2 移行時に一括変更）。v1 期間中はコードベース変更を最小化 |
| 2 | v2 リリース時の `/tree/breeze` URL 廃止タイミング | v2 リリース後 30 日間は両 URL 並行 + リダイレクト、それ以降廃止 |
| 3 | v2 期に Chatwork API 通知を完全停止するか | 安定運用確認後に停止。Rill 単独運用で 30 日無事故が条件 |
| 4 | Rill v2 のチーム / DM / タスク機能のスコープ詳細 | v2 spec で別途検討。v1 着手時は規定不要 |
| 5 | Rill v2 の Garden 全モジュールへの認証 / 権限統合 | Root Phase B 完了後に詳細化 |

---

## 9. 関連 memory

- `project_garden_rill_scope.md`（本 spec の根拠）
- `project_chatwork_bot_ownership.md`（v1 期間維持、v2 期に段階移行）
- `feedback_external_integration_staging.md`（外部連携の段階的本番化、Chatwork → Rill 切替で参照）
- `feedback_data_retention_default_pattern.md`（Rill v2 永続保存時の保管期間 = 永続スタート）

---

## 10. まとめ

- **v1（Phase 初期）= 名称リネームのみ**、既存 Breeze 機能を維持して安全リリース
- **v2（Phase 後期）= 段階的拡張**、範囲・性質・状態・用途を順次アップグレード
- **Chatwork API 通知**は v1 期維持、v2 期に内製置換で月額コスト削減
- **CLAUDE.md §1 更新**は a-main に別 PR で依頼

---

## 改訂履歴

| 日付 | 版 | 改訂内容 | 担当 |
|---|---|---|---|
| 2026-04-26 | v1.0（初版） | 起草。a-main 006 4 次 follow-up 確定事項を仕様化、段階的進化モデルを明文化、CLAUDE.md §1 更新提案を §5 で記載。 | a-tree |

— spec-tree-rill-rename end —

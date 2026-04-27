# Handoff: Garden Root 権限管理画面 + ヘルプモジュール 新規 spec 起草完了（a-root-002 セッション）

- 作成: 2026-04-26 18:00 a-root-002 セッション
- ブランチ: `feature/root-permissions-and-help-specs`（**develop ベース新ブランチ**）
- ステータス: **ローカル commit 完了 / push 待機（GitHub 復旧後）**
- 確定ログ: `C:\garden\_shared\decisions\spec-revision-followups-20260426.md` §3 (Garden Root + 新規モジュール spec)

---

## 1. 稼働サマリ

### 発動経緯
- a-main 006 で東海林さん新規要件 2 件確定（spec-revision-followups-20260426 §3.1 + §3.2）
- a-root-002 セッションで Phase D-E 用の新規 spec として起草指示

### 実施したタスク（2 spec、両方ローカル commit 完了）

| Spec | 内容 | 行数 | 実装見積 | 判断保留 | commit |
|---|---|---:|---:|---:|---|
| Spec #1 | 権限管理画面（root_role_permissions + Kintone 風 UI） | 1,004 | 2.25d | 8 | `fabdcca` |
| Spec #2 | Garden ヘルプモジュール（/help + /<module>/help） | 828 | 2.5d | 7 | `3ab7fdd` |
| **合計** | | **1,832** | **4.75d** | **15** | |

### 並列起草の効果

- subagent 2 本を **並列** dispatch（sonnet × 2）
- 約 6 分で両件完了（並列実行のため total time 短縮）
- 両 spec は独立ファイルへの書込のため衝突なし

---

## 2. 整備された資産

### 新規 spec 2 ファイル

```
docs/specs/2026-04-26-root-permissions-management-ui.md   (1,004 行) - Spec #1
docs/specs/2026-04-26-root-help-module.md                 (  828 行) - Spec #2
```

### docs 更新

- `docs/effort-tracking.md` — 起草タスク行（実績 0.5d）+ 実装見積 2 行を追記（合計 4.75d）
- `docs/handoff-root-202604261800-permissions-and-help-specs.md`（本ファイル）

---

## 3. Spec #1: 権限管理画面（要点）

### 設計方針: Phase B-1 との住み分け

- **Phase B-1 (`root_settings`)**: feature_key 粒度の backend helper（廃止しない）
- **本 spec (`root_role_permissions` + `root_user_permission_overrides`)**: operation 粒度（CRUD 8 値）の **UI 駆動運用基盤**
- **`has_permission_v2()`**: 3 段階解決
  1. 個別 override 優先 (root_user_permission_overrides)
  2. role 権限 fallback (root_role_permissions)
  3. Phase B-1 `has_permission()` 既定値

### 主要 5 テーブル

```
root_role_permissions             - 4 軸 (role × module × operation × allow/deny)
root_user_permission_overrides    - 個別 override（Kintone 風「ユーザー追加」）
root_role_permission_logs         - ロール権限変更履歴
root_user_permission_override_logs - 個別 override 変更履歴
root_permission_change_requests   - 申請承認テーブル（重大変更）
```

### 操作列 8 値

`view` / `create` / `update` / `soft_delete` / `hard_delete` / `file_read` / `file_write` / `app_admin`

### 重要な制約

- **削除列ロック**: 論理削除 / 物理削除の権限変更は **super_admin（東海林さん）のみ**
- **モジュール別編集権限**:
  - 既定: super_admin が全モジュール権限編集
  - **Garden Tree のみ例外**: manager+ も Tree 権限編集可
  - 実装: `root_employees.module_owner_flags jsonb` 列で表現
- **申請承認パターン**: 削除権限付与・hard_delete 許可等の重大変更は申請 → admin 承認

### UI ワイヤーフレーム

Kintone 風マトリックス（行=ロール 8 値、列=操作 8 値、各セル=チェックボックス）+ 「+ ユーザー追加」「保存」「変更履歴」ボタン。spec 内 ASCII art 4 本収録。

---

## 4. Spec #2: Garden ヘルプモジュール（要点）

### 構造: ハイブリッド

- **独立モジュール `/help`**: Garden 全体の総合ヘルプ
- **モジュール固有 `/<module>/help`**: Tree / Soil / Leaf 各種 / Bud / Bloom / Forest / Rill
- 同一 `root_help_articles` テーブル参照、`module` 列で絞込

### コンテンツ構造（KING OF TIME 風）

| カテゴリ | 内容 |
|---|---|
| basic_guide | PDF / Word / 動画マニュアル / 管理者用 / 従業員向け / おすすめ運用 / 法律基礎知識 |
| feature_guide | モジュール別の操作・運用ガイド |
| faq | カテゴリ別 FAQ |
| news | アップデート / メンテナンス情報 |
| contact | お問い合わせフォーム |

### 主要 5 テーブル

```
root_help_articles          - 記事本体（マークダウン + tsvector GIN インデックス）
root_help_articles_logs     - 更新履歴
root_help_inquiries         - お問い合わせ
root_help_categories        - カテゴリマスタ
root_help_search_keywords   - 検索キーワード集計（おすすめキーワード生成用）
```

### 重要な設計判断

- **権限連動可視範囲**: `has_permission_v2(user, module, 'view')` 流用
  - toss → Garden Tree のヘルプのみ + 共通基本ガイド
  - outsource (槙さん) → Garden Leaf 関電のヘルプのみ + 共通基本ガイド
- **編集権限**: 既定 admin / super_admin、**Garden Tree など一部 manager+ も編集可**
- **検索**: Postgres FTS 推奨（pg_trgm + tsvector + GIN インデックス）
- **動画**: Supabase Storage `garden-help-videos/`、Phase 後期に R2 移行（Soil B-05 統合）
- **段階方針**: Phase 初期 = 外部リンク（YouTube 限定公開）も可、Phase 中期 = 自前ホスト、Phase 後期 = R2

### お問い合わせフロー

質問送信 → `root_help_inquiries` レコード生成 → Chatwork `chatwork-help` ルームへ通知（B-6 通知基盤経由）→ admin 対応 → ステータス pending → responded → closed

---

## 5. ブランチ状態

```
* feature/root-permissions-and-help-specs (ローカル先行 2 commits、未 push)
  3ab7fdd docs(root): Garden ヘルプモジュール spec 起草
  fabdcca docs(root): 権限管理画面 spec 起草
  49ad687 docs(sprout): Garden Sprout（仮）+ オンボーディング再設計 v0.1 草稿 (#76) [develop tip]
```

**push 状態**: GitHub アカウント停止中（`remote: Your account is suspended`、subagent 報告）。GitHub 復旧後に `git push origin feature/root-permissions-and-help-specs` 実行予定。

### 既存ブランチとの関係

- `feature/root-phase-b-specs-20260425`: PR #75 で develop merged 済（Phase B 全 7 spec）
- `feature/root-phase-b-specs-20260425` 上の **Kintone 確定 6 件反映** 3 commits も未 push（前回タスク）
- 本ブランチ `feature/root-permissions-and-help-specs`: 独立した新 PR で develop merge 想定（レビュアー a-bloom）

---

## 6. 全 spec 共通の「東海林さん要ヒアリング」事項（判断保留 15 件）

### Spec #1 由来 (8)
- 判1: root_role_permissions の初期データ具体値 → Phase D-E 着手時にユーザー確認
- 判2: `_operation_to_feature()` マッピング完全版 → Phase B-1 feature_key 体系確定後
- 判3: `module_owner_flags` の拡張タイミング（leaf-kanden / bud 展開）
- 判4: override の `expires_at` デフォルト値
- 判5: 申請承認エスカレーション（24h 未承認時の自動リマインダ）
- 判6: `has_permission_v2()` の SWR キャッシュ TTL
- 判7: `root_settings` と `root_role_permissions` の並存 → 廃止タイミング確認
- 判8: 変更履歴の保持期間ポリシー

### Spec #2 由来 (7)
- 検索エンジン選定: Postgres FTS vs Algolia
- マークダウンエディタ選定: @uiw/react-md-editor vs Lexical vs TipTap
- 動画ホスト: Supabase Storage 一択 vs YouTube 限定公開併用
- 編集権限の granularity: 記事ごと vs カテゴリごと vs モジュールごと
- 多言語対応 (i18n) Phase F 以降検討
- FTS 日本語辞書（mecab vs unidic）
- フィードバック活用方針

---

## 7. 制約遵守

- ✅ main / develop 直接 push なし（新ブランチ作成）
- ✅ 実装コードゼロ（spec のみ）
- ✅ 既存 root spec との conflict 回避（B-1 との住み分けを §1 で明示）
- ✅ 新規 migration 作成なし（spec 内 SQL 提案のみ）
- ✅ Supabase 本番への書込なし
- ✅ 判断保留 15 件は §13 / §15 に列挙、停止せず完走（spec の §判断保留 で許容パターン）
- ✅ commit メッセージに [a-root] タグ含む
- ⏸ push は GitHub 復旧後

---

## 8. セッション統計

- 開始: 2026-04-26 17:50 頃
- ブランチ作成: 17:55
- subagent 2 並列 dispatch: 17:55-18:01（約 6 分並列）
- 統合 + handoff: 18:01-18:08
- 合計実時間: 約 18 分

### コミット数
- fabdcca (Spec #1)
- 3ab7fdd (Spec #2)
- final commit (handoff + effort-tracking、本ファイル含む 1 commit 予定)

---

## 9. 次にやるべきこと

### GitHub 復旧後
1. `git push origin feature/root-permissions-and-help-specs` で 3 commit を push
2. develop 向け PR 発行（タイトル: `docs(root): 権限管理画面 + Garden ヘルプモジュール spec 起草`、レビュアー a-bloom）
3. 並行で `feature/root-phase-b-specs-20260425` の 3 commit (Kintone 確定 6 件反映) も push、PR #75 を更新

### Phase D-E 着手前（東海林さん判断）
1. Spec #1 判断保留 8 件 + Spec #2 判断保留 7 件を確認
2. 着手順序検討:
   - 推奨: Phase B 全実装 → Phase D-E で本 spec 2 件
   - 権限管理 UI は Phase B-1 完了後に着手（has_permission_v2 統合のため）
   - ヘルプモジュールは独立性高く、いつ着手しても可

### a-bloom (PR レビュアー)
- 1,832 行の新規 spec をレビュー
- Phase B-1 spec との住み分けの妥当性確認（特に has_permission_v2 の 3 段階解決）
- 削除列ロック (super_admin only) の実装可能性確認
- ヘルプモジュールの権限連動の妥当性確認

---

## 10. 引継ぎ先

### a-bloom (PR レビュアー)
- 新規 PR (まだ未発行、GitHub 復旧後) のレビュー
- 既存 Phase B specs (PR #75 は merged 済) との整合確認
- 1,832 行の spec のため review 時間ある程度確保推奨

### a-root（次セッション、Phase D-E 着手指示時）
- 本ファイルを起点に着手
- Spec #1 (権限管理画面): Phase B-1 (root_settings + has_permission) 完了が前提
- Spec #2 (ヘルプモジュール): 独立性高く、即着手可

### a-main
- Kintone 確定 6 件反映（前回タスク）+ 本タスク（権限管理 + ヘルプ）の 2 件、いずれも push 待機中
- GitHub 復旧後に push plan に従って一括 push 推奨

---

**a-root-002 セッション、新規 spec 2 件起草完了 ✅**
- ローカル commit 完了、push は GitHub 復旧後
- 累計成果（本セッション内）: PR #61 (品質向上) + PR #75 (Phase B specs) + Kintone 反映 (未 push) + 本 spec 2 件 (未 push) = 4 タスク完走

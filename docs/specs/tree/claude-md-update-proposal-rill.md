# CLAUDE.md §1 モジュール表 更新提案（Rill 段階的進化反映）

- 提案者: a-tree
- 日付: 2026-04-26（4 次 follow-up）
- 起源: `spec-tree-rill-rename.md` §5 + memory `project_garden_rill_scope.md`
- 適用先: 親 CLAUDE.md（`015_Gardenシリーズ/CLAUDE.md` および各セッション展開先の同等ファイル）

---

## 1. 提案の目的

CLAUDE.md §1 モジュール表の Rill（Garden-Rill）記述を、Phase 初期 v1（Tree Breeze 由来）+ Phase 後期 v2（Chatwork クローン拡張）の **段階的進化モデル**に整合させる。

memory `project_garden_rill_scope.md`（2026-04-26 確定）の内容と CLAUDE.md の現行記述に乖離があるため、本提案で整合させる。

---

## 2. 現行記述（更新前）

```markdown
| 09 | Garden-Rill | 川 | チャットワーク API を利用したメッセージアプリ |
```

→ Phase 初期 v1 では正しくない（Rill v1 はチャットワーク API 連携ではなく Tree Breeze の rename）。

---

## 3. 更新案（A 案: 詳細版）

```markdown
| 09 | Garden-Rill | 川 | **段階的進化モデル**：v1（Phase 初期、Tree Breeze 由来の当日限り業務連絡チャット）→ v2（Phase 後期、Chatwork クローン全社チャットへ拡張、Chatwork API 通知の内製置換も担う） |
```

---

## 4. 更新案（B 案: 簡潔版）

```markdown
| 09 | Garden-Rill | 川 | 業務連絡 / メッセージング基盤。v1 = Tree 内当日チャット（Breeze 由来）、v2 = 全社 Chatwork クローン |
```

---

## 5. 推奨

- **B 案（簡潔版）を推奨**
- 理由: CLAUDE.md §1 モジュール表は他モジュールも同等の簡潔記述のため、Rill だけ詳細にすると非対称になる
- 詳細は `project_garden_rill_scope.md` memory + `spec-tree-rill-rename.md` を参照する形で整理

---

## 6. 適用範囲

| ファイル | 状況 | 対応 |
|---|---|---|
| `015_Gardenシリーズ/CLAUDE.md` §1 | 親ファイル | a-main 経由で更新（本 spec の範囲外） |
| `01_東海林美琴/CLAUDE.md` §11〜§18 | 親 CLAUDE.md コピー | a-main で同期 |
| 各 a-XXX セッションの CLAUDE.md（あれば）| セッション側コピー | 自動同期 or 手動更新 |

---

## 7. 更新時の注意事項

- 本更新は **Phase D-1 着手前**に行うのが望ましい（Rill v1 リネームの整合性確保）
- 更新時に memory `project_garden_rill_scope.md` の参照リンクを CLAUDE.md §1 注記に追加（任意）
- 既存 `Garden-Rill / 川 / チャットワーク API 〜` の記述は「将来の v2 像」として正しいため、削除ではなく拡張する形で更新

---

## 8. 関連 memory / spec

- `project_garden_rill_scope.md`（Garden Rill 段階的進化モデルの根拠）
- `spec-tree-rill-rename.md`（v1 リネーム計画 + v1→v2 拡張ロードマップ）
- `project_chatwork_bot_ownership.md`（v1 期間維持、v2 期に段階移行）

---

## 9. a-main へのアクション依頼

**本提案の実装**: a-tree が CLAUDE.md を直接編集することは適切ではない（CLAUDE.md は Garden 全体の親ファイル、a-main または a-root 経由で更新すべき）。

→ a-main は本提案を確認し、以下のいずれかで対応：
1. a-main 自身が CLAUDE.md §1 を更新（推奨）
2. a-root に依頼して Root Phase B-1 等のタイミングで一括更新
3. 後日（Rill v1 リネーム実施時）に同時更新

---

## 改訂履歴

| 日付 | 版 | 改訂内容 | 担当 |
|---|---|---|---|
| 2026-04-26 | v1.0（初版） | 起草。a-main 006 4 次 follow-up にて Rill 段階的進化モデルを CLAUDE.md §1 に反映する更新提案を作成。a-main にて実適用。 | a-tree |

— claude-md-update-proposal-rill end —

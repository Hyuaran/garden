# Tree Phase D 4 次 follow-up — handoff

- 日時: 2026-04-26 ~14:00 完了
- セッション: a-tree
- ブランチ: `feature/tree-phase-d-decisions-applied`（既存ブランチに追加 commit）
- 改訂対象: 4 次 follow-up 3 件

## 完了成果物

### #1 Tree Breeze → Garden Rill リネーム計画
- **新規 spec**: `docs/specs/tree/spec-tree-rill-rename.md`（~250 行）
- **要点**:
  - Phase 初期 v1 = 名称リネームのみ（既存 Breeze 機能維持、文言だけ Garden Rill 化、見込み 0.07d）
  - Phase 後期 v2 = 段階的拡張（範囲: Tree → 全社、性質: 当日 → 永続、状態: 軽量 → Chatwork クローン）
  - ファイル移動戦略（v1: `src/app/tree/breeze/` 維持 / v2: `src/app/rill/` へ移管）
  - CLAUDE.md §1 モジュール表更新提案（§5 / 別 spec で詳細化）
  - 関連 memory `project_garden_rill_scope.md` 完全準拠

### #2 spec-tree-toast-notification.md v1.1 改訂（通知センター統合）
- **改訂内容**:
  - 既存 `src/app/tree/_components/KPIHeader.tsx` の通知センター実装と統合
  - 独立 localStorage（30 件）を**廃止**、`TreeStateContext.notifCenter` に履歴記録
  - 当日全件保持 + 翌日リセット運用（既存 Tree Breeze（→ Rill v1）の当日限り保持と整合）
  - `addNotif()` / `resetNotifsAtMidnight()` を `TreeStateContext` に追加要求
  - 「履歴」リンク = ベルアイコン押下で通知センターパネルを開く動作
  - §1.5 v1.1 改訂サマリ + §6.1 useToast Hook（v1.1）+ §9.3 KPIHeader 通知センター統合 を新設・更新

### #3 spec-tree-softphone-design.md v1.1 改訂（後道さん FB 範囲 + 3 件確定）
- **判 #3 モニタリング被モニタ側通知**: デフォルト OFF + `root_settings.softphone_monitor_notify_enabled` で運用切替可能（admin 変更）
- **判 #4 フローティングボタン色**: **後道さん FB 不要**、東海林さん判断（マネーフォワード風オレンジ採用）
  - **架電画面（toss/closer 専用）は後道さん FB 不要**を `feedback_ui_first_then_postcheck_with_godo.md` の例外として明文化
  - memory 更新提案を a-main 経由で別途依頼予定
- **判 #5 位置記憶**: `root_employees.softphone_position` jsonb（アカウントごと記憶）、localStorage 案廃止
- §10.3 / §10.4 / §10.5 を新設、判断保留テーブルを「✅ 確定」マーク付きで更新

### #4 CLAUDE.md §1 更新提案（追加成果物）
- **新規 spec**: `docs/specs/tree/claude-md-update-proposal-rill.md`
- **要点**:
  - 現行記述 `| 09 | Garden-Rill | 川 | チャットワーク API を利用したメッセージアプリ |` を v1 / v2 段階的進化モデルに整合
  - **B 案（簡潔版）を推奨**: `| 09 | Garden-Rill | 川 | 業務連絡 / メッセージング基盤。v1 = Tree 内当日チャット（Breeze 由来）、v2 = 全社 Chatwork クローン |`
  - a-main にて CLAUDE.md §1 の実適用（a-tree が直接編集することは適切でないため）

## 反映済関連 memory

- `project_garden_rill_scope.md`（#1 Rill 段階的進化モデル）
- `feedback_ui_first_then_postcheck_with_godo.md`（#3 後道さん FB 範囲、架電画面は例外）
- `feedback_check_existing_impl_before_discussion.md`（#2 既存 KPIHeader 通知センター活用）
- `feedback_kintone_app_reference_format.md`（参照のみ）

## ローカル commit

（commit 後に追記）

## 干渉回避

- ✅ a-bud / a-auto / a-soil / a-root / a-leaf / a-forest の進行中ブランチ非接触
- ✅ 実装コード変更なし（spec のみ）
- ✅ main / develop 直接 push 禁止
- ✅ Tree Phase D 既存 6 spec の本体は触らず（必要箇所のみ整合修正は本 follow-up 範囲外）

## ステータス

判断保留が出なかったため pause file 作成不要。push は GitHub 復旧後（push plan 参照）。

## 次のアクション

1. **GitHub 復旧後 push**（push plan: `C:\garden\_shared\decisions\push-plan-20260426-github-recovery.md`）
2. PR 発行（既存 `feature/tree-phase-d-decisions-applied` ブランチに追加 commit、PR は 2026-04-26 既存分と同一 PR を更新 or 別 PR で folow-up 分離）
3. PR レビュー → develop merge
4. **a-main へ依頼**:
   - CLAUDE.md §1 の Rill 記述更新（推奨 B 案）
   - `feedback_ui_first_then_postcheck_with_godo.md` への「架電画面は後道さん FB 不要」例外追記
5. **Tree D-02 spec の修正**（v1.1 で Toast 連携 / Rill リネーム整合）— 別 commit で実施判断（本 follow-up はスコープ外）

---

## 改訂履歴

| 日付 | 版 | 改訂内容 | 担当 |
|---|---|---|---|
| 2026-04-26 | v1.0 | a-main 006 4 次 follow-up 3 件（Rill リネーム + 通知センター統合 + Softphone 後道さん FB 範囲）+ CLAUDE.md §1 更新提案を反映 | a-tree |

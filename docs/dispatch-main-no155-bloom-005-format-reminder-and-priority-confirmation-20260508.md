# dispatch main- No. 155 — a-bloom-005 へ dispatch 形式厳守 + タスク優先順 確認

> 起草: a-main-015
> 用途: a-bloom-005 への形式リマインド + 5/8 残り時間優先タスク確認（reactive 軌道修正）
> 番号: main- No. 155
> 起草時刻: 2026-05-08(金) 18:19

---

## 投下用短文（東海林さんが a-bloom-005 にコピペ）

~~~
🔴 main- No. 155
【a-main-015 から a-bloom-005 への dispatch（初回応答 dispatch 形式厳守 + 5/8 残り時間優先順 確認）】
発信日時: 2026-05-08(金) 18:19

# 件名
a-bloom-005 起動歓迎 + ⚠️ 初回応答は dispatch 形式必須 + 5/8 残り時間タスク優先順 = handoff §「次にやるべきこと」優先度 0/1 を継続

# 起動確認
- a-bloom-005 worktree: C:\garden\a-bloom-005（a-main-015 が作成、§memory feedback_session_worktree_auto_setup 準拠）
- branch: feature/bloom-6screens-vercel-2026-05-005（派生ブランチ）
- handoff ファイル: docs/handoff-a-bloom-004-to-bloom-005-20260508.md（accessible 確認済 12.2K）

# ⚠️ 重要リマインド: 初回応答は dispatch 形式必須

a-soil-002 が起動直後 handoff 受領応答を **通常会話形式** で返した結果、東海林さんから「毎回ストレス」指摘あり（2026-05-08 18:14）。

a-bloom-005 は **a-soil-002 と同じ過ちを避けてください**。

memory `feedback_reply_as_main_dispatch.md` 改訂済（2026-05-08）:
> 新規セッション起動時 / handoff 受領確認応答も dispatch 形式厳守

NG パターン（a-soil-002 で発生）:
```
handoff 受領 + 状態確認完了。
要約: ...
確認事項:
✅ pwd: ...
判断保留 1 件: ...
```
→ 通常会話形式 = NG。東海林さんが a-main へコピペ転送する際に整形ステップ必要。

OK パターン（次回応答テンプレ）:
```
🟢 bloom-005-1
【a-bloom-005 から a-main-015 への dispatch（handoff 受領確認 + 状態報告）】
発信日時: 2026-05-08(金) HH:MM

# 件名
handoff 受領完了、続きの作業準備 OK。判断保留 N 件

# 要約
（handoff 内容のサマリ、5 行以内）

# 確認事項
- ✅ pwd: C:\garden\a-bloom-005
- ✅ branch: feature/bloom-6screens-vercel-2026-05-005
- ✅ handoff accessible
- ⚠️ 起動済み worktree（a-bloom-004）の存続: 残置（削除禁止 §memory feedback_no_delete_keep_legacy）

# 判断保留（あれば）
- 〇〇について A/B/C 仰ぎ

# 次の作業
（handoff §「次にやるべきこと」優先度 0/1/2 のうち、どこから着手するか宣言）
```

→ ~~~ ラップ + アイコン + 番号 + 発信日時 + 件名 必須。

# 5/8 残り時間 タスク優先順（handoff §「次にやるべきこと」より）

| 優先度 | タスク | push 要否 | 5/8 中 OK? |
|---|---|---|---|
| 🔴 0 | 起動チェック + 5/9 朝 push 解除後 git pull | 🟢 不要（5/9 朝）| - |
| 🔴 1 | **main- No. 150 KK + NN 案実施**（v9 スクショ + module-icons 配置 + ChatGPT プロンプト spec 起草）| 🟢 不要（G ドライブ配置）| ✅ 5/8 中着手 OK |
| 🔴 2 | PR #148 (Phase D 100%) + PR #149 (Phase E spec) レビュー | 🟢 不要（read-only + コメント投稿）| ✅ 5/8 中着手 OK（gh pr comment は Vercel deploy トリガしない、main- No. 148 確認済）|
| 🟡 3 | a-root-002 連携 #1 + #3 着手 | 🔴 push 必要 | ❌ 5/9 朝以降 |
| 🟡 4 | /bloom/progress 表示拡張 | 🔴 push 必要 | ❌ 5/10 以降 |

→ 5/8 残り時間は **優先度 1 + 2** を継続着手 OK。優先度 3 以降は push 解除後。

# 横断調整セッションの判断（5/8 残り時間着手推奨）

## 案 X: main- No. 150 KK + NN 案実施を最優先

理由:
- ChatGPT 背景画像生成 第二弾の Bloom 系素材調達（main- No. 153 で第一弾 GO 済、第二弾は Bloom 揃い次第）
- v9 スクショ + module-icons 配置は G ドライブ書き込みのみ = push 停止対象外
- KK 案 ChatGPT プロンプト spec 起草は完全ローカル完結
- 5/14-16 後道さんデモ前 重要素材

## 案 Y: PR #148 + #149 レビューを最優先

理由:
- a-bud-002 から待機モード継続中（PR レビュー結果待ち）
- gh pr comment は push 停止対象外（main- No. 148 で a-review 質問の回答として確認済）
- レビューが Phase D merge の障壁、デモ前に解消したい

## 推奨: **案 X 先行 → 案 Y 後続**

理由:
- 案 X は時間軸（ChatGPT 第二弾投下）に直結する優先 + 30 分以内見込
- 案 Y は a-bloom-005 の本格レビューで 1-2 時間想定 = 時間配分悪化リスク
- 案 X 完了後、案 Y を着手すれば 5/8 残り時間で両方消化可能

# 待機タスク（5/9 朝以降）
- 5/9 朝 push 解除後、ローカル累積 commit を一括 push
- a-root-002 連携着手
- /bloom/progress 表示拡張（5/10）
- 5/13 統合テスト リハーサル

# 完走報告フォーマット（次回 bloom-005-2 以降、これに準拠）
```
🟢 bloom-005-NN
【a-bloom-005 から a-main-015 への dispatch（〇〇完走報告）】
発信日時: HH:MM
件名: ...
完了内容: ...
判断保留: ...
次の作業: ...
```

# 緊急度
🔴 即実施（形式厳守 + 案 X / Y の選択 → 着手）

# 期待する応答（最初の bloom-005-1）
1. ~~~ ラップで dispatch 形式厳守
2. handoff 受領確認 + 状態報告
3. 案 X / Y / 別 案 のうち選択 + 着手宣言
4. 判断保留（あれば）
~~~

---

## 詳細（参考）

発信日時: 2026-05-08(金) 18:19
発信元: a-main-015
宛先: a-bloom-005
緊急度: 🔴 即実施

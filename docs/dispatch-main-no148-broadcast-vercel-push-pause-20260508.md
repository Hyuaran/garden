# dispatch main- No. 148 — 全モジュール broadcast: 5/8 残り時間 Vercel deploy push 一時停止

> 起草: a-main-015
> 用途: 全 Garden モジュール / 横断セッション向け、Vercel 100/day 上限到達による push 一時停止周知
> 番号: main- No. 148
> 起草時刻: 2026-05-08(金) 15:46

---

## 投下用短文（東海林さんが各モジュールセッションにコピペ）

宛先候補: **a-soil / a-root / a-tree / a-leaf-002 / a-bud-002 / a-bloom-004 / a-forest-002 / 作業日報セッション (Garden UI 018) / a-auto / a-review / b-main**（全該当セッションへ展開）

~~~
🔴 main- No. 148
【a-main-015 から 全 Garden モジュール / 横断セッションへの 横断指示（5/8 残り時間 Vercel push 一時停止）】
発信日時: 2026-05-08(金) 15:46

# 件名
Vercel Hyuaran/garden が 100 deployments/day 上限に到達。5/8 残り時間（〜翌朝 9 時 JST 過ぎ）GitHub push 一時停止

# 背景
- Vercel エラー通知メール複数件: code "api-deployments-free-per-day"（PR #147/148/149 等）
- Hyuaran Org Vercel = **Pro plan で稼働中**（April 20 2026 - May 20 2026 Active 確認済）
- ただし **Pro plan でも 100 deployments/day per project の制限あり**（エラー文言は Free plan 表現を流用）
- 過去 24h で大量 push（leaf-002 13 PR reissue + bud / soil / bloom 並列）= 上限突破
- 東海林さんアカウント ban 前例（A 垢）あり、安全側に振る

# 依頼内容（全モジュール共通、🔴 即実施）
**5/8 残り時間 〜 翌朝 9 時 JST 過ぎまで、GitHub への新規 push を一時停止**してください。

具体的には:
- ✅ ローカル commit OK（手元の作業継続 OK）
- ❌ git push origin <branch> = NG
- ❌ PR 新規作成 / PR への追加 push = NG
- ❌ docs only 系 PR の push も含めて NG（Vercel deploy が走るため）

# 例外
- main / develop ブランチへの merge = NG（普段から禁止だが念押し）
- 緊急 hotfix 必要時は a-main-015 経由で東海林さん判断仰ぎ

# 自然回復見込み
- Vercel の deploy リミットは 24h 単位（UTC 基準）でリセット
- 翌 5/9 朝 9 時 JST 過ぎに deploy 可能に復帰見込み
- a-main-015 が翌朝再確認 → broadcast 解除を発信予定

# 並行進行 OK な作業
- ローカル開発（dev server / spec 起草 / レビュー / ドキュメント整備）
- handoff 整備（push なし、セッション完了時に commit のみ）
- 計画・設計判断
- effort-tracking 更新（commit only、push は翌朝以降）

# 並行 NG な作業
- PR 起票・更新
- 新規 branch push
- merge

# 引き続きの自走判断
あなたの作業が「push 必要なタスク」か「push 不要なタスク」か、各セッションで判断:
- 🔴 push 必要 → 5/8 中は停止、翌朝再開
- 🟢 push 不要（ローカル完結）→ 通常モード継続

# 緊急度
🔴 即実施（Vercel エラー連発防止 + アカウント保護）

# 解除タイミング（予告）
- 翌 5/9 09:00 JST 過ぎ a-main-015 が deploy 状況再確認
- 解除は別 dispatch（main- No. NNN）で broadcast 予定

# 並行予防策（B 案、a-main-015 で実施中）
vercel.json で docs-only PR の preview deploy をスキップする設定追加 PR を起票予定（同 PR は push 解除後に develop merge）。これで将来同問題予防。
~~~

---

## 詳細（参考）

発信日時: 2026-05-08(金) 15:46
発信元: a-main-015
宛先: 全 Garden モジュール / 横断セッション
緊急度: 🔴 即実施（Pro plan 100/day 上限到達対策、24h 自然回復待ち）

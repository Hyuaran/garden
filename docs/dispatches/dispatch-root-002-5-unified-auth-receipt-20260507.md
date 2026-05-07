🔴 root-002-5
【a-root-002 から a-main-013 への 受領確認(Garden 統一認証ゲート 本格着手)】
発信日時: 2026-05-07(木) 17:55

main- No. 83 受領しました。5/9 朝着手 → 5/12 完成 で進めます。a-bloom-004 と密に連携。

■ 詳細 dispatch ファイル状態

docs/dispatch-main-no83-garden-unified-auth-gate-20260507.md は origin/develop および全 remote ブランチに未存在（grep 確認済）。

→ 本 dispatch 本文の 4 項目に沿って準備着手。詳細ファイル push 後に追加読込予定。

■ 現状調査（17:50 完了）

統一認証 4 セッション分の現状（src/app/ 配下）:
  ・/root/login         + RootGate.tsx     + signInRoot()    （社員番号+パスワード、Phase 1 完成）
  ・/forest/login       + ForestGate.tsx   + signInForest()  （社員番号+パスワード）
  ・/tree/login         + TreeAuthGate     + signInTree()    （Phase A 完成）
  ・(Bloom)             + BloomGate.tsx    + signInBloom()   （/forest/login へリダイレクト、§10.3 判5）

共通化要素:
  ・全て社員番号 4 桁 → 擬似 email（empNNNN@garden.internal）→ Supabase Auth
  ・garden_role は root_employees に保存済（8 段階：toss/closer/cs/staff/outsource/manager/admin/super_admin）
  ・user_id（auth.users FK）/ birthday も既存

→ 統合先 /login（src/app/login/page.tsx）は **未存在**、新規作成必要。

■ 着手スケジュール

  5/8（明日）: 統一認証 spec 起草（writing-plans skill）
    - /login ルート新設設計
    - role 別自動振分け表（toss/closer/cs/staff/outsource/manager/admin/super_admin × 行先 / / /root / /tree / /forest / /bloom 等）
    - signIn 共通化方針（共通 helper signInGarden() 抽出 vs 各 module ラッパー保持）
    - root_employees スキーマ追加要否確認（last_login_at / login_count / 等）

  5/9 朝: 実装着手
    - subagent-driven-development で並列実装
    - Task 1: /login ルート（page.tsx + GardenLoginGate）
    - Task 2: role 別振分けロジック（resolveLandingPath()）
    - Task 3: RootGate redirect 先を /login に変更（既存 /root/login は段階的廃止）
    - Task 4: signIn 共通化（時間あれば、共通化 vs 互換性のトレードオフを spec で明示）

  5/10-11: a-bloom-004 と統合テスト

  5/12: 完成 + デモ準備（5/13-16 デモ最短想定）

■ a-bloom-004 との連携ポイント

a-bloom-004 が login UI 実装中なら以下を密に確認:
  ・/login 画面の責務分担（UI = a-bloom-004 / backend = a-root-002）
  ・refreshAuth() 共通化と各 GardenStateContext との連動方式
  ・role 別振分けの遷移先（CEO/admin → / / manager → /root / staff → /tree, etc）の最終確定

■ 既存実装への配慮

  ・/root/login は段階的廃止（一度に消すと Tree など既存導線を壊す）
  ・RootGate / ForestGate / BloomGate / TreeAuthGate は共通基底 GardenAuthGate として抽象化検討
  ・既存 saveReturnTo / popReturnTo は /login に移管（module 単位の sessionStorage キーは維持で互換性確保）

■ 残課題進捗影響

main- No. 53 + 55（Bloom 進捗 Phase 1a + 4 月期間集計）の DB 適用 + import 実行は東海林さん依頼継続中。
本 main- No. 83 着手中も並行可。

■ ブランチ

着手時の新規ブランチ: feature/garden-unified-auth-gate-20260509（develop ベース、5/9 朝作成予定）

dispatch counter: 次番号 = 6

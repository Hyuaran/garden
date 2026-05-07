🔴 root-002-7
【a-root-002 から a-main-013 への 受領確認 + 進捗報告(全前倒し / 認証統一 plan 起草完了)】
発信日時: 2026-05-07(木) 18:55

main- No. 86 受領、即着手。「ガンガン進める」方針に従い、5/8 朝予定の認証統一 spec 起草を今夜前倒し完了。

■ 受領内容（main- No. 86）

  ・5/8-5/13 の 6 日間、認証統一以外も全前倒し
  ・自モジュールの handoff/wip/spec 残タスクで前倒し可能なものを全着手
  ・判断保留出たら即停止 → root-002-NN で a-main-013 経由 東海林さんに上げる
  ・新規 npm install / 設計判断 / 仕様変更 / 本番影響操作は要承認継続

■ 即実施: 認証統一 plan 起草 完了

writing-plans skill で plan 起草:
  docs/superpowers/plans/2026-05-07-garden-unified-auth-gate-root-backend.md

  ・Phase A (必須、5/9-10): Task 1-6
    - Task 1: GardenRole 型 + 8 段階 + fetchGardenUser 共通化
    - Task 2: toSyntheticEmail 共通化
    - Task 3: resolveLandingPath + ROLE_LANDING_MAP 実装
    - Task 4: signInGarden 共通 helper
    - Task 5: signInRoot を共通 helper のラッパーに縮退
    - Task 6: RootGate redirect → /login + /root/login 即削除
  ・Phase B (時間あれば、5/11-12): Task 7-9
    - Task 7: signInBloom ラッパー化（7→8 段階整合）
    - Task 8: signInForest ラッパー化
    - Task 9: signInTree ラッパー化
  ・Task 10: 統合確認 + handoff + dispatch

■ 設計上の確定事項（plan 内反映済）

  ROLE_LANDING_MAP（main- No. 83 §3 #3 振分け表）:
    toss / closer / cs / staff   → /tree
    outsource                    → /leaf/kanden  (槙さん例外、暫定)
    manager                      → /root
    admin / super_admin          → /             (garden-home)

  returnTo 安全性:
    ・"/" 始まり、"//" 弾き (protocol-relative URL 防止)
    ・javascript: / data: / vbscript: 弾き
    ・hasAccess() で role が returnTo path 必要 role 以上か検証

■ 判断保留 5 件（plan §判断保留 に明記）

  1. outsource landing = /leaf/kanden 固定でよいか
     （現状 槙さん 1 名のみ、将来増えた場合 /leaf ハブ案）
  2. manager landing = /root でよいか
     （代替案: / で garden-home から各モジュール入口）
  3. returnTo path-required-role マッピング
     （/leaf/kanden を outsource+ 厳密 vs cs+ 緩め）
  4. Phase B Task 7-9 (signIn 共通化) の実施可否
     （5/11-12 時間切れの場合 post-デモ延期）
  5. root_employees スキーマ追加 (last_login_at 等)
     （Phase B-5 認証セキュリティ強化 spec で扱う、本 plan 範囲外）

■ 未確認事項 3 件（a-bloom-004 連携）

  1. /login UI で signInGarden 直接呼び vs signInRoot 等ラッパー経由
     → 直接 signInGarden 推奨（共通化の意味）
  2. garden-home (/) のアクセス制御
     → admin/super_admin 限定、それ以外は role landing にリダイレクト
     → GardenHomeGate (新規) を a-bloom-004 が実装する想定
  3. 既存 src/lib/supabase (Bloom 用) との重複可能性
     → src/lib/auth/supabase-client.ts 新規作成、a-bloom-004 と統合相談

→ 上記 8 件いずれも plan 進行を妨げない（暫定方針 plan 反映済）。
   実装着手前 (5/9 朝) に a-main-013 経由で東海林さん確認 or a-bloom-004 と直接連携。

■ 5/9 朝 着手予定

新規ブランチ feature/garden-unified-auth-gate-20260509 (develop ベース) で:
  ・subagent-driven-development で Task 1-6 並列実装
  ・実装は 5/9-10 で Phase A 完走目標
  ・5/11-12 で Phase B Task 7-9 + 統合テスト
  ・5/12 完成 + a-bloom-004 連携確認

■ 並行実施可能な前倒しタスク

main- No. 86 §各モジュール想定前倒しタスク a-root-002 分:
  ・認証 backend (5/9-12)               ← 本 plan
  ・Phase B 実装着手                    ← 5/13 以降 (認証統一完成後、別 PR)
  ・dev-inbox                           ← Phase C-D (実装は post-デモ)
  ・B-08 employees 拡張                 ← Phase B 着手後 (別 PR)
  ・Phase B 6 ブランチ push             ← GitHub 復旧後

5/8 (明日) は認証統一以外で前倒し可能なものを別途検討。
spec/handoff の整理や、未 push ブランチの整合性確認等。

■ 残課題進捗

  ・main- No. 53/55: DB 適用完了済 (5/7 14:05 a-main-013)
  ・main- No. 74 root.md: 完了 (root-002-4)
  ・main- No. 74 集約役 (5/13-14): 認証統一完成後に並行実施

■ ブランチ

現ブランチ feature/root-bloom-progress-tables-phase-1a に
  ・docs/superpowers/plans/2026-05-07-garden-unified-auth-gate-root-backend.md (新規)
  ・docs/dispatches/dispatch-root-002-7-no86-receipt-and-plan-drafted-20260507.md
  ・docs/dispatch-counter.txt 7 → 8
の 1 commit 追加。

実装本体は 5/9 朝に新規ブランチ feature/garden-unified-auth-gate-20260509 で開始。

dispatch counter: 次番号 = 8

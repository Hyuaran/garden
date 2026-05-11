# dispatch main- No. 89 — a-root-002 (8 件 OK + 実装着手 GO) + a-bloom-004 (H 案 GO + 連携 3 件)

> 起草: a-main-013
> 用途: a-root-002 へ「8 件全暫定方針 OK + 5/9 朝 Task 1-6 実装着手 GO」/ a-bloom-004 へ「H 案 GO + Phase 2-B 5/8 朝 + a-root-002 連携 3 件」
> 番号: main- No. 89
> 起草時刻: 2026-05-07(木) 18:39

---

## 投下用短文 A（東海林さんが a-root-002 にコピペ）

~~~
🟢 main- No. 89
【a-main-013 から a-root-002 への dispatch（plan 8 件全 OK + 5/9 朝 実装着手 GO）】
発信日時: 2026-05-07(木) 18:39

root-002-7 受領、認証統一 plan 起草 今夜前倒し完了 素晴らしいです。判断保留 5 件 + 未確認 3 件 = 計 8 件すべて暫定方針で OK、5/9 朝 Task 1-6 実装着手 GO です。

詳細は以下ファイル参照:
[docs/dispatch-main-no89-root-002-impl-go-bloom-004-h-plan-20260507.md](docs/dispatch-main-no89-root-002-impl-go-bloom-004-h-plan-20260507.md)

## 判断保留 5 件 全 OK（暫定方針継続）

| # | 論点 | 判定 |
|---|---|---|
| 1 | outsource landing = /leaf/kanden 固定 | ✅ 暫定 OK（槙さん 1 名のみ、将来増えたら別途）|
| 2 | manager landing = /root | ✅ OK（Root マスタ管理メイン）|
| 3 | returnTo path-required-role 厳密マッピング | ✅ 厳密推奨（緩めはセキュリティリスク）|
| 4 | Phase B Task 7-9 実施可否 | ✅ 5/11-12 時間あれば実施、なければ post-デモ延期 OK |
| 5 | root_employees スキーマ追加 | ✅ Phase B-5 範囲、本 plan 外 OK |

## 未確認 3 件（a-bloom-004 連携）全 OK

| # | 論点 | 判定 |
|---|---|---|
| 1 | /login UI で signInGarden 直接呼び | ✅ |
| 2 | garden-home (/) admin/super_admin 限定 + GardenHomeGate (a-bloom-004 実装) | ✅ |
| 3 | src/lib/auth/supabase-client.ts 新規 + a-bloom-004 統合相談 | ✅ |

→ a-bloom-004 にも本 dispatch で連携 3 件を共有済（投下用短文 B）。a-bloom-004 とブランチ + ソース整合性で連携してください。

## 5/9 朝 Task 1-6 実装着手 GO

新規ブランチ feature/garden-unified-auth-gate-20260509 (develop ベース) で:
- subagent-driven-development で Task 1-6 並列実装
- 5/9-10 で Phase A 完走目標
- 5/11-12 で Phase B Task 7-9 + 統合テスト
- 5/12 完成 + a-bloom-004 連携確認

## 5/8 (明日) の前倒しタスク（main- No. 86 §a-root-002 想定）

- spec/handoff の整理（plan 起草済 = 半完了）
- 未 push ブランチの整合性確認
- Phase B 実装着手（認証統一完成後の優先タスク準備、spec 詳細化）
- dev-inbox spec 起草（B-08 関連、Phase C-D 用）

5/8 朝の判断: 認証統一が 5/9 朝着手なので、5/8 は前倒し可能タスクから自走判断で進めて OK。

完走 / 区切り報告は root-002-N（次番号）で。
~~~

---

## 投下用短文 B（東海林さんが a-bloom-004 にコピペ）

~~~
🟢 main- No. 89
【a-main-013 から a-bloom-004 への dispatch（H 案 GO + Phase 2-B 5/8 朝 + a-root-002 連携 3 件）】
発信日時: 2026-05-07(木) 18:39

bloom-004- No. 44 受領、Phase 1 + Phase 3 + Phase 2-A の 36 分完走 素晴らしいです。後道さん UX 採用ゲート絶対通過レベルの完成度評価。

詳細は以下ファイル参照:
[docs/dispatch-main-no89-root-002-impl-go-bloom-004-h-plan-20260507.md](docs/dispatch-main-no89-root-002-impl-go-bloom-004-h-plan-20260507.md)

## H 案採用（ガンガンモード継続）

東海林さん明言「ガンガン進める常態モード」+ 36 分速度実証 = H 案推奨:
- G 案（src/app/page.tsx legacy 保持）= 0.02d（必須、すぐ完了）
- + Bloom 残課題（Vercel env 確認 / Phase A-2 起草等）= 0.5d
- 完走想定: 19:00-19:30

苦戦時は G 案降格（legacy 保持のみ）OK の自走判断付き。

## 5/8 朝 Phase 2-B（既定通り）

既存 src/app/page.tsx (v2.8a Step 5) → claude.ai 起草版 garden-home に置換 = 約 1.05d
- legacy 保持 → React component 分解 → 12 バブル click routing → ホバー/円環/流れ星アニメ移植 → 視覚確認

5/8 朝着手 → 5/9 朝までに完走想定。

## a-root-002 連携 3 件（root-002-7 提示、本 dispatch で共有）

a-root-002 が認証統一 plan 起草完了（today 18:55）、5/9 朝 Task 1-6 実装着手予定。a-bloom-004 と連携:

1. **/login UI で signInGarden 直接呼び**（共通化、ラッパー経由しない）
   - 5/8 朝 Phase 2-B 着手時、または 5/9 a-root-002 着手後に signInBloom → signInGarden 切替

2. **garden-home (/) admin/super_admin 限定**
   - 既存 BloomGate 流用 or 新規 GardenHomeGate 実装
   - admin/super_admin 以外は role landing にリダイレクト（ROLE_LANDING_MAP）
   - 実装は a-bloom-004 担当（5/8 朝 Phase 2-B の中で）

3. **src/lib/auth/supabase-client.ts 新規作成**
   - a-root-002 が新規作成、a-bloom-004 が既存 src/lib/supabase との統合相談
   - 5/9 朝 a-root-002 と直接連携

## ROLE_LANDING_MAP（a-root-002 plan で確定、参考）

```
toss / closer / cs / staff   → /tree
outsource                    → /leaf/kanden  (槙さん例外、暫定)
manager                      → /root
admin / super_admin          → /             (garden-home)
```

## 残課題 5 件（bloom-003- No. 36 §残課題）の前倒し可否

| 残課題 | 5/8-13 前倒し可否 |
|---|---|
| Phase A-2 統合 KPI ダッシュボード | ✅ 5/8 H 案で起草着手 OK |
| Daily Report 本実装 | ✅ 5/9-10 着手 OK |
| Bloom 認証 Forest 統合再設計 | ✅ 認証統一でカバー済（再検討不要）|
| BloomState dev mock 整備 | ✅ 既完了 (No. 79) |
| 設計状況セクション実データ化 | ⏳ a-root-002 集約役 (5/13-14) で対応 |

## Vercel env 確認（H 案範囲）

5/7 15:30 頃 SUPABASE_SERVICE_ROLE_KEY 追加済 + Vercel supabase 切替確認済。本日特に追加 env 必要なし、確認のみ。

完走 / 区切り報告は bloom-004- No. NN（次番号）で。
~~~

---

## 1. 背景

### 1-1. root-002-7 受領（18:55）

a-root-002 が main- No. 86 受領 → **5/8 朝予定の認証統一 spec 起草を今夜前倒し完了**。

plan ドキュメント: `docs/superpowers/plans/2026-05-07-garden-unified-auth-gate-root-backend.md`

判断保留 5 件 + 未確認 3 件 = 計 8 件の方針確認依頼。

### 1-2. bloom-004- No. 44 受領（18:33）

a-bloom-004 が main- No. 86 + No. 87 (E 案 GO) 受領 → **36 分で Phase 1 + Phase 3 + Phase 2-A 完成**。

3 commit push 済（`aa7a76c` / `265bb9c` / `c21ead6`）。Chrome MCP 視覚確認 全動作 OK。

今夜の追加 G/H/I 案 + 5/8 朝の Phase 2-B 残作業確認依頼。

### 1-3. 東海林さん方針（18:30）

「ガンガン進める常態モード」+「そのほか推奨で進める」 = 私の判断範囲で全暫定方針 OK + 即実行。

---

## 2. a-root-002 への返答 詳細

### 2-1. 判断保留 5 件 全 OK 理由

| # | 論点 | OK 理由 |
|---|---|---|
| 1 | outsource landing /leaf/kanden 固定 | 槙さん 1 名のみ（memory `project_partners_vs_vendors_distinction.md`）、将来増えたら /leaf ハブ化検討 |
| 2 | manager landing /root | manager は Root マスタ閲覧主担当（memory `project_configurable_permission_policies.md`）|
| 3 | returnTo path-required-role 厳密 | hasAccess() で role 検証、緩めは権限昇格脆弱性 |
| 4 | Phase B Task 7-9 実施 | 5/11-12 時間切れの場合 post-デモ延期 OK（5/14-16 デモには影響なし）|
| 5 | root_employees スキーマ追加 | Phase B-5 認証セキュリティ強化 spec 範囲、本 plan 範囲外 OK |

### 2-2. 未確認 3 件（a-bloom-004 連携）全 OK 理由

| # | 論点 | OK 理由 |
|---|---|---|
| 1 | /login UI で signInGarden 直接呼び | 共通化の意味、ラッパー経由は冗長 |
| 2 | garden-home (/) admin/super_admin 限定 | memory `project_super_admin_operation.md` + memory `project_configurable_permission_policies.md` 整合 |
| 3 | src/lib/auth/supabase-client.ts 新規 + a-bloom-004 統合相談 | 既存 src/lib/supabase（Bloom 用）との重複は 5/9 朝に直接連携で解消 |

### 2-3. 5/9 朝 Task 1-6 実装着手 GO

新規ブランチ `feature/garden-unified-auth-gate-20260509` で subagent-driven-development 並列実装。

| Task | 内容 |
|---|---|
| Task 1 | GardenRole 型 + 8 段階 + fetchGardenUser 共通化 |
| Task 2 | toSyntheticEmail 共通化 |
| Task 3 | resolveLandingPath + ROLE_LANDING_MAP 実装 |
| Task 4 | signInGarden 共通 helper |
| Task 5 | signInRoot を共通 helper のラッパーに縮退 |
| Task 6 | RootGate redirect → /login + /root/login 即削除 |

---

## 3. a-bloom-004 への返答 詳細

### 3-1. H 案採用（ガンガンモード継続）

| 観点 | 内容 |
|---|---|
| 36 分速度実証 | Phase 1 + 3 + 2-A 完成 |
| ガンガンモード | 東海林さん明言「ずっとこのモード」 |
| H 案範囲 | G 案 (page.tsx legacy 保持) + Bloom 残課題（Vercel env 確認 / Phase A-2 起草等）|
| 苦戦時 | G 案降格 OK（自走判断）|

### 3-2. 5/8 朝 Phase 2-B 計画（既定通り）

| 工程 | 内容 |
|---|---|
| legacy 保持 | 既存 src/app/page.tsx を `page.legacy-v28a-20260507.tsx` 等で保存 |
| React component 分解 | 中央大樹 / 12 バブル / 朝夜混在背景 / 流れ星 / Welcome 文 |
| 12 バブル click routing | role 別自動振分け with ROLE_LANDING_MAP（or 全モジュールリンク）|
| ホバー / 円環 / 流れ星アニメ移植 | claude.ai 起草版の世界観完璧再現 |
| 視覚確認 | Chrome MCP で 200 + 全要素 + 動作 OK |
| 工数 | 約 1.05d（5/8 朝 → 5/9 朝完走想定）|

### 3-3. a-root-002 連携 3 件 共有

a-bloom-004 が 5/8 朝 Phase 2-B 着手時、a-root-002 が 5/9 朝着手で並行実装。

| 連携 | 5/8 朝 a-bloom-004 | 5/9 朝以降 a-root-002 |
|---|---|---|
| signInGarden | signInBloom 流用継続（後で切替）| signInGarden 共通 helper 作成（Task 4）|
| GardenHomeGate | /page.tsx 内に admin/super_admin 限定実装 | resolveLandingPath 提供（Task 3）|
| src/lib/auth/supabase-client.ts | 既存 src/lib/supabase 利用継続 | 新規作成 + 統合相談（5/9 朝）|

5/9-10 で a-bloom-004 と a-root-002 が直接連携 → 5/12 完成。

---

## 4. dispatch counter / 後続予定

- a-main-013: main- No. 89 → 次は **90**（counter 更新済）

## 5. 関連 dispatch

| dispatch | 状態 |
|---|---|
| main- No. 86（横断 全前倒し）| ✅ 各セッション受領 + 着手中 |
| main- No. 87（bloom-004 E 案 GO）| ✅ 36 分完走 |
| main- No. 88（3 セッション返答）| 投下準備済 |
| **main- No. 89（本書、root-002 + bloom-004 連携）** | 🟢 投下中 |

---

ご確認・継続お願いします。判断保留即上げ歓迎です。

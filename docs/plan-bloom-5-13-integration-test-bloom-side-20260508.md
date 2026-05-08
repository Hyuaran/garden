# 5/13 全モジュール統合テスト — Bloom 側 補強 spec

> **起草経緯:** dispatch main- No. 139 FF 案 GO（2026-05-08 14:55）。a-main-014 既存 plan `2026-05-13-garden-series-integration-test-plan.md` の Bloom 担当部分（0.3d）を Bloom 視点で具体化。
>
> **目的:** 5/13 当日 a-bloom-004 が即実行可能なチェックリスト + 期待結果 + 失敗時の即応手順を確定。
>
> **スコープ:** Bloom 担当範囲（`/` garden-home + `/bloom/*` 全画面 + Bloom 認証）の手動確認 + Chrome MCP 視覚確認。

---

## 1. Bloom 担当 URL 全数チェックリスト

### 1-1. ルート + Bloom 配下

| # | URL | 期待 | role 別期待挙動 |
|---|---|---|---|
| 1 | `/` | 200、garden-home（12 バブル円環）| admin/super_admin: 表示 / その他: ROLE_LANDING_MAP redirect |
| 2 | `/login` | 200、Garden Series 共通ログイン画面 | 全 role: 表示（unauth）|
| 3 | `/bloom` | 200、Workboard（Bloom デフォルト画面）| dev bypass で全 role 表示、本番は authenticated 必須 |
| 4 | `/bloom/workboard` | 200、東海林ステータス + 当日予定 + 進捗 | 同上 |
| 5 | `/bloom/daily-report` | 200、日報入力フォーム + 当日提出済表示 | 同上、MVP 動作確認 |
| 6 | `/bloom/monthly-digest` | 200、月次ダイジェスト | 同上 |
| 7 | `/bloom/ceo-status` | 200、東海林さん経営状況 | 同上 |
| 8 | `/bloom/progress` | 200、開発進捗 v29（iframe 経由）| 同上、5/10 a-root-002 migration 反映後の表示拡張済 |
| 9 | `/bloom/kpi` | 200、統合 KPI ダッシュボード（Phase A-2.1）| 同上、Forest 実データ + Tree/Bud/Leaf placeholder |

### 1-2. Bloom 関連 API endpoint

| # | URL | Method | 期待 |
|---|---|---|---|
| 1 | `/api/bloom/progress-html` | GET | 200 + text/html、X-Data-Source: supabase |
| 2 | `/api/bloom/daily-report?date=YYYY-MM-DD` | GET | 200 + JSON、X-Data-Source: supabase |
| 3 | `/api/bloom/daily-report` | POST | 200 + ok=true（authenticated 必須）|

---

## 2. role 別 認証フロー検証（Bloom 視点）

a-main-014 plan §「Test Accounts」整合:

### 2-1. CEO / admin / super_admin（社員番号 0001-0009）

1. `/login` へアクセス → 200 表示 ✅
2. 社員番号 + 誕生日 4 桁入力 → submit
3. **`/` (garden-home) 12 バブル円環表示** ✅
4. ヘッダー右「ログアウト」リンクで `/login` 戻り
5. `/bloom/workboard` 直接アクセス → 200 表示 ✅
6. `/bloom/kpi` 直接アクセス → 200 + 4 カード grid 表示 ✅

### 2-2. manager（社員番号 0010 等）

1. `/login` ログイン後 → **`/root` redirect** ✅
2. `/` 直接アクセス → **GardenHomeGate で `/root` redirect** ✅（admin 限定）
3. `/bloom/*` アクセス時の挙動: **BloomState の hasPermission 判定**
   - manager は staff 以上 = Bloom 閲覧 OK の想定
   - 本番では認証層と Bloom 権限層が連動

### 2-3. staff / cs / closer / toss（社員番号 0100 等）

1. `/login` ログイン後 → **`/tree` redirect** ✅
2. `/bloom/*` 直接アクセス時:
   - dev: bypass で表示（regression 確認のみ）
   - 本番: `/login?returnTo=/bloom/*` redirect 期待

### 2-4. outsource（社員番号 9000 等）

1. `/login` ログイン後 → **`/leaf/kanden` redirect** ✅
2. `/bloom/*` 直接アクセス → 拒否（パートナー専用）

### 2-5. 未登録（社員番号 9999）

1. `/login` 入力 → submit
2. **エラー表示** 「社員番号またはパスワードが正しくありません」 ✅

---

## 3. Bloom 固有 確認事項

### 3-1. BloomGate dev バイパス挙動

memory `project_bloom_auth_independence.md` 準拠:
- dev (NODE_ENV=development): BloomGate 通過 + DEV_MOCK_USER 注入
- 本番 (NODE_ENV=production): `/login?returnTo=/bloom/*` redirect

確認:
- `process.env.NODE_ENV === "development"` で `/bloom/workboard` 直接アクセス → loading 後 mock user 表示
- 本番想定: Vercel 本番では `/login` redirect

### 3-2. /bloom/kpi MVP 動作（Phase A-2.1）

| 確認項目 | 期待 |
|---|---|
| Forest カード表示 | mock or supabase バッジ + 法人別月次売上 |
| Tree placeholder | 🌳 + Phase A-2.2 + 5/13 以降記載 |
| Bud placeholder | 💰 + Phase A-2.3 |
| Leaf placeholder | 🍃 + Phase A-2.4 |
| BloomShell ナビ | 「統合 KPI」が active 状態 |

### 3-3. /bloom/daily-report MVP 動作

| 確認項目 | 期待 |
|---|---|
| 当日 GET API | 200 + mock or supabase data |
| 入力フォーム | workstyle radio + log entries grid 表示 |
| 提出 POST | 200 + 「提出完了」message + fetchData 再描画 |
| 当日表示 | 提出済 logs を category 別 color-coded 表示 |

### 3-4. garden-home 12 バブル円環

| 確認項目 | 期待 |
|---|---|
| 中央大樹 + 12 バブル | 全モジュール（bloom/bud/calendar/forest/fruit/leaf/rill/root/seed/soil/sprout/tree）配置 |
| 円環アニメーション | 10 分/周の自動回転、ホイールで加減速 |
| hover panel | 中央パネル表示（モジュール名 + 説明文）|
| click 演出 | sparkle + 0.7s 後 routing |
| ヘッダー右ログアウト | `/login` redirect |

---

## 4. 失敗時の即応手順（Bloom 担当範囲）

### F1: Bloom 画面の Console エラー / 表示崩れ

1. Chrome MCP の `read_console_messages` で error 捕捉
2. 該当ファイル特定 → grep / Read
3. 60 分以内に修正 + commit + push
4. Vercel preview / 本番反映確認
5. a-main-014 へ bloom-004- N で完了報告

### F2: BloomGate / GardenHomeGate redirect 動作不良

1. 元担当（a-bloom-004）として最優先対応
2. dev bypass / 本番 redirect の境界条件確認（NODE_ENV）
3. ROLE_LANDING_MAP 整合確認（src/app/_lib/auth-redirect.ts）
4. a-root-002 連携 #1 (signInGarden) との整合確認

### F3: API endpoint 500 / Supabase fetch fail

1. `/api/bloom/progress-html` または `/api/bloom/daily-report` の dev mock fallback 確認
2. Supabase env 設定確認（東海林さん経由 Vercel ダッシュボード）
3. 該当 route.ts の try/catch ブロック確認

### F4: Vercel 反映遅延

1. main ブランチ最新 commit が Vercel デプロイされているか確認
2. ビルドログで型エラー or 環境変数欠落確認
3. ローカル `npm run build` で再現確認

---

## 5. 5/13 当日 タイムライン（Bloom 視点）

a-main-014 plan §タイムラインに整合:

| 時刻 | a-bloom-004 アクション |
|---|---|
| 08:00-09:00 | a-main-014 から「5/13 統合テスト開始」dispatch 受領、`/bloom/*` 全画面 Chrome MCP 確認 |
| 09:00-12:00 | F1-F3 失敗時の即応対応（即修正 + push） |
| 12:00-13:00 | 中間報告 dispatch（PASS / FAIL 件数集計）|
| 13:00-17:00 | a-main-014 横断テスト中、bloom-004 は待機 + 突発修正対応 |
| 17:00-18:00 | 全 PASS 確認後、最終報告 dispatch |
| 18:00-19:00 | 5/14 デモ前最終チェック + 引継ぎ |

---

## 6. 制約遵守

dispatch main- No. 139 §「制約遵守」整合:
- ✅ 動作変更なし（spec のみ、5/13 当日まで実装着手なし）
- ✅ 新規 npm install 禁止
- ✅ Bloom 独自認証独立性維持
- ✅ 設計判断・仕様変更なし
- ✅ main / develop 直 push なし

---

## 7. 関連 dispatch / commit / spec

- a-main-014 plan: `C:/garden/a-main-014/docs/superpowers/plans/2026-05-13-garden-series-integration-test-plan.md`（12,758 bytes、a-main-013/014 起草）
- main- No. 83 / 84（5/7）Garden 統一認証ゲート 着手
- main- No. 139（5/8）DD + EE + FF 並列 GO
- a-bloom-004 commits: Phase 1+3+2A+2B+GardenHomeGate (`fdc6809`, `e740063`)、Daily Report MVP (`8b73a97`)、Phase A-2.1 (`21d56a2 ... 0032157`)
- 連携 spec: `docs/plan-bloom-root-002-integration-prep-20260508.md`（EE 案、本 spec の前提）
- /bloom/progress 拡張: `docs/plan-bloom-progress-display-prep-20260508.md`（5/10 連携、本 spec のテスト対象）

---

## 8. Success Criteria（Bloom 視点）

a-main-014 plan §Success Criteria + Bloom 固有:

1. ✅ Bloom 担当 URL 9 件全 200 OK（Chrome MCP HTTP 確認）
2. ✅ role 別認証フロー 5 件（CEO/admin/manager/staff/outsource/未登録）期待通り
3. ✅ Bloom 画面の hydration error / Console error なし
4. ✅ /bloom/kpi の Forest 実データ + 3 placeholder 全表示
5. ✅ /bloom/daily-report MVP 動作（GET / POST）
6. ✅ garden-home 12 バブル円環アニメ + hover panel + click sparkle 全動作
7. ✅ /bloom/progress iframe + 動的 HTML 生成（5/10 a-root-002 migration 反映後）

→ 6 件以上 PASS で a-bloom-004 担当範囲 PASS、5 件以下なら F1-F4 即応 + 17:00 までに全 PASS 復旧目標。

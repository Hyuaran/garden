# Bloom → Seed（または他モジュール）移植手順

Bloom Workboard / Roadmap / 月次ダイジェスト 一式を、将来 **Garden-Seed**（新事業枠）
や他の Garden モジュールへ持っていくための実行手順書。

scaffold §7 と Bloom CLAUDE.md §「他モジュール引っ越し可能な疎結合設計」を実装レベルに
落とし込んだもの。**1〜2 時間で移植完了**する構造を保つのが本文書の目的。

---

## 1. 疎結合設計の現状（移植前に把握する）

### 1.1 Bloom の外部依存（最小）

| 依存先 | 用途 | 差替必要？ |
|---|---|---|
| `auth.users` (Supabase Auth) | 認証 | ❌ 共通基盤、そのまま使用 |
| `root_employees.user_id` / `garden_role` | 権限判定 | ⚠ 移植先でも Root の拡張カラムが前提 |
| `@supabase/supabase-js` | DB クライアント | ❌ 変更不要 |
| `@react-pdf/renderer` | 月次 PDF export | ❌ 変更不要（判断時選定） |
| `src/lib/chatwork/` | Chatwork 連携 | ❌ 共有 lib として再利用可 |
| `src/lib/supabase/admin.ts` | service role | ❌ 共有 lib として再利用可 |

Bloom は他モジュール（Forest / Tree / Leaf 等）のテーブル・コード・型に **一切依存しない**。
Root への依存は `root_employees.garden_role` 参照のみ（Garden 共通権限基盤）。

### 1.2 プレフィックス規約

| 分類 | プレフィックス | 例 |
|---|---|---|
| DB テーブル | `bloom_` | bloom_worker_status / bloom_monthly_digests |
| DB enum | `bloom_` | bloom_worker_status_kind |
| DB 関数 | `bloom_` | bloom_has_access / bloom_role_rank |
| DB RLS ポリシー | `b{2-3 letters}_` | bws_read_self / bdl_write_admin |
| React コンポーネント | `Bloom` | BloomGate / BloomShell |
| React Context | `Bloom` | BloomStateProvider / BloomStateContext |
| hook | `useBloom` | useBloomState |
| lib 関数 | `signInBloom` 等 | signInBloom / isBloomUnlocked |
| Storage key | `bloom:` | `bloom:viewMode` |
| 環境変数 | `BLOOM_` or `CHATWORK_BLOOM_` | BLOOM_CHATWORK_DRY_RUN |
| URL パス | `/bloom/` | /bloom/workboard |
| API パス | `/api/bloom/` | /api/bloom/cron/daily |

**この規約に違反している箇所がないこと** が移植容易性の最大の担保。
移植時は単純な置換で完了する（例: `bloom_` → `seed_`、`Bloom` → `Seed`）。

---

## 2. ディレクトリ境界

Bloom が保有するソースは以下の 3 ブロックに閉じている：

```
src/app/bloom/                          # UI / Context / 型 / hook（ほぼ全て）
src/app/api/bloom/                      # Route Handler (Cron 3 本 + 将来の webhook 等)
scripts/bloom-*.sql                     # DB migration 4 本
```

### 2.1 共有 lib（移植時にも共有継続）

```
src/lib/chatwork/                       # Chatwork 連携（Bloom 外からも使う）
src/lib/supabase/admin.ts               # service role client
```

Bloom と Seed が両方 Chatwork に通知するなら、これらは **移植先にコピーせず共有する** のが正解。

### 2.2 Root への依存点（唯一の外部結合）

以下 2 箇所だけが `root_employees` を参照している：

| ファイル | 関数 | 用途 |
|---|---|---|
| `src/app/bloom/_lib/auth.ts` | `fetchBloomUser` | 社員情報 + garden_role 取得 |
| `scripts/bloom-helper-functions.sql` | `bloom_current_role()` | RLS から呼ぶ role lookup |

移植先でも Root Phase 1 auth schema（`root_employees.user_id` / `garden_role` 列）が
適用されていれば、これら 2 箇所は **そのまま動く**。移植時に書き換え不要。

---

## 3. Seed へ移植する場合の手順（約 1-2 時間）

### 手順 A: ディレクトリ複製と置換

```bash
# 1. ソースコピー
cp -r src/app/bloom         src/app/seed
cp -r src/app/api/bloom     src/app/api/seed
cp    scripts/bloom-helper-functions.sql  scripts/seed-helper-functions.sql
cp    scripts/bloom-schema.sql            scripts/seed-schema.sql
cp    scripts/bloom-rls.sql               scripts/seed-rls.sql
cp    scripts/bloom-cron-log.sql          scripts/seed-cron-log.sql

# 2. 一括置換（IDE の find/replace で）
#   bloom_  → seed_      (lowercase, テーブル・enum・関数・storage key)
#   Bloom   → Seed       (Camel, React component / Context)
#   BLOOM_  → SEED_      (env, constants)
#   /bloom  → /seed      (URL, API パス)
#   /api/bloom → /api/seed

# 3. 個別の確認ポイント
#   - CHATWORK_BLOOM_ROOM_ID → CHATWORK_SEED_ROOM_ID（env 再設定）
#   - BLOOM_PUBLIC_URL       → SEED_PUBLIC_URL
#   - DigestDocument のアイコン（🌸）を Seed 用絵文字に変更
#   - BloomShell のヘッダー「🌸 Garden Bloom」を「🌱 Garden Seed」等に
```

### 手順 B: DB 移植

1. `scripts/seed-*.sql` 4 本を Supabase Dashboard > SQL Editor で順次実行
   - seed-helper-functions.sql → seed-schema.sql → seed-rls.sql → seed-cron-log.sql
2. `bloom_module_progress.module_code` CHECK 制約に `'seed'` が既に含まれていることを確認
   （本リポジトリの enum では含まれている）

### 手順 C: Chatwork ルーム切替

1. Chatwork 側で「Garden Seed 進捗」ルームを新規作成
2. `.env.local` に `CHATWORK_SEED_ROOM_ID=...` を追加
3. Seed 側の secrets.ts で読み出す env キーを `CHATWORK_SEED_ROOM_ID` に変更

### 手順 D: Cron スケジュール

`vercel.json` の crons に Seed 用の 3 本を追加（Bloom と共存可能）：

```json
{
  "crons": [
    { "path": "/api/bloom/cron/daily",   "schedule": "0 9 * * *" },
    { "path": "/api/bloom/cron/weekly",  "schedule": "0 9 * * 5" },
    { "path": "/api/bloom/cron/monthly", "schedule": "0 9 14 * *" },
    { "path": "/api/seed/cron/daily",    "schedule": "15 9 * * *" },
    { "path": "/api/seed/cron/weekly",   "schedule": "15 9 * * 5" },
    { "path": "/api/seed/cron/monthly",  "schedule": "15 9 14 * *" }
  ]
}
```

※ 同時刻だと Vercel の Cron 同時起動で負荷が偏るため、数分ずらす。

---

## 4. 移植後チェックリスト

- [ ] `npm run build` がエラーなく通る
- [ ] 置換漏れの grep: `grep -r "bloom" src/app/seed` で 0 件
- [ ] 置換漏れの grep: `grep -r "Bloom" src/app/seed` で 0 件
- [ ] seed_* テーブルがすべて Supabase Dashboard で作成されている
- [ ] seed 経路で garden_role ベースの RLS が動く（manager 閲覧等）
- [ ] Cron は CRON_SECRET で認証される（Bloom と同じシークレットで良い）
- [ ] ViewMode localStorage キーが `seed:viewMode` に変わっている
- [ ] Chatwork メッセージのリンク URL がすべて `{bloom_url}` ではなく Seed のそれに更新
- [ ] PDF export の絵文字・ブランディングが Seed 用になっている

---

## 5. 共有化してリスクを減らす別案（将来）

将来、Bloom と Seed の両方で同じ型・ヘルパが必要になった場合は、
`src/app/bloom/` から `src/lib/garden-progress/` に抽出する案がある：

```
src/lib/garden-progress/
  _types/                     # bloom/_types をここへ
  term-mapping.ts             # bloom/_lib/term-mapping.ts をここへ
  chatwork-templates/         # src/lib/chatwork/templates も集約候補
```

このリファクタは Bloom / Seed / Forest / Tree の 3-4 モジュールで同じ機能の重複が
目立ってきた時点で実施する。本ドキュメント作成時点（Phase A-1 完了時）では
まだ Bloom 単独なので据え置き。

---

## 6. Bloom は削除しない想定

Seed 移植後も Bloom は **Garden 全体ダッシュボード** として残す想定：
- Bloom: 全社の進捗を横断で見る（super_admin / admin）
- Seed: 新事業セグメントの進捗を固有で見る（その事業部内のみ）

DB もテーブルを別にしておけば両立する（bloom_* / seed_* で併存）。

# dispatch main- No. 296 — a-leaf-002 へ Leaf 本体 migration 特定 + apply 状況確認 + 修復計画起草依頼

> 起草: a-main-023
> 用途: a-audit-001 audit-001- No. 15 で発見した致命「Leaf 本体未適用（親不在状態）」を a-leaf-002 に周知し、本体 migration ファイル特定 → 実機 apply 状況確認 → 修復計画起草を依頼
> 番号: main- No. 296
> 起草時刻: 2026-05-11(月) 17:30
> 投下先: a-leaf-002（C:\garden\a-leaf-002）
> 添付: なし（全情報インライン）
> 緊急度: 🔴 高（致命 5 件 # 4 後続、Leaf 関電業務委託 Phase D 完成に必要）

---

## 投下用短文（東海林さんがコピー → a-leaf-002 にペースト）

~~~
🔴 main- No. 296
【a-main-023 から a-leaf-002 への dispatch（Leaf 本体未適用 audit 発見 + 本体 migration 特定 + apply 状況確認 + 修復計画起草依頼）】
発信日時: 2026-05-11(月) 17:30

# 件名
audit-001- No. 15 で「Leaf 本体未適用（親不在状態）」が致命発見されました。
Leaf-Soil 連携列（20260507000004_leaf_kanden_soil_link.sql）は確認できていますが、その親である Leaf 本体テーブル（leaf_kanden_cases / leaf_kanden_cases_audit / leaf_kanden_visit 等）の migration ファイルと apply 状況の特定が必要です。
a-leaf-002 で本体 migration 特定 + 実機 apply 状況確認 + 修復計画の起草をお願いします。

---

# A. audit # 15 発見の周知（Leaf 本体未適用 = 親不在状態）

## A-1. 発見の経緯
- 5/11 17:15 a-audit-001 が audit-001- No. 15 で全モジュール migration 健全性監査を実施
- 致命 5 件のうち # 4 として「Leaf 本体未適用」が確定
- 検証経路: REST API 直接照会で 404 確認
  ```
  curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/leaf_kanden_cases?limit=0" \
    -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
  → 404 Not Found（テーブル不在）
  ```

## A-2. 状況の本質（親不在状態とは）
- 既存 migration `supabase/migrations/20260507000004_leaf_kanden_soil_link.sql` は **Leaf 本体テーブルに対する外部キー列追加 / 連携列追加** を行う migration
- しかしその親テーブル（leaf_kanden_cases 等の本体）が DB に存在しない
- つまり「子は適用済み or apply 待ち、親は不在」という不整合状態
- このまま Phase D を進めると、本体 schema との整合性破綻が連鎖する

## A-3. 影響範囲（推定）
| 影響領域 | 影響度 | 備考 |
|---|---|---|
| Leaf 001 関電業務委託 Phase D | 🔴 致命 | 本体 schema 未確定で 92.9% 完成が無効化リスク |
| Leaf 001 Phase A / B / F | 🔴 致命 | 本体テーブル前提の機能群 |
| Leaf 他商材（光回線・クレカ等） | 🟡 軽微 | skeleton のみ、本体未着手 |
| Soil 連携（leaf_kanden_soil_link） | 🟡 中 | 親不在のため外部キー張れず |
| Bloom 案件一覧（横断 VIEW） | 🟢 低 | Leaf 案件移行前のため当面影響なし |

---

# B. Leaf 本体 migration 特定依頼

## B-1. supabase/migrations/ 内の Leaf 関連ファイル一覧化

以下の grep + ls 経路で Leaf 関連 migration を全件列挙してください：

```powershell
# パターン 1: ファイル名で Leaf を含むもの
Get-ChildItem "C:\garden\a-leaf-002\supabase\migrations" -Filter "*leaf*" | Select-Object Name, LastWriteTime, Length

# パターン 2: ファイル内容に leaf_kanden_ を含むもの（Read tool / Grep tool 使用）
Grep "leaf_kanden_" --path "C:\garden\a-leaf-002\supabase\migrations" --output_mode files_with_matches

# パターン 3: CREATE TABLE 文で leaf_ を含むもの
Grep "CREATE TABLE.*leaf_" --path "C:\garden\a-leaf-002\supabase\migrations" --output_mode content -i
```

出力期待形式（例）:
| # | ファイル名 | 日付 | 行数 | 主目的 |
|---|---|---|---|---|
| 1 | 20260507000004_leaf_kanden_soil_link.sql | 5/7 | 約 80 行 | Soil 連携列追加 |
| 2 | ?????_leaf_kanden_cases_create.sql | ? | ? | 本体テーブル CREATE（未確認） |
| ... | ... | ... | ... | ... |

## B-2. 各 CREATE TABLE 文の存在確認

以下のテーブルについて、CREATE TABLE 文が migration 内に存在するかを Grep で確認してください：

| テーブル名 | CREATE 文存在 | ファイル名 | 備考 |
|---|---|---|---|
| `leaf_kanden_cases` | ❓ | ? | 本体（案件マスタ） |
| `leaf_kanden_cases_audit` | ❓ | ? | 監査履歴 |
| `leaf_kanden_visit` | ❓ | ? | 訪問記録 |
| `leaf_kanden_status_master` | ❓ | ? | ステータスマスタ |
| `leaf_kanden_reason_master` | ❓ | ? | 理由マスタ |
| `leaf_kanden_attachments` | ❓ | ? | 添付ファイル |
| その他 Leaf 関電配下テーブル | ❓ | ? | spec / docs から逆引き |

確認 grep 例:
```
Grep "CREATE TABLE.*leaf_kanden_cases\b" --path "C:\garden\a-leaf-002\supabase\migrations" --output_mode content
Grep "CREATE TABLE.*leaf_kanden_visit" --path "C:\garden\a-leaf-002\supabase\migrations" --output_mode content
```

## B-3. 親テーブル不在の場合の追加調査

CREATE TABLE 文が **存在しない** 場合、以下の経路で「いつ・どこで作るつもりだったか」を逆引きしてください：

1. `docs/` 配下の Leaf Phase A / Phase D spec を grep して、本体スキーマ定義の所在を特定
   ```
   Grep "leaf_kanden_cases" --path "C:\garden\a-leaf-002\docs" --output_mode files_with_matches
   ```
2. `src/app/leaf/` 配下の TypeScript で `from('leaf_kanden_cases')` 等の参照箇所を列挙
   ```
   Grep "from\(['\"]leaf_kanden_" --path "C:\garden\a-leaf-002\src" --output_mode content
   ```
3. PR #65〜#73（Phase D の 8 PR）の差分を gh CLI で取得し、migration ファイル追加の有無を確認
   ```
   gh pr view 65 --json files,additions,deletions
   gh pr diff 65 -- "supabase/migrations/*"
   ```

---

# C. 実機 apply 状況確認依頼

## C-1. REST API 経由で各 Leaf テーブル存在チェック

以下の bash スクリプトで全テーブルの存在を一括確認してください（404 = 未適用、200 = 適用済、401/403 = 認証エラー）：

```bash
# .env.local から URL / KEY 取得前提
URL=$NEXT_PUBLIC_SUPABASE_URL
KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

for tbl in leaf_kanden_cases leaf_kanden_cases_audit leaf_kanden_visit \
           leaf_kanden_status_master leaf_kanden_reason_master leaf_kanden_attachments \
           leaf_kanden_soil_link; do
  status=$(curl -s -o /dev/null -w "%{http_code}" \
    "$URL/rest/v1/$tbl?limit=0" \
    -H "apikey: $KEY")
  echo "$tbl: HTTP $status"
done
```

## C-2. 結果一覧（存在 / 不在）出力フォーマット

| テーブル名 | HTTP | 判定 | 備考 |
|---|---|---|---|
| `leaf_kanden_cases` | 404 | ❌ 不在 | 親不在 |
| `leaf_kanden_cases_audit` | 404 | ❌ 不在 | 親不在 |
| `leaf_kanden_visit` | 404 | ❌ 不在 | 親不在 |
| `leaf_kanden_status_master` | ? | ? | ? |
| `leaf_kanden_reason_master` | ? | ? | ? |
| `leaf_kanden_attachments` | ? | ? | ? |
| `leaf_kanden_soil_link` | ? | ? | 連携テーブル |

## C-3. supabase_migrations.schema_migrations 検証

実 DB 側の適用履歴も並行確認してください（service_role キー使用）：

```bash
curl -s "$URL/rest/v1/rpc/get_applied_migrations" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
# または psql 直接
# psql "$DATABASE_URL" -c "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;"
```

期待出力: `20260507000004` が history にあるか、ないか。
- ある → 子だけ apply 済、親未作成（重大）
- ない → 子も親も未 apply（修復は単純な順序 apply で可）

---

# D. 修復計画起草依頼

## D-1. apply 順序 SQL（草案）

B / C の結果を踏まえ、以下のフォーマットで修復順序を起草してください：

```markdown
## 修復順序

### Step 1: 本体 CREATE
- migration: `YYYYMMDDHHMMSS_leaf_kanden_cases_create.sql`
- 内容: leaf_kanden_cases / _audit / _visit / _status_master / _reason_master / _attachments の CREATE TABLE
- 適用方法: supabase db push（または supabase migration up）

### Step 2: 連携列追加（既存）
- migration: `20260507000004_leaf_kanden_soil_link.sql`
- 内容: Soil 連携列追加 + FK 制約
- 適用方法: 上記の後に自動順序適用

### Step 3: 検証
- 各テーブル REST 200 確認
- FK 制約有効性確認
```

## D-2. 検証 SQL

apply 直後に流す検証クエリも起草してください：

```sql
-- 全テーブル存在確認
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'leaf_kanden_%'
ORDER BY table_name;

-- 主要カラム数確認
SELECT table_name, COUNT(*) AS col_count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name LIKE 'leaf_kanden_%'
GROUP BY table_name ORDER BY table_name;

-- FK 制約存在確認
SELECT tc.table_name, tc.constraint_name, kcu.column_name, ccu.table_name AS ref_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name LIKE 'leaf_kanden_%';

-- RLS 有効性確認
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'leaf_kanden_%';
```

## D-3. ロールバック計画

万一 apply が失敗した場合のロールバック SQL も併記してください：

```sql
-- 緊急ロールバック（FK 制約 → テーブル の順で DROP）
ALTER TABLE leaf_kanden_soil_link DROP CONSTRAINT IF EXISTS fk_leaf_kanden_soil_link__cases;
DROP TABLE IF EXISTS leaf_kanden_soil_link CASCADE;
DROP TABLE IF EXISTS leaf_kanden_attachments CASCADE;
DROP TABLE IF EXISTS leaf_kanden_visit CASCADE;
DROP TABLE IF EXISTS leaf_kanden_cases_audit CASCADE;
DROP TABLE IF EXISTS leaf_kanden_cases CASCADE;
-- マスタは独立で残す判断もあり、内容に応じて取捨
```

---

# E. apply タイミング

## E-1. 想定スケジュール
- **5/12（火）午前**: a-leaf-002 が B / C / D 完了 → 修復計画を a-main-023 に報告
- **5/12（火）午後**: 東海林さん最終決裁（A 案 = 一括 apply / B 案 = 分割 apply / C 案 = 修正後再起草）
- **5/13（水）**: a-main-023 主導で順次 Run（a-leaf-002 が検証担当、東海林さんが本番投入承認）

## E-2. Run の連携体制
| セッション | 役割 |
|---|---|
| a-leaf-002 | migration 起案 / SQL 検証 / Phase D 影響評価 |
| a-main-023 | Run コマンド実行 / 全体調整 / audit-001 への結果連携 |
| 東海林さん | 本番投入承認 / 異常時の判断 |
| a-audit-001 | apply 後の再 audit（致命 5 件のうち # 4 解消確認） |

## E-3. apply 前後の checkpoint
- 事前: develop ブランチを fork してテスト DB（garden-dev）で先行 apply 試行
- 事後: REST 200 確認 + RLS 確認 + Bloom 案件 VIEW 不在影響なしの確認

---

# F. 並列進行可能タスク

migration 修復と並行して、a-leaf-002 は以下を継続できます：

| タスク | 状態 | 優先度 |
|---|---|---|
| Phase D 92.9% 完成 → D.14 カバレッジ確認 | 🟡 merge 後実施 | 中 |
| Phase A（一覧 UI）spec 詳細化 | 🟢 進行可 | 中 |
| Phase B（CRUD 強化）spec 詳細化 | 🟢 進行可 | 中 |
| Phase F（KPI / 集計）spec 詳細化 | 🟢 進行可 | 低 |
| 他商材 skeleton（光回線・クレカ）レビュー | 🟢 進行可 | 低 |

ただし **本体 schema 未確定の間、Phase D の動作確認系タスクは保留**。code は完成済みでも DB が無いと実機テスト不能のため。

---

# G. Leaf 関電 (001) Phase D 完成への影響評価依頼

## G-1. 評価観点
- Phase D の 13/14 task 実装（約 3,000 行コード + 62 tests）は **本体テーブル前提**
- 本体未 apply のままでは:
  - Unit test: ⚠️ mock / fixture で動く可能性あり
  - Integration test: ❌ 失敗確実
  - 実機動作確認: ❌ 失敗確実
- D.14 カバレッジ確認も「実 DB 読書必須」なら本体 apply 後でないと無理

## G-2. 報告フォーマット
| 観点 | 現状 | 本体 apply 後 |
|---|---|---|
| Unit test 通過 | ? / 62 | 62 / 62（期待） |
| Integration test 通過 | ? / N | N / N（期待） |
| D.14 カバレッジ目標 | 未測定 | 80%+ 期待 |
| Phase D 完成宣言可否 | ❌ 不可 | ✅ 本体 apply 後可 |

---

# H. 他商材 Leaf（光回線・クレカ等）影響度評価

## H-1. 現状
- skeleton 5 件 起草済（PR #40 merge 済、a-auto Batch 12）
- migration / 本体実装は未着手
- よって今回の致命 # 4 の影響は **軽微**

## H-2. 教訓の横展開
- 関電 (001) で「本体 migration の特定漏れ」が発生した教訓は、他商材 skeleton 実装着手前に **schema-first / migration-first 規約** として固める必要あり
- 提案: `docs/leaf-migration-checklist.md`（新規）に以下を追記
  - 商材ごとに本体 CREATE migration を最初に作る
  - 連携列追加 migration は本体 CREATE 後でないと作らない
  - 各 migration の dependency を冒頭コメントに明示（例: `-- depends on: 20260501000001_leaf_xxx_create.sql`）

---

# I. ACK 形式

a-leaf-002 が B / C / D を完了したら、以下の形式で a-main-023 へ報告してください：

```
leaf-002- No. NN
【a-leaf-002 から a-main-023 への ACK（main- No. 296 完了）】
発信日時: 2026-05-MM(曜) HH:MM

# 完了報告
- B（本体 migration 特定）: ✅ / 🟡 / ❌
- C（実機 apply 状況確認）: ✅ / 🟡 / ❌
- D（修復計画起草）: ✅ / 🟡 / ❌

# 主要発見
- 本体 CREATE migration: 存在 / 不在
- ファイル名: ...
- 実機 apply 状況: 全テーブル不在 / 一部存在 / 全存在
- 修復計画: docs/leaf-main-migration-recovery-plan-20260512.md に起草

# 東海林さんへの判断仰ぎ
- A 案 / B 案 / C 案（推奨: ？案、理由: ？）

# 次のアクション
- a-main-023 が Run コマンド実行 → 検証 → audit-001 再 audit 依頼
```

---

# J. self-check（送信前に a-leaf-002 が確認）

- [ ] B-1: supabase/migrations/ 内の Leaf 関連ファイル全件 list 出力
- [ ] B-2: 7 テーブル全件の CREATE 文存在確認実施
- [ ] B-3: 親不在の場合、docs / src / PR 差分の 3 経路で逆引き
- [ ] C-1: REST API curl で 7 テーブル一括 status 取得
- [ ] C-2: 結果一覧テーブル形式で報告
- [ ] C-3: schema_migrations history 確認（service_role 使用）
- [ ] D-1: apply 順序 SQL 起草（本体 → 連携列 → 検証）
- [ ] D-2: 検証 SQL 4 種（テーブル / カラム / FK / RLS）起草
- [ ] D-3: ロールバック SQL 起草
- [ ] E: apply タイミング表明（5/12-13 連携順次 Run）
- [ ] F: 並列進行可能タスク一覧化
- [ ] G: Phase D 完成への影響評価
- [ ] H: 他商材 skeleton 影響度評価 + 教訓横展開提案
- [ ] I: ACK フォーマットで報告（leaf-002- No. NN）
- [ ] memory `feedback_dispatch_header_format` v5 準拠（投下情報先頭明示、コピペ md 経由）
- [ ] memory `feedback_a_main_coordination` 遵守（東海林さん経由でのみ a-main-023 へ報告）

---

完了次第、a-main-023 へ leaf-002- No. NN で ACK をお願いします。
~~~

---

## 起草メモ（東海林さん向け）

### この dispatch の位置づけ
- audit-001- No. 15 致命発見 5 件のうち **# 4「Leaf 本体未適用」** の修復着手依頼
- 他 4 件（# 1 / # 2 / # 3 / # 5）は別 dispatch で並行起草中
- 5/12 〜 5/13 で 5 件全件の修復完了を目標

### 投下後の想定フロー
1. 東海林さんが a-leaf-002 にコピペ投下
2. a-leaf-002 が B / C / D を 1-2h で完了 → leaf-002- No. NN で ACK
3. a-main-023 が修復計画レビュー → 東海林さん最終決裁
4. 5/13 a-main-023 主導で Run → audit-001 再 audit
5. 致命 # 4 解消 → audit-001- No. 16（再 audit）で確認

### 緊急度の根拠
- 🔴 致命: Leaf 001 Phase D 92.9% 完成が **DB 不在で実機検証不能**、Phase A / B / F 進行不能
- リカバリ可: migration 追加 + apply で復旧可能（コード変更不要）
- ブロッカー期間: 1-2 日（本体 schema 起草の負荷次第）

### 並列提案（§15）
- 💡 a-leaf-002 が B / C を実施中、a-main-023 は他致命（# 1 / # 2 / # 3 / # 5）の dispatch 起草を並行進行
- 💡 a-auto には影響評価不要（migration 修復は対話必須タスク）

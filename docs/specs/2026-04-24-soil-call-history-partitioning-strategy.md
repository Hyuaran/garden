# Garden-Soil コール履歴パーティショニング戦略

- 作成: 2026-04-24（a-auto / Phase A 先行 batch1 #P22）
- 作業ブランチ: `feature/phase-a-prep-batch1-20260424-auto`
- 目的: M5（2026-09）の Soil 構築着手時に参照する **335 万件コール履歴テーブル**の設計方針書
- 前提:
  - 既存 CSV サンプル：`G:/...015_Gardenシリーズ/03_Garden-Tree/コール履歴_20260421.xlsx`（807 件・10 名・1 日分）
  - 本番規模：**335 万件**（過去 3 〜 5 年累計、継続増加）
  - リスト本体は別途 **253 万件**（`soil_lists`）

---

## 1. 要件整理

| 観点 | 要件 |
|---|---|
| 保存件数 | 335 万件（増加し続ける、月あたり 5〜10 万件） |
| 主要クエリ | ① 社員×日付のコール一覧　② 案件×全履歴　③ 期間集計（日別/週別/月別） |
| 書き込み性能 | 架電中リアルタイム INSERT（毎秒数件のピーク） |
| 読み取り性能 | ダッシュボードで 1 秒以内に月次集計を返したい |
| 保管期間 | 全件保持（削除しない）、ただし 2 年超過分は低頻度アクセス |
| Supabase 制約 | PostgreSQL 15 系、Pooler 経由、RLS 必須 |

---

## 2. パーティショニング案比較

### 案 A: 日付別レンジパーティション（call_datetime 基準）

```sql
CREATE TABLE soil_call_history (
  id bigserial,
  list_id uuid NOT NULL,
  case_id uuid,
  user_id uuid NOT NULL,
  call_datetime timestamptz NOT NULL,
  call_mode text NOT NULL,
  result text NOT NULL,
  memo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, call_datetime)          -- パーティションキー必須
) PARTITION BY RANGE (call_datetime);

-- 月次パーティション（例：2026 年分）
CREATE TABLE soil_call_history_202601 PARTITION OF soil_call_history
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE soil_call_history_202602 PARTITION OF soil_call_history
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
-- ... 以下、月ごと
```

**メリット**:
- 期間集計クエリが**パーティション pruning で高速**（関係する月のみスキャン）
- 古い月を TABLESPACE 切替で低コストストレージに移せる（アーカイブ戦略と相性良）
- INSERT は最新月にしか入らないため書き込み分散は小さいが、index bloat も最新月のみ

**デメリット**:
- 「社員 × 全期間コール」クエリは全パーティション走査（index が効けば OK）
- パーティション作成を自動化する運用が必要（`pg_partman` or Supabase Cron）

### 案 B: 法人別リストパーティション（company_id 基準）

```sql
CREATE TABLE soil_call_history (...) PARTITION BY LIST (company_id);
CREATE TABLE soil_call_history_hyuaran    PARTITION OF soil_call_history FOR VALUES IN ('COMP-001');
CREATE TABLE soil_call_history_center     PARTITION OF soil_call_history FOR VALUES IN ('COMP-002');
-- ...6 法人分
```

**メリット**:
- 法人を跨がないクエリが高速
- RLS ポリシーもパーティション単位で書ける（管理容易）

**デメリット**:
- **期間集計は全法人パーティション走査**（主要クエリ① ② ③ と相性悪い）
- 法人ごとの件数偏りが大きい（ヒュアラン 70% / 他 30% のような偏在で無意味）
- 新法人追加のたびに手作業 ALTER

### 案 C: ハイブリッド（法人 × 月の 2 段）【推奨】

```sql
CREATE TABLE soil_call_history (...) PARTITION BY LIST (company_id);

CREATE TABLE soil_call_history_hyuaran PARTITION OF soil_call_history
  FOR VALUES IN ('COMP-001') PARTITION BY RANGE (call_datetime);

CREATE TABLE soil_call_history_hyuaran_202601 PARTITION OF soil_call_history_hyuaran
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
-- ...
```

**メリット**:
- 主要クエリ①②③ のすべてが pruning で最適化
- RLS が法人単位で書きやすい
- 古い月だけ別ストレージに退避可

**デメリット**:
- **パーティション数が爆増**（6 法人 × 60 ヶ月 = 360 パーティション）
- 運用の自動化が必須（手動では追いつかない）

### 案 D: 非パーティション + インデックス最適化 + BRIN

```sql
CREATE TABLE soil_call_history (...);
CREATE INDEX USING BRIN (call_datetime);        -- 時系列に強い
CREATE INDEX (user_id, call_datetime DESC);
CREATE INDEX (case_id) WHERE case_id IS NOT NULL;
```

**メリット**: 最小の運用コスト、Supabase 標準機能で完結

**デメリット**: 335 万件 → 1000 万件を超えると更新性能が劣化し始める

### 比較表

| 観点 | 案 A 日付 | 案 B 法人 | 案 C ハイブリッド | 案 D 非分割 |
|---|---|---|---|---|
| 主要クエリ① 社員×日付 | 🟢 | 🟡 | 🟢 | 🟡 |
| 主要クエリ② 案件×履歴 | 🟡 | 🟡 | 🟢 | 🟡 |
| 主要クエリ③ 期間集計 | 🟢 | 🔴 | 🟢 | 🟡 |
| INSERT ピーク性能 | 🟢 | 🟢 | 🟢 | 🟡 |
| 運用負荷 | 🟡 | 🟢 | 🔴 | 🟢 |
| RLS 記述しやすさ | 🟡 | 🟢 | 🟢 | 🟢 |
| 初期コスト | 中 | 中 | 大 | 小 |
| 将来 1000 万件超 | 🟢 | 🔴 | 🟢 | 🔴 |

## 3. 推奨: 案 A（日付別レンジパーティション）を**第 1 選択**

**選定理由**:
- 現規模（335 万件）では案 D も十分だが、**継続増加が確定**しているため将来性を優先
- 案 C は理想だが**運用コスト過大**。いきなり採用せず、案 A で始めて必要なら後で法人サブパーティション化
- 案 B は期間集計と相性悪く却下

### RLS 方針（案 A と組み合わせ）

```sql
ALTER TABLE soil_call_history ENABLE ROW LEVEL SECURITY;

-- 自分の履歴は誰でも閲覧可
CREATE POLICY sch_read_self ON soil_call_history
  FOR SELECT USING (user_id = auth.uid());

-- manager 以上は全員分
CREATE POLICY sch_read_manager ON soil_call_history
  FOR SELECT USING (
    (SELECT garden_role FROM root_employees WHERE user_id = auth.uid())
    IN ('manager','admin','super_admin')
  );

-- INSERT は staff+（架電業務者）
CREATE POLICY sch_insert_staff ON soil_call_history
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND (SELECT garden_role FROM root_employees WHERE user_id = auth.uid())
        IN ('toss','closer','cs','staff','outsource','manager','admin','super_admin')
  );
```

---

## 4. インデックス戦略

```sql
-- パーティション親テーブルに定義すると自動で子へ継承される
CREATE INDEX ON soil_call_history (list_id, call_datetime DESC);     -- クエリ①用
CREATE INDEX ON soil_call_history (case_id) WHERE case_id IS NOT NULL; -- クエリ②用
CREATE INDEX ON soil_call_history (user_id, call_datetime DESC);     -- クエリ①別形
CREATE INDEX ON soil_call_history (call_mode, call_datetime DESC)
  WHERE call_mode IN ('sprout','branch');                            -- KPI 用（有効率計算）
```

**注意**:
- 部分インデックスで空間効率を上げる
- BRIN は時系列に強いが、パーティション済なら不要（ピンポイント月に絞った後は B-tree で十分）
- `memo` には全文検索が必要なら `pg_trgm` の GIN インデックス追加（Phase C 中後期）

---

## 5. アーカイブ戦略

### 5.1 2 年超過分の取り扱い

```sql
-- 2 年以上経過した月次パーティションを低頻度アクセス用に退避
ALTER TABLE soil_call_history_202401 SET TABLESPACE archive_ts;
-- または別 DB に論理レプリケーションで逃がす
```

### 5.2 冷蔵庫化の基準

| 経過期間 | 扱い | ストレージ |
|---|---|---|
| 0〜6 ヶ月 | ホット（頻繁アクセス）| 標準 |
| 6〜24 ヶ月 | ウォーム（月次集計用）| 標準 |
| 24 ヶ月超 | コールド | 別 tablespace or S3 エクスポート |

### 5.3 完全削除ポリシー

**削除しない**（コンプライアンス・監査対応）。クエリから除外するだけ。

---

## 6. Supabase 固有の注意点

### 6.1 RLS とパーティションの相性
- PostgreSQL 15 ではパーティションテーブルの RLS は**親テーブルに定義すると子へ継承**される
- ただし **INSERT のポリシーは子テーブル側で再定義**が必要な場合あり → 実装時に dev 環境で検証

### 6.2 Supabase Pooler 経由の DDL
- パーティション追加は **Supabase Studio** の SQL エディタ or Service Role Key 経由で実行
- `pg_partman` は Supabase 上で直接利用不可。代替として**月初に Cron で ALTER 実行**する TS 関数を作る

### 6.3 バックアップと整合性
- 論理バックアップ（`pg_dump`）はパーティションごとに出せる
- 復元時は親テーブルから順次（依存関係に従って）

---

## 7. 初期構築時のタスク分解

| # | タスク | 見積 |
|---|---|---|
| S1 | 親テーブル + 過去 12 ヶ月 + 未来 3 ヶ月 のパーティション作成 SQL | 0.25d |
| S2 | インデックス作成 | 0.1d |
| S3 | RLS ポリシー 3 本 | 0.25d |
| S4 | 月初パーティション自動作成 Edge Function / Cron | 0.5d |
| S5 | 既存 CSV（335 万件）移行バッチ | 1.0d |
| S6 | 負荷試験（INSERT 毎秒 10 件・SELECT 月次集計）| 0.5d |
| S7 | アーカイブ運用書（2 年超過時の手順）| 0.25d |

**合計 約 2.85d**（ロードマップ §3 P22 は「0.5d」見積だが、これは設計書起案のみ。実装本体はこの分解通り）

---

## 8. 判断保留

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判1 | 初期案は A / C どちらから始めるか | **案 A で開始**。12 ヶ月運用で問題があれば C へ昇格 |
| 判2 | コール履歴の論理削除 or 物理削除 | **削除しない**（RLS の UPDATE 制限＋監査ログ併用） |
| 判3 | 全文検索（memo）の実装時期 | Phase C 後期（M6 以降）、pg_trgm GIN 追加 |
| 判4 | 案件とのリレーション | `case_id` は nullable。架電時点で案件未確定なこともある |
| 判5 | 重複コール検出 | 同 `user_id` × 同 `list_id` × 60 秒以内は「誤タップ」としてフラグ |

---

## 9. 参考

- 親 CLAUDE.md §6 FileMaker風UX仕様（検索画面の対象カラム）
- Garden-Soil CLAUDE.md（`soil_kanden_cases` が既に稼働、命名規則の先例）
- Garden-Tree CLAUDE.md（コール履歴の記録元）
- Garden-Root `root_employees`（`garden_role` 参照）

— end of partitioning strategy v1 —

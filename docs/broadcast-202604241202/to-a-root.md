# 【a-auto セッションからの周知】

- 発信日時: 2026-04-24 12:02 発動 / 約 13:30 配布
- 対象セッション: **a-root**
- 発動シーン: 集中別作業中（約90分、batch1 6 件一括）

---

## ■ 完了した Root 関連の作業（1 件）

### [docs/specs/2026-04-24-root-kot-integration-requirements.md](docs/specs/2026-04-24-root-kot-integration-requirements.md) — 313 行

KING OF TIME API との連携**要件書**。Phase A-1 後期（M1 前半）の実装ガイド。

**主な内容**:

1. **ユースケース 5 件**（UC1 新入社員登録 / UC2 マスタ再同期 / UC3 勤怠取込 / UC4 連携エラー確認 / UC5 手動 CSV インポート）
2. **取込項目マッピング表**
   - 従業員: `employee_no` / `name` / `hired_on` / `retired_on` / `company_id` / `employment_type` / `email` / `phone`（計 8 項目）
   - 勤怠: `work_date` / `clock_in_at` / `clock_out_at` / `break_minutes` / `overtime_minutes` / `leave_type` / `source` / `imported_at`
   - **取込しない**: birthday（本人申告）/ garden_role（Garden 内部）/ 住所・緊急連絡先・振込口座（MF 電子契約が正）
3. **段階実装 3 段階**
   - Phase 1（現在〜M1）: **CSV 手動インポート**（経理と合わせて月次）
   - Phase 2（M2〜）: API バッチ（Vercel Cron 03:00 JST、日次）
   - Phase 3（Phase D 後）: **リアルタイム同期**（Tree 打刻 → KoT API）
4. **認証方式**: Vercel 環境変数 `KOT_API_TOKEN` / Server Action or Route Handler でのみ利用
5. **エラーハンドリング 8 項目**（E1 401 / E2 429 / E3 5xx / E4 仕様変更 / E5-E6 ID マッピング / E7 重複 / E8 夜勤跨ぎ）
6. **ログテーブル `root_kot_sync_log`** の DDL + RLS ポリシー
7. **画面構成**（`/root/kot`、4 タブ：従業員マスタ / 勤怠 / API 連携 / 連携ログ）
8. **実装順序 R1〜R9**（Phase 1+2 合計 4.0d）

---

## ■ あなた（a-root）が実施すること

### 1. 設計書の精読
```bash
git fetch origin feature/phase-a-prep-batch1-20260424-auto
```

### 2. Phase 1（CSV 手動）の実装（M1 前半着手推奨）
| # | タスク | 工数 |
|---|---|---|
| R1 | `root_kot_sync_log` テーブル + RLS | 0.25d |
| R2 | `/root/kot` 画面スケルトン（4 タブ構造）| 0.25d |
| R3 | CSV アップロード + プレビュー（従業員 + 勤怠）| 1.0d |
| R4 | 取込バッチ関数（upsert）| 0.5d |

**Phase 1 合計**: 2.0d

### 3. 判断保留 5 項目（ファイル末尾 §12）
| 判# | 論点 | a-auto スタンス |
|---|---|---|
| 判1 | KoT API v3 の正式仕様確定 | Phase 2 着手前に事業者照会 |
| 判2 | Vercel Cron vs Supabase Edge Function | 初期は Vercel Cron |
| 判3 | Phase 1（CSV 手動）を Phase A-1 内で完走させるか | **完走推奨**（Bud 給与の前提） |
| 判4 | `root_attendance` の粒度 | **日次 1 行** |
| 判5 | KoT エクスポート CSV のフォーマット | KoT 管理画面の「汎用エクスポート」仕様に合わせる |

東海林さんと合意してから実装着手を推奨。特に**判3（Phase 1 完走の優先度）**は Bud 給与スケジュールに影響するため最優先で判断したい。

### 4. Bud / Tree との連携
- **Bud**: `root_attendance` のデータモデルを確定しないと給与計算が進められない（判4 と直結）
- **Tree**: Phase D の打刻 API → KoT リアルタイム同期（R9）は a-tree と共同作業

### 5. effort-tracking.md への先行記入
R1〜R4 を予定時間付きで追記（§12）。

### 6. 本ブランチの扱い
- **推奨**: PR 化して main マージ（要件書永続化）

---

## ■ 参考
- 親 CLAUDE.md §4（認証ポリシー、KoT 契約継続方針、新入社員登録フロー）
- Root CLAUDE.md（7 マスタ定義、KoT 連携の段階実装方針）
- マスタ定義書 v2（Drive: `Garden-Root_マスタ定義書_GardenBud用_20260416_v2.md`）
- 作業ブランチ: [`feature/phase-a-prep-batch1-20260424-auto`](https://github.com/Hyuaran/garden/pull/new/feature/phase-a-prep-batch1-20260424-auto)

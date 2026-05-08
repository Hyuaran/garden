# Phase 2 設計: state.txt → Root 自動 sync 構築 - 2026-05-05

> 起草: a-main-012
> 用途: Phase 1a/1b（〜5/8 デモ）完成後、Phase 2（5/9〜5/22）で着手する自動 sync の設計案
> ステータス: 草案（dispatch 起草前の内部設計）
> 起草時刻: 2026-05-05(火) 20:05

---

## 1. 現状の state.txt 運用フロー（Phase 1 時点）

```
[claude.ai 作業日報セッション]
   ↓ Drive コネクタ
[_chat_workspace\state_updated_YYYYMMDD.txt]
   ↓ Queue Processor (10 分毎、既存稼働中)
[state\state.txt] (上書き)
   ↓ send_report.py (手動 or auto_send_*.bat)
[Chatwork] (毎日通知)
```

memory `project_claude_chat_drive_connector.md` § 9-A 既存運用。

**Phase 1a で追加した 1 回限り flow**:
```
[state.txt + send_log.txt]
   ↓ scripts/import-state-to-root.ts (1 回限り、東海林さん手動実行)
[root_daily_reports + root_daily_report_logs] (Supabase)
```

→ 1 回限り import なので、以降の state.txt 更新は Supabase に反映されない。

---

## 2. Phase 2 で構築する継続 sync フロー（目標像）

```
[claude.ai 作業日報セッション]
   ↓ Drive コネクタ
[_chat_workspace\state_updated_YYYYMMDD.txt]
   ↓ Queue Processor (拡張 or 別 Cron)
[state\state.txt] (上書き)  ←┐
   ↓                          │
   ├→ send_report.py → Chatwork (既存維持)
   └→ Supabase sync → root_daily_reports / root_daily_report_logs (新規)
```

**ゴール**:
- claude.ai が日報を更新 → 自動的に Supabase にも反映
- 東海林さん手動操作 0
- Chatwork 配信は既存通り継続

---

## 3. 起動方式 3 候補の比較

### 案 A: Queue Processor 拡張（推奨）

**実装**: `queue_processor.py` に Supabase 書き込み機能を追加

```python
# queue_processor.py 内、state.txt 上書き後に追加
def sync_to_supabase(state_data):
    supabase = create_client(URL, SERVICE_ROLE_KEY)
    supabase.table("root_daily_reports").upsert({
        "date": state_data["date"],
        "workstyle": state_data["workstyle"],
        ...
    })
    # logs も同様
```

| 観点 | 評価 |
|---|---|
| ✅ 実装コスト | 低（既存 Queue Processor に追記）|
| ✅ 既存運用との整合 | 高（同一 process で順次処理）|
| ✅ デバッグ容易性 | 高（既存ログ Path 流用）|
| ⚠️ 依存関係 | Python supabase-py パッケージ追加（新規 npm install ではないので OK）|
| ⚠️ 失敗時 | Queue Processor 全体の停止リスク（要 try/except 隔離）|

### 案 B: Vercel Cron 独立

**実装**: `src/app/api/cron/sync-state-to-root/route.ts` を 10 分毎に起動

```typescript
// Vercel Cron で 10 分毎
export async function GET() {
  // 1. Google Drive API で state.txt 取得
  // 2. パース
  // 3. Supabase upsert
}
```

| 観点 | 評価 |
|---|---|
| ✅ 実装後の保守性 | 高（Vercel Dashboard で監視可能）|
| ❌ Drive API 認証 | 複雑（service account or OAuth、設定工数大）|
| ❌ Queue Processor との重複 | あり（state.txt の取得元が Drive、Queue Processor は Drive 経由で state.txt 上書き → Vercel Cron も Drive 読み）|
| ⚠️ 実装コスト | 中〜高 |

### 案 C: Edge Function トリガー

**実装**: Supabase Edge Function、Drive Webhook で起動

| 観点 | 評価 |
|---|---|
| ❌ Drive Webhook 設定 | 複雑（Google Cloud 連携必要）|
| ❌ 実装コスト | 高 |
| ✅ リアルタイム性 | 最高（Drive 更新即同期）|

→ **A 案推奨**（実装コスト最小、既存運用整合）。

---

## 4. 整合性確保（A 案前提）

### 4-1. Queue Processor 拡張時のロジック

```
[Queue Processor 起動]
  ↓
[_chat_workspace\state_updated_*.txt 検知]
  ↓
[JSON 妥当性検証 + 安全機構チェック]
  ↓
[state.txt 上書き] ←既存処理
  ↓
[NEW: Supabase upsert] ←追加処理
  ├→ root_daily_reports (date PK upsert)
  └→ root_daily_report_logs (DELETE WHERE report_date=X → INSERT 各 log)
  ↓
[_archive_202605\ 移動] ←既存処理
```

### 4-2. エラー時の挙動

| 失敗パターン | 対応 |
|---|---|
| Supabase 接続エラー | Queue Processor 全体は継続、エラーログ + 次回 retry |
| state.txt 上書き OK + Supabase 失敗 | state.txt は更新済、Supabase だけ手動再 sync 必要 |
| Supabase 適用 OK + state.txt 書き込み失敗（稀）| 既存 Queue Processor の処理（既知）|

→ Supabase 失敗時は手動再実行スクリプト（scripts/manual-resync-to-root.ts）で対応。

### 4-3. 重複排除（idempotent）

- root_daily_reports: `INSERT ... ON CONFLICT (date) DO UPDATE`
- root_daily_report_logs: `DELETE WHERE report_date=X` → `INSERT ...`（同日 log を毎回置換）

→ 何度実行しても同じ結果。

---

## 5. 必要な dispatch 構成（5/9 起草予定）

### dispatch ① a-root-002（or 担当セッション）: Queue Processor 拡張

依頼内容:
- queue_processor.py に Supabase sync 機能追加
- supabase-py パッケージ追加（pip install）
- 環境変数 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 取得（config.json に追加 or 別 secret）
- ログは `queue_log.txt` に追記、エラー隔離
- テスト: 既存 state.txt 1 件で sync 確認

### dispatch ② claude.ai 作業日報セッション: 運用フロー確認

依頼内容:
- Phase 2 sync 開始（5/9-）後、state.txt 更新時に Supabase にも自動反映される旨の memory 更新
- claude.ai 側の追加作業なし（Drive 経由で従来通り）
- 万が一 Supabase 不整合検知時の対応フロー（手動再実行 trigger 方法）

### dispatch ③ a-bloom-003: 動作確認

依頼内容:
- /bloom/progress の表示が Phase 2 sync 後も正常動作確認
- 日次更新が反映されるか
- 何か問題あれば即報告

---

## 6. Phase 2 着手タイミング

| 時期 | 内容 |
|---|---|
| 5/8 デモ完了 | Phase 1b 評価 → Phase 2 着手判断 |
| 5/9 朝 | dispatch ①②③ 起草 + 投下 |
| 5/9-5/12 | 実装 + テスト |
| 5/13-5/15 | 1 週間運用テスト（毎日 sync 動作確認）|
| 5/16-5/22 | 安定化 + Phase 3 移行（special_notes 列追加 等）|

---

## 7. リスク + 対応策

| リスク | 発生時の影響 | 対応 |
|---|---|---|
| Supabase API rate limit | sync 失敗 | Queue Processor が retry、または手動再実行 |
| state.txt フォーマット崩れ | パース失敗 | claude.ai 側 Rules（feedback_daily_report_style.md）で防止、検証時 NG なら _quarantine 隔離 |
| Queue Processor 自体停止 | sync 全停止 | Windows タスクスケジューラ稼働確認 + 通知 |
| service_role key 漏洩 | 全データ書き換え可能 | config.json は .gitignore、Supabase Dashboard で定期キーローテ |

---

## 8. 関連 memory / docs

| ファイル | 内容 |
|---|---|
| `project_claude_chat_drive_connector.md` | Drive コネクタ運用、Queue Processor § 9-A |
| `feedback_daily_report_style.md` | state.txt 記述ルール、Rule 1〜5 |
| `feedback_token_management_by_claude.md` | Garden 所有 token 管理 |
| `docs/dispatch-main-no53-a-root-daily-report-tables-20260505.md` | Phase 1a テーブル設計 |
| `docs/dispatch-main-no54-claude-chat-state-format-clarify-20260505.md` | フォーマット正確化 |
| `docs/dispatch-main-no59-a-root-002-chatwork-import-and-push-20260505.md` | Chatwork 履歴取り込み |
| `docs/dispatch-main-no60-bloom-003-progress-real-data-server-side-20260505.md` | Bloom 進捗実データ表示 |

---

## 9. 改訂履歴

- 2026-05-05 20:05 初版（a-main-012、Phase 2 設計案を内部 docs として整理、5/9 dispatch 起草前の準備）

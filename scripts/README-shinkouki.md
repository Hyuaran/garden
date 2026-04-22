# 進行期データ自動更新スクリプト（運用手順）

税理士から届く試算表 PDF から、Forest ダッシュボードの進行期データ（売上・外注費・利益）を自動更新するスクリプトの運用手順書。

## 前提

- Python 3.10+ インストール済み（動作確認は Python 3.14 で実施）
- プロジェクトルート（`C:\garden\b-main` など）の `.env.local` に Supabase 認証情報が設定済み：
  ```
  NEXT_PUBLIC_SUPABASE_URL=https://hhazivjdfsybupwlepja.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
  ```
- 初回のみ: `pip install -r scripts/requirements.txt`

> **Note:** 当初 `supabase-py` 採用予定だったが、Python 3.14 で依存 `pyiceberg` のビルドに C++ Build Tools が必要なため、`requests` で Supabase REST API を直接叩く方式に変更済み（2026-04-22）。

## 毎月の運用手順

### ステップ 1: PDF を所定フォルダに配置

税理士から届いた試算表 PDF を以下に配置：

```
G:\マイドライブ\17_システム構築\07_Claude\01_東海林美琴\001_仕訳帳\D_税理士連携データ\
```

ファイル名例：
- `ヒュアラン_202604101329連携_暫定_前期比較残高試算表(月次・期間)-17.pdf`
- `リンクサポート_202604101649連携_暫定_残高試算表(月次・期間)-13.pdf`

**対象PDF**: 先頭ページに「残高試算表」「損益計算書」「貸借対照表」のいずれかが含まれるもの。他のファイルは自動的にスキップされる。

### ステップ 2: Dry-run で抽出結果を確認

PowerShell でプロジェクトルートに移動してから実行：

```powershell
cd C:\garden\b-main
python scripts\update_shinkouki_supabase.py --dry-run
```

出力される各社の **売上 / 外注 / 利益** が PDF の値と一致しているか確認する。
書き込みは行われない。

### ステップ 3: 本番実行

確認後、`--dry-run` を外して実行：

```powershell
python scripts\update_shinkouki_supabase.py
```

`✅ 完了: N/N 件を更新しました` が最後に表示されれば成功。

### ステップ 4: ダッシュボードで確認

https://garden-chi-ochre.vercel.app/forest にアクセスしてログイン。
進行期カラムの数値が更新されていること、`reflected` 欄が `YYYY/MM まで反映中` になっていることを目視確認。

`zantei` フラグが `true` になっている行は **暫定（スクリプト反映）** 扱い。手動で確定した場合は UI から `zantei=false` に変更する運用。

## ロールバック手順

実行前の値は `C:\garden\_tools\shinkouki-backups\shinkouki-backup-YYYYMMDD-HHMMSS.json` に自動保存されない（※ 現時点では手動バックアップ運用）。
ロールバックが必要な場合：

1. Supabase Dashboard → Table Editor → `shinkouki` を開く
2. 該当行を手動で以前の値に戻す
3. または SQL Editor で `UPDATE shinkouki SET uriage=..., gaichuhi=..., rieki=... WHERE company_id='...';` を実行

将来的にはスクリプトに `--backup-first` オプションを追加予定（Phase A2 以降）。

## トラブルシューティング

### 「会社名を特定できませんでした」

- PDF 内のテキストがスクリプトの `COMPANY_MAP` と一致していない
- スクリプト内の `COMPANY_MAP` 辞書に該当の表記を追加する

### 「数値が取れませんでした」

- PDF のテーブル構造が想定と異なる（前期比較/通常の判定失敗）
- テキスト抽出にフォールバックしても取れないケース
- Supabase Table Editor から手動更新するか、Phase A3 の手動編集モーダル（実装予定）を使う

### 「UPDATE 失敗 (HTTP 401 / 403)」

- `.env.local` の `SUPABASE_SERVICE_ROLE_KEY` が正しいか確認
- Supabase Dashboard にログインできるか確認
- キーの先頭は `sb_secret_` で始まる（`sb_publishable_` は別物）

### 「該当行なし（shinkouki テーブルに未登録？）」

- `shinkouki` テーブルに `company_id='xxx'` の行が存在しない
- `companies` テーブルと `shinkouki` テーブル両方に会社を登録済みか確認

## 新規会社を追加したい場合

1. Supabase の `companies` テーブルに会社を INSERT
2. `shinkouki` テーブルにも同じ `company_id` で行を INSERT（空値で可）
3. スクリプトの `COMPANY_MAP` に「PDF内の会社名表記 → company_id」を追加
4. PDF を `D_税理士連携データ\` に配置して実行

## スクリプトの制限事項

- **`uriage` カラム**: `売上高合計` の行から抽出。行が見つからない場合 null
- **`gaichuhi` カラム**: `外注費`（`営業外` を含まない行）から抽出
- **`rieki` カラム**: `当期純損益金額` の行から抽出（マイナス値OK）
- **`period` カラム**: `至 令和X年Y月` から抽出し、`reflected = "YYYY/Mまで反映中"` 形式で書き込み
- **`zantei`**: 常に `true`（暫定扱い）にセットされる
- **PDF 抽出失敗時**: そのカラムは null のままで、該当カラムは UPDATE 対象外

## 関連ファイル

- スクリプト本体: `scripts/update_shinkouki_supabase.py`
- 依存パッケージ: `scripts/requirements.txt`
- Phase A1 設計書: `docs/superpowers/specs/2026-04-21-shinkouki-auto-update-design.md`
- Phase A1 実装プラン: `docs/superpowers/plans/2026-04-21-shinkouki-auto-update-phase-a1.md`
- 旧スクリプト（ロジック流用元）: `G:\...\003_GardenForest_使用不可\update_shinkouki_v3.py`

## Phase ロードマップ

| フェーズ | 内容 | 対象ユーザー | 状態 |
|---|---|---|---|
| A1 | Python スクリプト（PDF → Supabase） | 東海林（自分用） | ✅ 完了 |
| A2 | Web UI で PDF アップロード | 後道社長（非エンジニア） | ⏳ 未着手 |
| A3 | 手動編集モーダル（A2の数値修正用） | 管理者全員 | ⏳ 未着手 |

# Codex-531 作業報告（2026-11-13）

## 実装

- `supabase/migrations/20261113000531_zenkaku_agent_rpc.sql`：認証ハッシュ用表（host-pc の1行、RLS 有効、ポリシーなし、一般ロールの表権限なし）と security definer RPC を追加。
- `scripts/zenkaku-agent/ZenkakuAgent.Core.ps1`：transport 切り替え、直接 RPC 呼び出し、待機間隔計算を追加。
- `scripts/zenkaku-agent/ZenkakuAgent.ps1`：取得関数の利用、起動時 transport ログ、連続失敗時の待機延長を追加。結果送信の処理は維持。
- `scripts/zenkaku-agent/config.example.json`：transport を追加。
- `scripts/zenkaku-agent/install-db-direct-paste.txt`：停止・置換・環境変数設定・再開・確認・戻し方を記載。
- `scripts/zenkaku-agent/README.md`：設定と回数見積もりを追記。
- `scripts/zenkaku-agent/tests/ZenkakuAgent.Transport.Tests.ps1`：HTTP をモックした取得先・認証ペイロード・null・失敗・待機間隔テストを追加。
- `supabase/tests/system_zenkaku_agent_next.sql`：既存形式に合わせ begin/rollback の SQL テストを追加。claim 関数をトランザクション内だけモックし、認証拒否・submit 優先・check・仕事なし・heartbeat を検証する構成。

## 検証結果

- PowerShell 5.1 / Pester 3.4：12件成功、0件失敗（既存7件＋追加5件）。HTTP はすべてモック。
- `vitest run src/app/api/system/zenkaku-agent`：2ファイル、5件成功。
- `tsc --noEmit --incremental false`：終了コード0。指定の型検査に、範囲外の tsbuildinfo を更新しないオプションを追加。npx による取得を避け、インストール済みのローカル実行ファイルを使用。
- エージェント本体の PowerShell 構文解析：エラーなし。
- SQL テストは未実行。ローカル psql がなく、外部 DB 接続を禁止されているため、migration も適用していない。
- SQL 内容の確認：未登録・空・不一致の秘密は heartbeat/claim 前に unauthorized。SHA256 を照合し、認証後に last_seen_at と agent_version を更新。submit の行があれば即返却し、なければ check、両方なければ null。search_path は public, extensions、PUBLIC の関数権限を revoke、anon の execute のみ grant。

## 判断・注意点

- 互換性のため transport 未指定と example は garden。明示的に supabase を指定して切り替える。取得障害時の Garden への自動フォールバックは追加しない。
- SUPABASE_URL / SUPABASE_ANON_KEY は config 本文に保存せず、既存の秘密と同様にマシン環境変数で渡す。config に加える実値は transport のみ。指示書の「鍵をファイルに直書きしない」を優先した。
- 正常取得（null を含む）で失敗数をリセット。3秒設定では失敗時6→12→24→30秒、成功時3秒に戻る。
- 回数見積もり：3秒間隔は24時間で最大28,800回/日、12時間で14,400回/日。直接取得時はその分が DB RPC に移り、Garden next は0回。新しい cron は追加していない。
- 認証表への秘密ハッシュ登録・migration 適用は Claude に依頼する手順とした。実際の鍵や秘密は記載していない。
- git、computer-use、ブラウザは使用せず、本番書き込み・外部サービス呼び出しも行っていない。既存 API と指示範囲外のソースは変更していない。

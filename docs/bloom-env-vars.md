# Garden Bloom — 環境変数一覧

Bloom モジュール（特に Chatwork 連携と Cron 配信）で追加が必要な環境変数。
`.env.local` に追記してください（`.env.local` は .gitignore 対象）。

## Supabase（既存 / Garden 全モジュール共通）

| 変数名 | 例 | 用途 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | Supabase プロジェクト URL（garden-dev） |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | 匿名 anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | サーバ側のみ使用（Cron・Route Handler） |

## Chatwork 連携（T8 で追加、T9 Cron で使用）

| 変数名 | 必須 | 用途 |
|---|:--:|---|
| `CHATWORK_API_TOKEN` | ✅ | Chatwork API トークン（エンタープライズプラン） |
| `CHATWORK_BLOOM_ROOM_ID` | ✅ | 「Garden 開発進捗」ルーム ID（日次/週次/月次） |
| `CHATWORK_ALERT_ROOM_ID` |  | 重要アラート用ルーム ID（未設定時は progress と共用） |
| `CHATWORK_WEBHOOK_SECRET` |  | Webhook 署名検証シークレット（受信実装時） |
| `BLOOM_CHATWORK_DRY_RUN` |  | `true` / `1` / `yes` で実 API を叩かずログのみ（Phase 1 推奨） |

## Cron（T9 で追加）

| 変数名 | 必須 | 用途 |
|---|:--:|---|
| `CRON_SECRET` | ✅ | Vercel Cron 認可。`openssl rand -hex 32` 等で生成、Vercel の「Environment Variables」へ登録。Vercel Cron は自動で `Authorization: Bearer <CRON_SECRET>` を付与する |

取得手順:
1. Chatwork の設定 → API 発行 でトークン取得
2. 「Garden 開発進捗」ルームを新規作成（既存日報ルームとは別）
3. ルーム URL の末尾数字が `room_id`（例: `https://www.chatwork.com/#!rid123456789` の `123456789`）
4. 重要アラートを別ルームにしたい場合のみ `CHATWORK_ALERT_ROOM_ID` を設定

## Bloom 公開 URL（メッセージ内リンク用）

| 変数名 | 既定値 | 用途 |
|---|---|---|
| `BLOOM_PUBLIC_URL` | `https://garden.hyuaran.com/bloom` | Chatwork メッセージ内の「詳細はこちら」URL ベース |

Vercel 環境では Vercel のプロジェクト URL（例: `https://garden-xxxx.vercel.app/bloom`）を
Production / Preview ごとに設定する想定。

## DB 側の永続化（§10.3 判1: pgcrypto）

トークンとルーム ID は `bloom_chatwork_config` テーブルにも保存できる（UI 編集対応予定）。
T8 時点の実装は env 優先、DB 読み出しは T9 で `pgp_sym_decrypt` 経由に拡張する。

## .env.local 追記例

```bash
# --- Chatwork (T8 〜) ---
CHATWORK_API_TOKEN=xxxxxxxxxxxxxxxxxxxx
CHATWORK_BLOOM_ROOM_ID=123456789
BLOOM_CHATWORK_DRY_RUN=true       # Phase 1 テスト期間は true 推奨
# CHATWORK_ALERT_ROOM_ID=987654321
# CHATWORK_WEBHOOK_SECRET=<設定した署名シークレット>

# --- Bloom ---
BLOOM_PUBLIC_URL=http://localhost:3000/bloom

# --- Cron (T9) ---
CRON_SECRET=<openssl rand -hex 32 で生成した 64 文字 hex>
```

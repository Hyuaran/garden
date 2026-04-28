# 5/5 後道さんデモ用 localhost 動作確認チェックリスト - 2026-04-27

> 起草: a-main-009
> 用途: GitHub Team 課金 48h ブロック中も 5/5 デモは localhost で実施可能。事前動作確認の手順
> 前提: a-bloom-002 worktree で `npm run dev` (localhost:3002) を起動

## 前提準備

### Step 1: a-bloom-002 dev server 起動確認

a-bloom-002 セッションで以下が走っている必要があります（既起動済の可能性あり）:

```
cd /c/garden/a-bloom-002
npm install   # 初回のみ、または依存更新時
npm run dev   # localhost:3002 で起動
```

期待表示:
```
ready - started server on 0.0.0.0:3002, url: http://localhost:3002
event - compiled client and server successfully
```

### Step 2: ブラウザで開く

C 垢 Edge（通常モード、認証不要）で:

```
http://localhost:3002/
```

→ **GitHub 認証なしで直接アクセス可能**（ローカル開発サーバ、認証保護なし）

## ホーム画面（`/`）動作確認

### dispatch v6 + v7 V7-A 反映分

| 確認項目 | 期待動作 | 合否 |
|---|---|---|
| 1. 大樹背景画像 | atmosphere-01.png 表示（or 6 atmospheres カルーセル）| □ |
| 2. 左サイドバー | ホーム / ダッシュボード / 取引 / 顧客 / ワークフロー / レポート / 設定 7 項目 | □ |
| 3. AppHeader（上部）| Garden Series ロゴ + 検索バー + 日付 + 天気 + システム状態 + ユーザー情報 | □ |
| 4. 挨拶 | 「東海林さん、おはようございます 🌱」 | □ |
| 5. 4 KPI カード | 売上 / 入金予定 / 架電状況 / 未処理タスク（モック値）| □ |
| 6. 12 module 3×4 grid | Bloom / Fruit / Seed / Forest / Bud / Leaf / Tree / Sprout / Soil / Root / Rill / Calendar | □ |
| 7. Today's Activity（右）| 5 件のモックエントリ | □ |
| 8. 左下 HelpCard | 「成長のヒント」+「ヒントをもっと見る」ボタン | □ |

### キー操作確認

| キー | 動作 | 合否 |
|---|---|---|
| `←` `→` | atmosphere カルーセル前後移動 | □ |
| `Space` | 次の atmosphere | □ |
| `1` 〜 `6` | 直接ジャンプ | □ |
| `A` | auto play toggle | □ |
| `Ctrl+F` or `⌘+K` | 検索バー focus | □ |
| **背景クリック** | 次の atmosphere | □ |
| 12 module hover | scale + ring 演出 | □ |
| 12 module クリック | 該当モジュールページ遷移 | □ |
| 通知ベル（右上）| Today's Activity drawer 開閉 | □ |

### モバイル / レスポンシブ確認（任意）

```
Edge DevTools (F12) → Device Mode → 各サイズ確認
```

| 画面サイズ | 期待 | 合否 |
|---|---|---|
| Desktop (1920x1080) | フルレイアウト、3×4 grid | □ |
| Tablet (768x1024) | 2×6 grid 等に再配置 | □ |
| Mobile (375x667) | 1 列 / 2 列、Sidebar 折りたたみ | □ |

## ログイン画面（`/login`）動作確認

### dispatch v6 反映分

| 確認項目 | 期待動作 | 合否 |
|---|---|---|
| 1. 左側ログイン枠 | 半透明白カード、Garden Series ロゴ | □ |
| 2. 右側 atmosphere 背景 | 大樹画像表示 | □ |
| 3. 入力枠 1 | **メールアドレス**（V7-B で「社員番号またはID」に変更予定）| □ |
| 4. 入力枠 2 | パスワード | □ |
| 5. ログイン状態を保持 チェック | 表示 | □ |
| 6. ログインボタン | 緑系グラデ | □ |
| 7. パスワードをお忘れですか？ リンク | 表示 | □ |

### dispatch v7 V7-B 反映後（実装中の場合）

| 確認項目 | 期待 | 合否 |
|---|---|---|
| 入力枠 1 | 「社員番号またはID」（旧 メールアドレス）| □ |
| placeholder | 「例) E-12345 または P-001」| □ |
| 背景 | 6 atmospheres カルーセル | □ |

## 離席中・休憩中画面（dispatch v7 V7-C 反映後、実装中の場合）

### `/tree/away`（離席中）

| 確認項目 | 期待 | 合否 |
|---|---|---|
| 文字位置 | **中央配置**（休憩中と同じ）| □ |
| 「離席中」表示 | 大文字、緑系 | □ |
| 「Green Screen」label | 表示 | □ |
| ステータスバッジ | 「ステータス：一時離席」| □ |
| 戻るボタン | 「ホームへ戻る」（中央）| □ |

### `/tree/break`（休憩中）

| 確認項目 | 期待 | 合否 |
|---|---|---|
| お茶イラスト | 上部 | □ |
| 「休憩中」 | 大文字、中央 | □ |
| 再開予定時刻 | 表示 | □ |
| 戻るボタン | 中央 | □ |

## 後道さんデモ シミュレーション

### デモシナリオ（5-10 分、memory `project_godo_communication_style.md` 配慮）

| 順 | 操作 | 説明文 |
|---|---|---|
| 1 | localhost:3002/login を開く | 「これがログイン画面です。社員番号 or ID + パスワードでログイン」 |
| 2 | ログイン（モック動作）→ home へ | 「ログイン後にこの home が表示されます」 |
| 3 | 大樹背景 + 12 module をゆっくり見せる | 「12 のモジュールが Garden の業務全体を表しています」 |
| 4 | atmosphere をキーで切替（`1` `2` `3`）| 「気分や時間帯で背景を変えられます。気分転換に」 |
| 5 | 4 KPI カードを見せる | 「経営者として一目で会社状況を把握」 |
| 6 | Today's Activity を見せる | 「右側に最新の動きがリアルタイム表示」 |
| 7 | 12 module の 1 つ（例: Bud 経理）を hover | 「カードをクリックすると各モジュールに飛びます」|
| 8 | （任意）Bud / Tree / Bloom の 1 つに飛ぶ | （実装済の Phase A モジュールなら見せる）|
| 9 | 右上ベルクリック → drawer | 「重要な通知はベルでまとめて確認」 |
| 10 | 全体感想を聞く | （後道さんからの直感判断、memory `project_godo_ux_adoption_gate.md`）|

## 起動失敗時の対処

| エラー | 対処 |
|---|---|
| `npm install` で deps エラー | `npm install --legacy-peer-deps` |
| `npm run dev` で port 3002 in use | 別 port 起動: `npm run dev -- -p 3003` |
| 画像が表示されない | `public/images/atmospheres/01-06.png` 配置確認 |
| 画面が真っ白 | DevTools (F12) Console エラー確認 |
| Hot Reload 効かない | dev server 再起動 |

## 5/5 直前 24h チェック

| 項目 | 期限 |
|---|---|
| dispatch v7 V7-B / V7-C 完走 | 5/3 まで |
| 全機能 5/5 デモ用に動作確認 | 5/4 |
| 後道さん向け説明文 1 ページ印刷準備 | 5/4 |
| 念のため backup 再実行 | 5/4 |
| デモ当日朝 PC 起動 → 開発サーバ起動確認 | 5/5 朝 |

## 改訂履歴

- 2026-04-27 初版（a-main-009、Team プラン 48h ブロック中の 5/5 デモ準備手順）

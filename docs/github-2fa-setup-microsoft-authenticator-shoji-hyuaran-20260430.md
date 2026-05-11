# GitHub 2FA 設定ガイド（Microsoft Authenticator 版） - shoji-hyuaran

> 対象アカウント: shoji-hyuaran（C 垢、Hyuaran org Owner）
> 期限: 2026-06-12 00:00 UTC（45 日以内）
> 推奨実施日: 5/5 後道さんデモ後（5/6-10）
> 所要時間: 30 分（事前準備 5 分 + 本番 15 分 + 確認・保管 10 分）

---

## 全体像（5 ステップ）

```
[1] 事前準備（スマホ + PC + 紙）
       ↓
[2] GitHub 設定画面で 2FA 開始
       ↓
[3] Microsoft Authenticator で QR スキャン
       ↓
[4] 6 桁コード入力で認証完了
       ↓
[5] Recovery code を必ず保管（最重要）
```

---

## ステップ 1: 事前準備（5 分）

### 用意するもの

| # | 項目 | 説明 |
|---|---|---|
| 1 | スマホ（Microsoft Authenticator インストール済）| App Store / Google Play から無料 DL |
| 2 | PC で GitHub にログイン中（shoji-hyuaran）| Chrome 推奨 |
| 3 | A4 用紙 + ペン | Recovery code を書き写すため |
| 4 | 静かな 30 分の時間 | 途中中断しない |

### Microsoft Authenticator のクラウドバックアップを ON にする（重要）

スマホ紛失時に復旧できるよう、先にバックアップを ON：

1. スマホで Microsoft Authenticator アプリを起動
2. 右上の「**︙**」（縦 3 点メニュー）をタップ
3. 「**設定**」をタップ
4. 「**クラウドバックアップ**」を **ON** にする
   - iPhone: iCloud に保存
   - Android: 個人 Microsoft アカウントに保存
5. もし Microsoft アカウントでサインインを求められたら、東海林さん個人の Microsoft アカウントでサインイン

→ これで機種変時もアカウントを引き継げる。

---

## ステップ 2: GitHub で 2FA 設定を開始（5 分）

### PC 側操作

1. Chrome で **https://github.com** にアクセス、shoji-hyuaran でログイン中であることを確認
2. 右上の **アバター画像（自分のアイコン）** をクリック
3. ドロップダウンメニューから「**Settings**」をクリック
4. 左サイドバーの「**Password and authentication**」をクリック
5. ページを下にスクロールして「**Two-factor authentication**」セクションを探す
6. 「**Enable two-factor authentication**」ボタンをクリック
7. 次の画面で「**Set up using an app**」を選択

→ QR コード が画面に表示される。**この画面を閉じずにスマホ操作へ。**

---

## ステップ 3: Microsoft Authenticator で QR スキャン（3 分）

### スマホ側操作

1. Microsoft Authenticator アプリを開く
2. 右上の「**+**」ボタンをタップ（アカウント追加）
3. 「**他のアカウント (Google、Facebook など)**」を選択
   - ※ 「個人のアカウント」「職場または学校のアカウント」ではない
4. カメラが起動する（カメラアクセス許可を求められたら「許可」）
5. **PC 画面に表示されている QR コードにスマホをかざす**
6. 自動で読み取られて、アカウント一覧に「**GitHub: shoji-hyuaran**」が追加される
7. タップすると **6 桁の数字コード** が表示される（30 秒ごとに変わる）

---

## ステップ 4: 6 桁コード入力で認証完了（2 分）

### PC 側操作に戻る

1. 先ほど開いていた GitHub QR コード画面の下に「**Verify the code from the application**」入力欄がある
2. スマホに表示されている **6 桁の数字** をその欄に入力
3. 「**Continue**」または「**Verify**」ボタンをクリック

⚠️ **注意**: 30 秒で数字が変わるので、入力中に変わったら新しい数字で入力し直す。**焦らずゆっくり**。

→ 認証成功すると「**Recovery codes**」画面に進む。

---

## ステップ 5: Recovery code を必ず保管（10 分・最重要）

### Recovery code とは

スマホを紛失・故障した時の **最後の命綱**。これを失うと **C 垢に二度とログインできなくなる** = Garden 全停止。

### 表示される 16 桁のコード × 16 個

例（実際は違う値）:
```
a1b2-c3d4-e5f6-g7h8
i9j0-k1l2-m3n4-o5p6
...（16 行）
```

### 保管方法（3 重保管推奨）

| # | 方法 | 推奨度 |
|---|---|---|
| **1** | **「Download」ボタンで .txt ファイルを DL → USB メモリに保存（オフライン）** | ⭐ 必須 |
| **2** | **「Print」ボタンで紙に印刷 → 鍵付き引き出し or 金庫に保管** | ⭐ 必須 |
| 3 | 1Password / KeePass などのパスワードマネージャに保管 | ⭐ 推奨 |
| ❌ | メール送信、Google ドライブ、Dropbox 等のクラウド | 🔴 禁止（乗っ取られたら終了）|
| ❌ | スマホ内のメモ帳 | 🔴 禁止（スマホ紛失時に役立たない）|

### 保管完了後

1. GitHub 画面の「**I have saved my recovery codes**」チェックボックスにチェック
2. 「**Continue**」または「**Done**」ボタンをクリック

→ **2FA 有効化完了**。

---

## 完了確認

1. GitHub 設定画面の「**Two-factor authentication**」が「**Enabled**」になっている
2. ログアウトして再ログインを試す
3. ID + Password 入力後に **6 桁コードを求められる** ことを確認
4. Microsoft Authenticator の 6 桁コードを入力
5. ログイン成功 → 設定完了

---

## NG パターンと対策

| NG パターン | 何が起きる | 対策 |
|---|---|---|
| Recovery code を保管せず「Done」を押す | スマホ紛失時に C 垢失う = Garden 全停止 | 必ず DL + 印刷の 2 重保管してから Done |
| 6 桁コードを 3 回以上連続失敗 | 一時的にロック、最悪 ban 引金 | 30 秒で変わるので焦らずゆっくり、変わったら新しい値で入力 |
| Microsoft Authenticator のクラウドバックアップ OFF | 機種変時にアカウント引き継げない | ステップ 1 で必ず ON |
| 設定中にブラウザを閉じる | やり直し | 完了まで Chrome 画面を閉じない |
| 「個人のアカウント」「職場または学校のアカウント」を選んでしまう | GitHub アカウント追加できない | 必ず「他のアカウント (Google、Facebook など)」を選ぶ |

---

## トラブル時の連絡先

| トラブル | 対応 |
|---|---|
| QR コード読み取れない | 「**enter the code manually**」リンクから手動入力可能（GitHub 画面に表示される長い文字列をスマホに入力）|
| Microsoft Authenticator にアカウント追加されない | アプリ再起動して再試行 |
| 6 桁コードが「Invalid」エラー | スマホと PC の時刻ズレ確認、両方とも自動時刻同期 ON |
| Recovery code を紛失 | GitHub Support に連絡（C 垢 ban の最大要因）|
| 設定後ログインできない | Recovery code を入力（保管していれば復旧可能）|

GitHub Support: https://support.github.com/

---

## 補足: 他端末・他アカウントへの追加（任意）

設定完了後の余裕時間に、以下を追加すると更に安全：

1. **Passkey の追加**（Settings → Passkeys → Add a passkey）: パスワードレスで超安全
2. **GitHub Mobile アプリ**: スマホでも push 通知で承認可能
3. 別のスマホやタブレットを **2 台目の TOTP 端末** として登録（Microsoft Authenticator のクラウドバックアップで可能）

---

## 改訂履歴

- 2026-04-30 初版（a-main-010、東海林さん依頼）

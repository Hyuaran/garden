# GitHub 2FA 設定ガイド（SMS 版） - shoji-hyuaran

> 対象アカウント: shoji-hyuaran（C 垢、Hyuaran org Owner）
> 期限: 2026-06-12 00:00 UTC（45 日以内）
> 推奨実施日: 5/5 後道さんデモ後（5/6-10）
> 所要時間: 25 分（事前準備 3 分 + 本番 12 分 + 確認・保管 10 分）
> 採用理由: Microsoft Authenticator アプリは会社管理 MS アカウントへの影響懸念で除外（memory `project_github_2fa_sms_only_policy.md`）

---

## 全体像（5 ステップ）

```
[1] 事前準備（PC + スマホ + 紙）
       ↓
[2] GitHub 設定画面で 2FA 開始
       ↓
[3] SMS 方式選択 + 電話番号入力
       ↓
[4] SMS で届いた 6 桁コード入力
       ↓
[5] Recovery code を必ず保管（最重要）
```

⚠️ **このガイドでは Microsoft Authenticator アプリを一切開きません**。会社管理 MS アカウントとは完全分離です。

---

## ステップ 1: 事前準備（3 分）

### 用意するもの

| # | 項目 | 説明 |
|---|---|---|
| 1 | PC で GitHub にログイン中 | Chrome 推奨、shoji-hyuaran でログイン |
| 2 | スマホ手元 | SMS 受信できる状態、圏内で電源 ON |
| 3 | A4 用紙 + ペン | Recovery code 書き写し用（後で印刷でも OK）|
| 4 | USB メモリ | Recovery code .txt 保存用 |
| 5 | 静かな 25 分の時間 | 途中中断しない |

### 電話番号の確認

GitHub に登録する電話番号 = 業務スマホの番号 を事前に確認：
- 例: `090-1234-5678`
- これを国際形式に変換: `+81 90-1234-5678` または `+81 9012345678`
- **国コード `+81` が必要**、先頭の `0` は省略

---

## ステップ 2: GitHub で 2FA 設定を開始（4 分）

### PC 側操作

1. Chrome で **https://github.com** にアクセス、shoji-hyuaran でログイン中であることを確認
2. 右上の **アバター画像（自分のアイコン）** をクリック
3. ドロップダウンメニューから「**Settings**」をクリック
4. 左サイドバーの「**Password and authentication**」をクリック
5. ページを下にスクロールして「**Two-factor authentication**」セクションを探す
6. 「**Enable two-factor authentication**」ボタンをクリック

→ 2FA 設定方法選択画面に進む。

---

## ステップ 3: SMS 方式選択 + 電話番号入力（3 分）

### SMS オプションを選ぶ

GitHub の最新 UI では、**最初に Authenticator app 設定画面が出てくる場合がある**。その場合は以下を探す：

| 表示パターン | 対応 |
|---|---|
| 「**Set up using SMS**」ボタンが表示 | クリック |
| 「**Add a fallback SMS number**」リンク | これをクリック |
| 「**Other 2FA options**」「**SMS**」 | これを選択 |
| Authenticator setup 画面しか出ない | 一旦キャンセル → 別の手順（後述）|

### 電話番号入力

1. **国コード**を「**+81 (Japan)**」に変更
2. **電話番号**を入力（先頭の 0 は省く）
   - 例: 携帯番号 `090-1234-5678` → 入力欄には `9012345678` または `90 1234 5678`
3. 「**Send authentication code**」ボタンをクリック

⚠️ **電話番号を間違えると他人に SMS が届く** ので、入力後にゆっくり確認してから送信ボタンを押す。

---

## ステップ 4: SMS で届いた 6 桁コード入力（3 分）

### スマホで受信

1. 数秒〜30 秒以内に SMS が届く
2. 送信元: GitHub（または `+1 (xxx) xxx-xxxx` 等の海外番号）
3. メッセージ例: `Your GitHub verification code is: 123456`

### PC で入力

1. PC に戻り、**6 桁コード** を入力欄に入れる
2. 「**Continue**」または「**Verify**」ボタンをクリック

⚠️ **届かない場合の対処**:

| 症状 | 対処 |
|---|---|
| 1 分待っても届かない | 「**Resend code**」ボタンで再送信 |
| 何度送っても届かない | 電話番号入力ミスの可能性 → 戻ってやり直し |
| 海外番号からの SMS 拒否設定が ON になっている | キャリア設定で「海外発信 SMS 受信」を ON |

---

## ステップ 5: Recovery code を必ず保管（10 分・最重要）

### Recovery code とは

スマホ番号失った時、SMS 届かない時の **最後の命綱**。これを失うと **C 垢に二度とログインできなくなる** = Garden 全停止。

### 表示される 16 桁のコード × 16 個

例（実際は違う値）:
```
a1b2-c3d4-e5f6-g7h8
i9j0-k1l2-m3n4-o5p6
...（16 行）
```

### 保管方法（3 重保管必須）

| # | 方法 | 推奨度 | 注意点 |
|---|---|---|---|
| **1** | **「Download」ボタンで .txt ファイルを DL → USB メモリに保存（オフライン）** | ⭐ 必須 | USB は鍵付き引き出しに保管 |
| **2** | **「Print」ボタンで紙に印刷 → 鍵付き引き出し or 金庫に保管** | ⭐ 必須 | 印刷後はゴミ箱に下書きを残さない |
| 3 | 1Password / KeePass などのパスワードマネージャに転記 | ⭐ 推奨 | 既に使っているなら追加 |
| ❌ | メール送信、Google ドライブ、Dropbox 等のクラウド | 🔴 禁止 | 乗っ取られたら終了 |
| ❌ | スマホ内のメモ帳 | 🔴 禁止 | スマホ紛失時に役立たない |
| ❌ | LINE / Chatwork / Slack | 🔴 禁止 | アカウント乗っ取り時に終了 |

### 保管完了後

1. GitHub 画面の「**I have saved my recovery codes**」チェックボックスにチェック
2. 「**Continue**」または「**Done**」ボタンをクリック

→ **2FA 有効化完了**。

---

## 完了確認（3 分）

1. GitHub 設定画面の「**Two-factor authentication**」が「**Enabled**」になっている
2. ログアウトして再ログインを試す
3. ID + Password 入力後に **6 桁コードを求められる** ことを確認
4. スマホに SMS が届く → 6 桁を入力 → ログイン成功
5. → 設定完了

---

## NG パターンと対策

| NG パターン | 何が起きる | 対策 |
|---|---|---|
| Recovery code を保管せず「Done」を押す | スマホ番号失った時に C 垢失う = Garden 全停止 | 必ず DL + 印刷の 2 重保管してから Done |
| 6 桁コードを 3 回以上連続失敗 | 一時的にロック、最悪 ban 引金 | 焦らずゆっくり、変わったら新しい SMS 送ってもらう |
| 電話番号を間違えて入力 | 他人に SMS が届く + 設定不可 | 入力後にゆっくり確認してから送信 |
| 設定中にブラウザを閉じる | やり直し | 完了まで Chrome 画面を閉じない |
| 「+81」を付け忘れる | SMS 届かない | 国コード必須 |
| Authenticator app 設定画面のまま進める | TOTP 設定になってしまう | キャンセル → SMS option を探す（次セクション参照）|

---

## 補足: SMS option が見つからない場合

最新の GitHub UI では、**最初に Authenticator app 設定が表示される** 仕様です。SMS にたどり着く方法：

### パターン A: Authenticator app 設定画面で「Cancel」→「Add fallback SMS」

1. Authenticator app の QR コード画面で「**Cancel**」
2. 元の Two-factor authentication 設定画面に戻る
3. 「**Add a fallback SMS number**」リンクをクリック
4. → ステップ 3 へ

### パターン B: 一旦 Authenticator 設定をスキップ → 後から SMS のみ残す

GitHub は **Authenticator app + SMS の併用が前提** で、SMS 単独運用が UI 上やりにくい場合があります。その場合：

1. 仕方なく Authenticator app を一旦設定（Microsoft Authenticator は使わず、別アプリで）
2. SMS も併用設定
3. 設定後、Authenticator app を **無効化**

→ ただし この方法は東海林さんの懸念（Authenticator アプリ操作）に反するので、**パターン A を最優先で試す**。

### パターン C: 設定が困難な場合

GitHub Support に「SMS only での 2FA 設定希望、UI 上で見つからない」と問い合わせ。Sophia Hayes（Ticket #4330372 担当）に併記して相談も可。

---

## トラブル時の連絡先

| トラブル | 対応 |
|---|---|
| SMS 来ない | 「Resend code」で再送、それでも来ない場合は電話番号確認 |
| 6 桁コード Invalid エラー | 古いコードは無効、最新の SMS で入力 |
| 設定後ログインできない | Recovery code を入力（保管していれば復旧可能）|
| Recovery code 紛失 | GitHub Support に連絡（C 垢 ban の最大要因）|
| 電話番号変更した | GitHub Settings で番号更新を忘れずに |

GitHub Support: https://support.github.com/

---

## SIM swap 攻撃対策（任意・推奨）

SMS 認証の最大リスクは「攻撃者がキャリアに偽装連絡 → SIM 再発行 → SMS 乗っ取り」です。対策：

### キャリア別の設定方法

| キャリア | 設定方法 |
|---|---|
| NTT ドコモ | My docomo → 「ネットワーク暗証番号」と「SIM 再発行制限」を設定 |
| au | My au → 「機種変更ロック」「番号変更ロック」を ON |
| ソフトバンク | My SoftBank → 「機種変更受付制限」を ON |
| 楽天モバイル | my 楽天モバイル → 各種制限設定 |

### 重要事項

- **携帯ショップでの本人確認を厳格化** する設定を入れる
- 4 桁の暗証番号を **誕生日 / 連番 / ゾロ目を避ける**
- パスワード使い回し禁止

---

## 補足: 他端末・他アカウントへの追加（任意）

設定完了後の余裕時間に、以下を検討（無理に勧めない）：

1. **GitHub Mobile アプリ**: スマホで push 通知ベースの 2FA 承認も可能（Authenticator アプリではない）
2. **Passkey の追加**: パスワードレスで超安全、ただし設定時間あり
3. **業務用と個人用で 2 つの電話番号を登録**: 片方失った時の保険

東海林さんが完全に納得した時のみ実施、強制不要。

---

## 改訂履歴

- 2026-04-30 初版（a-main-010、東海林さん「MS Authenticator 不採用、SMS 採用」明示後）

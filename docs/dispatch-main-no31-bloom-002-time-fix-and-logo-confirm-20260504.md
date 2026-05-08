# main- No. 31 dispatch - a-bloom-002 残差分修正（# 2 時刻桁削れ + # 1 ロゴ表示調整）- 2026-05-04

> 起草: a-main-011
> 用途: bloom-002- No. 13 完了報告に対し、Chrome MCP 視覚検証で残差分 2 件特定、追加修正依頼
> 番号: main- No. 31
> 起草時刻: 2026-05-04(月) 15:18
> 緊急度: 🟡（5/8 デモまで残り 4 日、余裕あり）

---

## 投下用短文（東海林さんが a-bloom-002 にコピペ）

~~~
🟡 main- No. 31
【a-main-011 から a-bloom-002 への dispatch（残差分修正：# 2 時刻桁削れ + # 1 ロゴ表示調整）】
発信日時: 2026-05-04(月) 15:18

bloom-002- No. 13 受領、a-main-011 が Chrome MCP で再視覚検証完了。
5 差分中 3 件解消、2 件未解消のため追加修正依頼します。

【視覚検証結果】

| # | 差分 | 状態 |
|---|---|---|
| 1 | Sidebar 左上構造 | 🟡 重なり解消 ✅ / ロゴ表示は調整必要（後述）|
| **2** | **Activity Panel 時刻桁削れ** | 🔴 **未解消「1:30 / 0:45 / 0:05」のまま** |
| 3 | Sidebar デフォルト展開 | ✅ OK |
| 4 | Topbar 22℃ 晴れ | ✅ OK |
| 5 | 背景花配置 | 🟢 微差、致命的でない |

【# 2 修正：Activity Panel 時刻桁削れ（必須）】

bloom-002- No. 13 で `white-space: nowrap` + `min-width: 44px` を追加と
報告ありましたが、実機（localhost:3000/bloom）では依然「1:30 / 0:45 / 0:05」と
桁削れたまま。プロト（localhost:3000/_proto/bloom-top/index.html）では
「11:30 / 10:45 / 10:05」と完全表示。

考えられる原因仮説（DevTools で確認推奨）:

1. **親要素の制約で min-width が効かない**
   - .activity-item の grid-template-columns / flex-basis で時刻列幅が固定
   - .activity-time の min-width より親の制約が優先

2. **specificity 不足**
   - 別の CSS rule で width / max-width が上書きされている
   - LEGACY セクション内の旧 rule が残存している可能性

3. **44px では物理的に不足**
   - 「11:30」= 5 文字 × フォント幅 ~10px = 50px 前後必要
   - 「09:20」「08:50」も同様

修正手順（推奨）:

1. Chrome DevTools で /bloom の Activity Panel 時刻要素を検証
   - .activity-time の **Computed styles** を確認
   - 実際の width / min-width / 親の制約を特定
2. プロト style.css の該当箇所と比較
   - `public/_proto/bloom-top/css/style.css` で時刻関連 rule を grep
   - `time` / `activity-time` / `entry-time` 等のクラス名探索
3. プロト準拠の CSS に修正
   - 親要素の grid / flex 設定を含めて整合
   - min-width: 60px 以上を試行（44px は不足の可能性）
   - white-space: nowrap + overflow: visible

【# 1 確認：Sidebar 左上ロゴ表示調整（オプション）】

東海林さんから **公式ブランドロゴ画像**を提示確認:
- 構成: **木のアイコン（水彩風）+ "Garden Series" テキスト + 「業務を、育てる。/ Grow Your Business.」tagline**
- これが Garden Series 公式ロゴ（プロト v1.4 のテキストロゴ「Garden Series」だけは古い）

→ **既存実装の方針が正解**（プロトに合わせる必要なし）。

ただし、現状の Sidebar 左上の表示が窮屈に見える可能性があるため、確認:

| 確認項目 | 内容 |
|---|---|
| (a) 現状のロゴ画像 | Sidebar 左上で使用中の画像 path を確認、公式ロゴと一致するか |
| (b) 表示サイズ | 木のアイコン + テキスト + tagline が Sidebar 幅（~250px）に収まっているか |
| (c) padding / margin | 周辺余白が適切か（重なり感がないか）|

調整推奨:
- ロゴ画像が大きすぎて Sidebar を圧迫している → 画像縮小 or テキスト部分を別 element 化
- 木のアイコン部分のみ Sidebar 上部、Garden Series テキスト + tagline は下部 or 横配置
- フォントサイズ調整で「Bloom」見出し以下のリンクと整合

公式ロゴ画像が a-bloom-002 worktree にまだ配置されていない場合、東海林さんから
画像ファイルを Drive 経由で受け取る必要あり（path: `_chat_workspace/_shared/attachments/`
等）。現状の画像で十分なら現状維持で OK。

【削除禁止ルール継続】

- bloom-002- No. 13 の修正で legacy 保持済（BloomSidebar.legacy-1to1-port-20260503.tsx）
- 今回の追加修正で .tsx / .css を更新する場合、再度 legacy 保持
  例: BloomSidebar.legacy-narrow-fix-20260504.tsx 等

【視覚一致検証フロー（継続）】

a-main-011 が Chrome MCP で修正後再スクショ → 残差分判定。
a-bloom-002 は完了報告（bloom-002- No. 14）で：
- # 2 時刻桁削れの対応内容（DevTools で特定した原因 + 修正内容）
- # 1 ロゴ表示の確認結果（現状で OK or 調整実施）

【完了報告フォーマット】

bloom-002- No. 14 で:
- commit hash + push 状態
- # 2 修正内容（CSS 変更箇所 + 効果確認）
- # 1 確認結果（現状ロゴ画像 path + 表示状態）
- legacy 保持ファイル（追加分）
- 完了時刻

【補足: 5/8 デモ向け】

- 5/8 デモまで残り 4 日、修正完了 → a-main-011 視覚検証 → 東海林さん最終 OK の流れ
- # 2 が解消すれば視覚一致達成見込み

【dispatch counter】

a-main-011: 次 main- No. 32
a-bloom-002: bloom-002- No. 14 で完了報告予定

工数見込み: 30 分〜1 時間（# 2 の DevTools 調査 + CSS 修正が中心）

ご対応お願いします。
~~~

---

## 配布手順（東海林さん）

| Step | 内容 |
|---|---|
| 1 | 上記 `~~~` 内をコピー |
| 2 | a-bloom-002 / Garden Bloom 002 セッションに貼り付け投下 |

→ a-bloom-002 が DevTools 調査 + 修正 + push → a-main-011 が Chrome MCP で再検証 → 視覚一致まで修正ループ → 一致後に東海林さん最終 OK 確認。

## 関連スクショ（私が今回取得）

| URL | 観察 |
|---|---|
| http://localhost:3000/bloom（修正後）| 22℃ 晴れ ✅ / Sidebar 構造改善 ✅ / 時刻 1:30 ❌ |
| http://localhost:3000/_proto/bloom-top/index.html（プロト v1.4）| 22℃ 晴れ / Sidebar 整然 / 時刻 11:30 |

## 改訂履歴

- 2026-05-04 15:18 初版（a-main-011、bloom-002- No. 13 完了報告 + 公式ブランドロゴ確認後、Chrome MCP 視覚検証で # 2 残存 + # 1 ロゴ方針確定として起草）

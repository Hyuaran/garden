# main- No. 16 dispatch - a-bloom-002 試作版 1:1 移植 + 削除禁止ルール - 2026-05-02

> 起草: a-main-011
> 用途: Bloom Top を試作版（claude.ai v1.4）の 1:1 忠実移植で再構築。既存実装は削除せず「データとして」保持
> 番号: main- No. 16
> 起草時刻: 2026-05-02(土) 21:29
> 背景: main- No. 15 v2 の A 案（既存維持と試作版取り込みのミックス）が破綻 → 方針転換

---

## 投下用短文（東海林さんが a-bloom-002 にコピペ）

~~~
🔴 main- No. 16
【a-main-011 から a-bloom-002 への dispatch（試作版 1:1 移植 + 削除禁止ルール）】
発信日時: 2026-05-02(土) 21:29

bloom-002- No. 10（Step 2 全差分洗い出し）受領しました。
東海林さんが localhost:3000/bloom を視覚確認した結果、ロゴエリアの重なり等で
「むちゃくちゃ」との評価。A 案（既存と試作版のミックス）は破綻したと判断、
**試作版 1:1 忠実移植**に方針転換します。

【最重要ルール: 削除禁止】

東海林さんから明示指示:
**「現在のデザインを削除せず、裏でデータとして残しておく」**

→ 既存コード・CSS・component を git 履歴だけでなく **ファイルとしても保持**してください。

具体運用:
1. **page.tsx 等の置換時**: 旧版を `*.legacy-mixed-20260502.tsx` 等にコピーして併存
   例: `src/app/bloom/page.tsx` → `src/app/bloom/page.legacy-mixed-20260502.tsx` を作成後、
   `page.tsx` を試作版 1:1 移植版に書き換え

2. **globals.css の bloom-page セクション**: 旧版を以下で囲って保持、新版を下に追記
   ```css
   /* ===== LEGACY: bloom-page (mixed v1, kept as data 2026-05-02) ===== */
   /* ... 旧 rule をすべてコメントアウトせず保持（CSS としては有効でも問題なし、新セレクタが上書きする想定）... */
   /* ===== END LEGACY ===== */

   /* ===== bloom-page v2 (prototype 1:1 port 2026-05-02) ===== */
   /* ... 試作版準拠の新 rule ... */
   ```

3. **BloomSidebar.tsx 等の component**: 試作版準拠で書き換える場合、旧版を
   `BloomSidebar.legacy-mixed-20260502.tsx` 等にコピー保持

4. **削除コマンド禁止**: `rm` / `Remove-Item` / `del` でファイル消去禁止
   （settings.json の deny でシステム的にも禁止済）

→ 後日「あの時の旧デザイン見たい」と東海林さんが言った時、git log なしで
ファイル直接参照できる状態を維持。

【依頼: Bloom Top を試作版 1:1 で React 移植】

ベース素材: `public/_proto/bloom-top/index.html` (v1.4) + 同フォルダ css / js

移植方針:
- HTML 構造（DOM 階層、tag、class 名、id）を **そのままコピー**
- CSS rule（class 名、property 値、media query）を **そのままコピー**
- 文言（テキスト、placeholder、aria-label）を **そのままコピー**
- 画像 path（D-01_favorite_simple.png 等）を **そのままコピー**（必要なら public/ に複製）
- アニメーション・transition・micro-interaction を **そのままコピー**

React 化での最小限の変換:
- `<script>` タグ内 vanilla JS → React component の useEffect / useState
- `localStorage` 操作はそのまま JS API 使用 OK
- 画像 path は Next.js の public/ 起点で調整

既存ロジック流用 OK（試作版にない or 既存の方が優れる）:
- **D12 ログアウト機能**: bloom_users + Forest 認証連携の既存ロジック流用
- **D21/D23 Coming Soon Toast**: dispatch main- No. 14 で実装済の Toast 流用
- **D7 sound toggle (playPon)**: 既存維持（試作版にないが追加機能として残置）
- **BloomGate dev バイパス**: main- No. 9 commit 988efa5 維持

それ以外（Topbar 全要素、ActivityPanel content、Sidebar 構造、KPI/Nav カード、
背景装飾、お気に入りボタン dropdown、User dropdown 等）は **試作版 1:1 移植**。

【完成判定】

以下を満たすことを確認してから完了報告:
1. `localhost:3000/bloom` と `localhost:3000/_proto/bloom-top/index.html` を
   Chrome 2 タブで並べて視覚的に **区別つかない** こと
2. screenshot 並列（既存 + 試作版）を再取得して保存
3. 主要 break point（1920 / 1440 / 1024）で崩れないこと
4. light / dark theme 両方で視覚一致

【視覚比較資料の更新】

完了後、以下を更新（既存ファイルに追記 or v2 として新規作成）:
- `_chat_workspace\garden-bloom\diff_analysis\chat-bloom-top-diff-overview-20260502-v2.md`
  → 1:1 移植後の差分（残差異あれば）を再洗い出し
- `_chat_workspace\garden-bloom\diff_analysis\chat-bloom-top-diff-screenshots-20260502-v2.md`
  → 移植後の screenshot 並列、視覚一致確認

【Turbopack HMR 注意】

memory feedback_turbopack_hmr_globals_css_unreliable.md 参照。
globals.css 大量変更（LEGACY コメント化 + 新 rule 大量追加）必須なので、
最初から dev server 再起動 + .next キャッシュクリアを組み込んでください。

【完了報告】

bloom-002- No. 11 で完了報告:
- commit hash + push 状態
- 1:1 移植で達成した範囲（試作版に揃った要素一覧）
- 残差異（試作版にあるが実装できなかった要素 + 理由）
- screenshot 並列の path
- LEGACY 保持ファイルの path 一覧

工数見込み: 3-4h（A 案 4.5h より短縮、混合判断不要のため）

【dispatch counter】

a-main-011: 次 main- No. 17
a-bloom-002: bloom-002- No. 11 で完了報告予定

ご対応お願いします。
~~~

---

## 配布手順（東海林さん）

| Step | 内容 |
|---|---|
| 1 | 上記 ~~~ 内をコピー |
| 2 | a-bloom-002 / Garden Bloom 002 セッションに貼り付け投下 |

→ a-bloom-002 が試作版 1:1 移植 + 旧版データ保持で再構築。

## 削除禁止ルールの memory 化

東海林さん明示指示「現在のデザインを削除せず、裏でデータとして残しておく」を
今回のセッション後に新規 feedback memory として保存予定:
- ファイル: `feedback_no_delete_keep_legacy.md`
- 内容: コードリプレース時に旧版を `*.legacy-XXX.tsx` 等で併存、CSS は LEGACY コメントブロックで保持、削除コマンド禁止

## 改訂履歴

- 2026-05-02 21:29 初版（a-main-011、東海林さん「A 採択 + 削除禁止」明示後）

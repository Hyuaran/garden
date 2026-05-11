# main- No. 41 dispatch - a-bloom-003 シリーズロゴ → spin / ログアウト → login ナビ追加 - 2026-05-05

> 起草: a-main-012
> 用途: 東海林さん指示「シリーズロゴ → spin」「アバター内ログアウト → login」を全 4 画面に反映
> 番号: main- No. 41
> 起草時刻: 2026-05-05(火) 14:48（宛先 a-bloom-003 に更新: 15:08）
> 緊急度: 🟡 5/8 デモ向け（3 日余裕、ナビ統一の最終仕上げ）

## 宛先変更について

a-bloom-002 は context 84% 到達のため a-bloom-003 に引き継ぎ完了（bloom-003- No. 24 で受領通知）。
本 dispatch は a-bloom-003 宛に発信します。

---

## 投下用短文（東海林さんが a-bloom-002 にコピペ）

~~~
🟡 main- No. 41
【a-main-012 から a-bloom-003 への dispatch（シリーズロゴ → spin / ログアウト → login ナビ追加）】
発信日時: 2026-05-05(火) 15:08

a-bloom-003 への引継ぎ受領（bloom-003- No. 24）。

【先に a-main-012 からの状況共有】

main- No. 40 後の Chrome MCP 視覚検証 4 項目すべて完了 ✅:
1. ceostatus nav-pages-header「Bloom」→ /bloom 遷移成功（href="/bloom" + 実クリック）
2. garden-home Bloom orb → /bloom 遷移成功（orb-card href="/bloom" + 実クリック）
3. Topbar img 180×60 全 4 画面（bloom / bloom-top / ceostatus / garden-home）統一達成
4. login (.brand 300×100) / spin (.brand-link 525×175) は Topbar 外で正常

→ main- No. 38 の修正反映完了。次の依頼が main- No. 41 です。

【新規依頼: 東海林さん指示】

「bloom ページのアバター内ログアウトから login 画面に飛ぶ、シリーズロゴから spin に飛ぶ」

a-main-012 が Chrome MCP で全 4 画面（/bloom + proto 3 画面）の Topbar 構造を DOM 検証済。修正依頼します。

【現状ギャップ表（DOM 検証結果）】

| 画面 | brand href 現状 | logout 現状 |
|---|---|---|
| /bloom (React Topbar) | `"/"` | `<button>` href 無し（onClick 不明） |
| /_proto/bloom-top | `"../../000_GardenUI/index.html"`（壊れた相対 path） | `href="#"` |
| /_proto/ceostatus | `"../../000_GardenUI/index.html"`（壊れた相対 path） | `href="#"` |
| /_proto/garden-home | `"index.html"`（自身を指す） | `href="#"` |

【期待値】

全 4 画面で:
- brand link → `href="/_proto/garden-home-spin/"`
- logout link → `href="/_proto/login/"`

【修正対象】

# A: /bloom (React 本番) Topbar コンポーネント

ファイル特定 → 推定:
- `src/app/bloom/_components/BloomTopbar.tsx`（or 同等）
- `src/app/bloom/_components/UserDropdown.tsx`（or 同等）

修正:
1. ブランドロゴ `<a href="/">` → `<a href="/_proto/garden-home-spin/">`
   - Next.js `<Link>` 使用ならば `<Link href="/_proto/garden-home-spin/">`
2. ログアウト `<button>` → `<a href="/_proto/login/">` に変更（or onClick で `window.location.href = '/_proto/login/'`）
   - クラス名 `user-dropdown-item user-dropdown-item-logout` 維持

# B: /_proto/bloom-top/index.html

```bash
sed -i 's|href="\.\./\.\./000_GardenUI/index\.html"|href="/_proto/garden-home-spin/"|g' \
  /c/garden/a-bloom-002/public/_proto/bloom-top/index.html

# logout の href="#" → href="/_proto/login/"
# user-dropdown-item-logout クラス名でマッチして置換
```

具体的には Edit tool で:
- `<a href="../../000_GardenUI/index.html"` を含む brand 行 → `<a href="/_proto/garden-home-spin/"`
- `<a class="user-dropdown-item user-dropdown-item-logout" href="#">` → `<a class="user-dropdown-item user-dropdown-item-logout" href="/_proto/login/">`

# C: /_proto/ceostatus/index.html

bloom-top と同じ修正（同パターン）

# D: /_proto/garden-home/index.html

```
<a href="index.html"  ← brand 行
↓
<a href="/_proto/garden-home-spin/"
```

logout 行は他と同じ修正

【検証フロー（a-main-012 が実施）】

修正後 push 受領 → Chrome MCP で全 4 画面の DOM 確認:
1. brand img の親 `<a>` href = "/_proto/garden-home-spin/" 統一
2. logout `<a>` or onClick 遷移先 = "/_proto/login/" 統一
3. 実クリックで bloom → spin 遷移、各画面 logout → login 遷移
4. spin 画面でも Bloom orb クリックで /bloom 復帰可能（既確認済）

【削除禁止ルール】

修正対象 4 ファイルすべて legacy 保持:
- `src/app/bloom/_components/<Topbar>.legacy-brand-logout-nav-20260505.tsx`
- `_proto/bloom-top/index.legacy-brand-logout-nav-20260505.html`
- `_proto/ceostatus/index.legacy-brand-logout-nav-20260505.html`
- `_proto/garden-home/index.legacy-brand-logout-nav-20260505.html`

【完了報告フォーマット】

bloom-003- No. 25 で:
- commit hash + push 状態
- # A 修正対象ファイル名 + diff 要約
- # B/C/D Edit 結果（before/after の href）
- legacy 保持ファイル一覧
- 完了時刻

【dispatch counter】

a-main-012: 次 main- No. 42
a-bloom-003: bloom-003- No. 25 で完了報告予定

工数見込み: 30 分（React コンポーネント 1〜2 ファイル特定 + Edit、proto 3 ファイル sed/Edit）

ご対応お願いします。
~~~

---

## 改訂履歴

- 2026-05-05 14:48 初版（a-main-012、東海林さん指示「シリーズロゴ → spin / ログアウト → login」+ DOM 検証で 4 画面ギャップ特定後）

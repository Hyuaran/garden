# Codex-372：マニュアル画面の iframe の高さを画面側で測り、資料 HTML に高さ通知スクリプトが無くても本文が途中で切れないようにする（2026-10-14）

## 目的（東海林さんの言葉）
- 「マニュアルの中身で、途中で途切れてしまってる箇所が複数ありました。途切れないように修正してください。今後作成するマニュアルの際も同様の事象が起きないようにしてください」
- 事実（Claude が確認）：資料 HTML（テレマ コール集計の①②③）に「自分の高さを親へ `postMessage({__docHeight})` する小スクリプト」が入っていなかった。画面側は通知が来ないと高さ 600px のまま、しかも**直前に開いていた別タブの高さが残る**（`height` state をタブ切替でリセットしていない）ため、本文が途中で切れて見えた。資料側は Claude が直して Storage へ上げ済み。この指示書は**画面側を、資料側のスクリプトに頼らない作り**にするもの

## 作業場所・禁止事項
- 作業ツリー：`C:\garden\a-bloom-008`。**git の操作は一切しない**（commit・checkout・stash も禁止）
- 触らない：`.env.local`・`vercel.json`・Storage の中身・`src/app/api/system/manuals/**`（配信側は変えない）。本物の外部サービスは呼ばない
- **前から落ちているテスト（`KpiCard` 2 本・`BackgroundCarousel` 5 本）は触らない。通すために `src/app/_lib/kpi-fetchers.ts`・`src/components/shared/garden-view/BackgroundCarousel.tsx` を変えない**（この指示書と無関係・落ちたままでよい）
- 文言は日本語・開発者用語を画面に出さない・絵文字を足さない

## 現状（Claude が読んだ）
- `src/app/system/manuals/ManualDetailClient.tsx`
  - `const [height, setHeight] = useState(600);`
  - `useEffect` で `window` の `message` を受け、`event.data.__docHeight` が数値なら `setHeight(Math.max(600, Math.ceil(docHeight)))`
  - `<iframe title=… src={src} sandbox="allow-same-origin allow-scripts" scrolling="no" style={{ height }} />`（`src` は `/api/system/manuals/<module>/<slug>/<file>?embed=1`・同一オリジン）
  - タブ（`selectedDoc`）が変わっても `height` はそのまま＝前の資料の高さが残る
- 資料側のスクリプト（テンプレ由来・多くの資料に有り）：`parent.postMessage({__docHeight: document.documentElement.scrollHeight}, '*')` を load／resize／200ms／800ms／ResizeObserver で送る
- CSS `manuals.module.css`：`.viewerFrame{overflow:hidden…}` `.viewerFrame iframe{display:block;width:100%;min-height:600px;border:0;background:#fff}`

## 作るもの（`ManualDetailClient.tsx` だけ。見た目・URL・権限・差し替え機能は変えない）

### 1. タブが変わったら高さを戻す
- `selectedDoc?.file`（または `src`）が変わったら `setHeight(600)`。前の資料の高さを引きずらない

### 2. 画面側で自分の高さを測る（資料側のスクリプトが無くても切れない）
- iframe に `ref` と `onLoad` を付ける。`onLoad` で `iframe.contentDocument` を取り（同一オリジン・`sandbox` に `allow-same-origin` があるので読める）、
  - `const measure = () => { const d = ref.current?.contentDocument; if (!d) return; const h = Math.max(d.documentElement.scrollHeight, d.body?.scrollHeight ?? 0); if (h > 0) setHeight(Math.max(600, Math.ceil(h))); }`
  - `measure()` を即時＋`setTimeout` 200ms／800ms で呼ぶ（画像・フォントの遅れを拾う）
  - `ResizeObserver` が使えれば `d.body` を観測して `measure`（資料の中で折りたたみを開いたときなどに追従）。iframe の `load` が再発火したとき・タブが変わったとき・アンマウント時に `disconnect`
  - `contentDocument` が読めない（null・例外）ときは何もしない＝今までどおり `postMessage` 待ち
- 既存の `message` 受信は残す（二重に来ても `setHeight` は同じ値に収れんする）。**`__docHeight` を数値以外・0 以下で受けたら無視**（今と同じ）
- 注意：**高さを測るときに「自分が設定した高さ」に引きずられないこと**。`documentElement.scrollHeight` は中身の高さなので、資料側の CSS に `html,body{height:100%}` や `min-height:100vh` が無い限り膨らまない。念のため、**直前に設定した値と同じなら `setHeight` しない**（無限ループ防止）。資料側 CSS は変えない
- 幅 0 のとき（レイアウト途中など）は測らない（`iframe.getBoundingClientRect().width === 0` なら `measure` を見送る）＝幅 0 だと 1 文字ずつ折り返して高さが数万 px に化ける

### 3. md（④）の表示は変えない
- `selectedDoc.kind === "md"` の分岐は今のまま

## テスト（vitest・`ManualDetailClient.test.tsx` の流儀で）
1. タブ（`selectedDoc`）を切り替えると iframe の `style.height` が `600px` に戻る
2. `message` で `__docHeight: 1234` を受けると `1234px` になる（既存）
3. `onLoad` 時に `contentDocument.documentElement.scrollHeight` が 2000 を返すモックで `2000px` になる（`contentDocument` は jsdom の iframe では取りにくければ `Object.defineProperty(iframe, 'contentDocument', …)` で差し替える）
4. `contentDocument` が null なら何も起きない（`600px` のまま）
5. 既存テスト（`src/app/system/manuals/**`）は緑のまま。**KpiCard・BackgroundCarousel の 7 本は前から落ちている＝対象外**

## 完了報告（コードブロックで。東海林さんがそのまま読む）
1. 変えたファイル一覧（新規／変更）
2. `npx tsc --noEmit` と `npx vitest run src/app/system/manuals` の結果（件数）
3. 画面の確認手順（手元 dev：`/system/manuals/system/call-metrics?tab=overview` → `tab=operation` → `tab=engineer` と替えて、各タブで `iframe.getBoundingClientRect().height` が `iframe.contentDocument.documentElement.scrollHeight` と一致し、本文の末尾（版の表記）まで見えること。**窓幅 1,440px 以上で**）
4. 迷った点・決め打ちした点

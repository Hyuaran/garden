# a-review レビュー — Task D.4 kanden-storage-paths.ts (pure function + TDD)

## 概要

Garden-Leaf 関電業務委託の Storage bucket / path 命名を集中管理する pure module を `src/app/leaf/_lib/kanden-storage-paths.ts` に新設（64 行）+ Vitest テスト 12 ケース（97 行）。3 bucket id 定数 (`RECENT_BUCKET` / `MONTHLY_BUCKET` / `YEARLY_BUCKET`) と 4 path 関数 (`recentPath` / `recentThumbPath` / `monthlyPath` / `yearlyPath`) を export。完全 pure / 外部依存なし / TDD 完備の小ぶりな基盤モジュール。

## 良い点

1. **完全 pure function、ほかの全テストから decoupled**：`vi.mock` も `beforeEach` も不要、全テストが `expect(...).toBe(...)` だけで済んでいる。Storage 連携が増える後続 task でも、本モジュールがバグの震源にならない設計。
2. **bucket id を `as const` で string literal 型に固定**：呼び出し側で `RECENT_BUCKET` を渡したつもりが文字列タイポしていた、という事故を型レベルで防げる。テストにも literal type assertion (`const r: "leaf-kanden-photos-recent" = RECENT_BUCKET`) があり、`as const` が外れたら test fail という二重保証。
3. **path 規約集約による typo 撲滅**：`attachments.ts` や Worker から `${case_id}/thumb/${attachment_id}.jpg` をハードコードする実装を撲滅できる構造。命名規約変更時の影響範囲が本ファイル + テストに収束。
4. **JSDoc に `@example` が全関数に付与**：path の最終形が見えるので読み手の認知負荷が低い。
5. **テスト 12 ケースの内訳がバランス良い**：bucket 定数（2）/ recentPath（3）/ recentThumbPath（2）/ monthlyPath（2）/ yearlyPath（2）/ consistency（1）= 計 12 で網羅性高い。「month component を含まない」「underscore separator」「`/thumb/` 挿入位置」など回帰防止に効く inline-property check も入っている。

## 指摘事項

### 推奨改善

#### 🟡 #1 入力バリデーションがゼロで path traversal の余地

```typescript
export function recentPath(caseId: string, attachmentId: string): string {
  return `${caseId}/${attachmentId}.jpg`;
}
```

`caseId = "../../etc/passwd"` のような値が渡されると、Storage 側の bucket パスが意図しない場所を指す可能性がある。Supabase Storage の S3 互換実装が `..` を正規化するか / RLS が path で守られているかに依存して安全性が決まる。

防御策:
- a) `assert(/^[A-Z0-9-]+$/.test(caseId), "invalid caseId")` で英数字 + ハイフンのみ許可
- b) UUID のみ許可する場合 `/^[0-9a-f-]{36}$/i` を使う
- c) サニタイズで `replaceAll("/", "_").replaceAll("..", "")` 

仕様で `case_id` 形式が固定（例: `CASE-NNNN` / UUID）であれば validate を入れる方が安全。multibyte case_id も pass-through テストで通っているが、これは「将来的に日本語 case_id が来ても壊れない」防御という解釈と「validate が緩い」のどちらにも取れる。spec §2.2 で path 規約と入力域の指定がある場合はそれに揃えてください。

該当: `src/app/leaf/_lib/kanden-storage-paths.ts:18-37`

#### 🟡 #2 `recentPath` / `recentThumbPath` が `.jpg` 固定だが bucket は HEIC も許可している

migration SQL で recent bucket は `image/jpeg` / `image/png` / `image/heic` を allow しているが、path 関数は `.jpg` 拡張子固定。HEIC / PNG の場合に extension が合わない問題：

```typescript
// recent bucket allows: image/jpeg, image/png, image/heic
expect(recentPath("CASE", "abc")).toBe("CASE/abc.jpg");  // ← HEIC 来たら？
```

実装方針として:
- a) 「アップロード時に常に JPEG 変換する（heic2any 使用）」前提なら `.jpg` 固定で OK、コメントで明示
- b) 拡張子可変 `recentPath(caseId, attachmentId, ext: "jpg" | "png" | "heic")` を取る
- c) 単に `.bin` のような拡張子なし or extension stripped にする

heic2any を npm 追加していることから (a) の可能性が高いが、JSDoc / コメントに「クライアント側で HEIC → JPEG 変換するため拡張子固定」と書いておくと未来の自分が迷わない。

該当: `src/app/leaf/_lib/kanden-storage-paths.ts:18-26`

#### 🟡 #3 monthly / yearly path のフォーマット validation なし

```typescript
monthlyPath("2026-04", "CASE-0001", "aaa-bbb")  // → "2026-04/CASE-0001_aaa-bbb.pdf"
yearlyPath("2026", "CASE-0001", "aaa-bbb")      // → "2026/CASE-0001_aaa-bbb.pdf"
```

`yyyymm` / `yyyy` 引数の形式チェックがなく、`monthlyPath("invalid", ...)` でも path を生成する。known-pitfalls #7 の KoT date 形式バグの教訓として、形式の異なる引数を取る関数では正規表現 validate を関数先頭に置くパターンが有効：

```typescript
export function monthlyPath(yyyymm: string, caseId: string, attachmentId: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(yyyymm)) {
    throw new Error(`monthlyPath: yyyymm must be YYYY-MM format, got "${yyyymm}"`);
  }
  return `${yyyymm}/${caseId}_${attachmentId}.pdf`;
}
```

migration バッチ（Phase B）で動的に bucket path を組み立てる場面で、想定外形式の事故を関数境界で検出できる。

該当: `src/app/leaf/_lib/kanden-storage-paths.ts:43-58`

#### 🟡 #4 npm 5 個追加が本 PR に含まれている

#65 / #66 / #67 / #69 と同じ問題。`kanden-storage-paths.ts` 単体は **vitest だけあれば動く** ので、bcryptjs / heic2any / msw / user-event / @types/bcryptjs は本 PR の差分に不要。chore 1 本に切り出す運用に変更推奨。

### 軽微

#### 🟢 #5 multibyte case_id pass-through テストが将来ガード

仕様上は使わない想定とコメントしつつテストで担保しているのは「ある日突然破壊変更が入った時に検知できる」回帰防止として有効。

#### 🟢 #6 path consistency テスト（recent と thumb で case_id prefix 一致）

「実装が壊れた時に最初に気付ける単体テスト」として効く。Storage 側の RLS が `case_id` prefix で削れる前提を成り立たせている保険。

#### 🟢 #7 関数シグネチャが全部 `(string, string, ?string) → string` で覚えやすい

#### 🟢 #8 export が定数 3 + 関数 4 のフラット構造で、import 側も `import { recentPath, RECENT_BUCKET } from "..."` で済む

## known-pitfalls.md 横断チェック

| # | 関連有無 | コメント |
|---|---|---|
| #1 timestamptz 空文字 | ✅ N/A | path 生成のみ |
| #2 RLS anon 流用 | ✅ N/A | DB 関連なし |
| #3 空 payload insert | 🟡 弱い関連 | path 関数は空文字 caseId / attachmentId を受け取っても string を返す → 呼び出し側で `isEmpty` チェックすべき |
| #6 garden_role CHECK 制約 | ✅ N/A | 権限関連なし |
| #7 KoT date 形式 | 🟡 関連 | monthlyPath/yearlyPath が YYYY-MM / YYYY 形式を要求するが validate なし、本指摘 #3 参照 |
| #8 deleted_at vs is_active | ✅ N/A | path 関連なし |

## spec / plan 整合

- spec §2.2 (3 bucket 構成) と一致
- plan v3 §Task D.4 の「pure function + TDD」要件を満たしている
- Phase B 移行バッチでの monthly / yearly 利用も想定済み（A-1c では read-only と明記）

## 判定

**LGTM (条件付き)**

**理由**:
- pure function module としての品質は高く、テストも適切に網羅されている。
- 🟡 #1 (path traversal) と #3 (yyyymm validate) は実装の堅牢性に関わるので、本 PR か直近 follow-up で対応推奨。仕様で case_id / 日付形式が制約されているなら、その制約を validate として書き込むのが安全。
- 🟡 #2 (拡張子固定) は HEIC アップロード時の挙動を確認の上、「クライアント側で常に JPEG 変換」前提ならその旨を JSDoc に追記。
- 🟡 #4 (npm 差分) は chore 1 本切り出し運用に統一。

優先度高くないが、上記 🟡 のうち #3 は known-pitfalls #7 (KoT date 形式) と類似のパターンなので、将来的な事故防止として入れておく価値が大きい。

---
🤖 a-review (PR レビュー専属セッション) by Claude Opus 4.7 (1M context)

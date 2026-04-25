# a-review レビュー — Tree Phase B-β B 経路（マイページ誕生日変更モーダル）

## 概要

Garden-Tree Phase B-β の B 経路として、マイページから自分の誕生日を変更すると `root_employees.birthday` と Supabase Auth password (= 新 MMDD) を**一体トランザクション**で同期する Server Action + ChangeBirthdayModal を実装。10 ファイル / +3,404 行（実装 +1,002 行 / spec・plan +1,863 行 / docs ±）。

設計判断は親仕様 §2.5.3 の **案 C（一体トランザクション）** を採用、② Auth 更新失敗時は ① birthday を逆向きに UPDATE する補償ロジック付き。errorCode 7 種・Vitest 9 件・RTL 8 件、計 17 件全 PASS。

**Tree は CLAUDE.md §16 で🔴最厳格モジュール（コールセンターの要、FileMaker 並行稼働中）扱い**。本レビューは known-pitfalls #2/#6 + memory「Garden 申請承認パターン」+ 認証一貫性を重点的に確認。

## 良い点

1. **テスト網羅性**: errorCode 7 種すべてに対応する Vitest 9 件 + UI フローの RTL 8 件。`audit log insert 失敗 → success: true を返す` の best-effort 経路まで網羅。
2. **TZ 対応**: `Asia/Tokyo` basis で `todayJst` を計算する設計（`change-birthday-with-password.ts:82-89`）。known-pitfalls 関連の落とし穴を回避済。
3. **補償ロジックの実装**: `auth.admin.updateUserById` 失敗時に `birthday` を旧値へ巻き戻す + ロールバック失敗時の構造化ログ（`change-birthday.ts:137-148`）。
4. **rate limit**: 直近 10 分以内の同一 user の `password_change` audit を見て拒否する設計（`change-birthday.ts:111-120`）。
5. **二重送信防止**: モーダルで `submitting` 状態 + `disabled + "変更中..."` 表示、`type="button"` でキャンセル分離（`ChangeBirthdayModal.tsx:121-126`）。
6. **role/aria 属性**: `role="dialog"`, `aria-modal="true"`, `role="alert"` でスクリーンリーダー対応。
7. **spec が破綻ゼロ**: 親仕様 §2.5.3 の選択肢 3 案を比較した上で C 案採用、§3.4 で password 検証 4 案を比較した上で `signInWithPassword` 採用、と検討プロセスが明示的。

## 🔴 重大指摘事項

### R1. 「申請承認パターン」と矛盾する直接編集（要意思決定確認）

memory「Garden 申請承認パターン」（2026-04-26 確定）：

> 従業員マイページからの直接編集禁止、全項目 admin 承認フロー、root_change_requests 横断テーブル

本 PR は `root_employees.birthday` を**マイページから直接 UPDATE** しています。これは上記メモリと真っ向から衝突する設計です。

**ただし** この PR の場合：
- birthday = password の関係上、admin 承認待ちの間ユーザーがログイン不能になる
- 親仕様 §2.5.3 で C 案採用が正式決定済（PR 起草前から確定）
- B 経路は「初回ログイン時に間違えた誕生日の訂正」が主用途

なので**例外として直接編集を許す合意**であろうと推察しますが、**memory 確定が 2026-04-26 でこの PR より新しい**ため、東海林さんに最終確認を強く推奨します。

**確認事項**:
1. birthday は申請承認パターン適用外として正式合意か？
2. もし「全項目 admin 承認」なら、birthday 変更後にログイン不能になる経過処置（一時パス発行など）が必要では？

仕様の上位整合性が取れているなら問題なし、取れていないなら R1 は🔴で blocker。

### R2. `signInWithPassword` の副作用と TOCTOU リスク

`src/app/tree/_actions/change-birthday-with-password.ts:101-109`

```ts
const passwordVerifyClient = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { error: signInError } = await passwordVerifyClient.auth.signInWithPassword({
  email: userData.user.email!,
  password: input.currentPassword,
});
```

**懸念点**:
- (a) `signInWithPassword` は Supabase 側で**ログイン失敗カウンタ**や**ブルートフォース保護**にカウントされる可能性。10 分制限を入れる前にここで Supabase 側ロックが先に効くと、誕生日変更 UI 経由でのみアカウントロック発生し得ます。
- (b) `email!` で email が必須前提だが、Supabase Auth で email が NULL のユーザー（電話 SSO 等）は存在し得る。`userData.user.email` が undefined だとランタイム TypeError。Garden では現状 email 必須運用とは思いますが念のため。
- (c) **rate limit より先に password 検証を実行**しているため、攻撃者が「正しい現パスは握っているが新しい誕生日に変えたい」状況で 10 分制限の意義が弱まります（成功させる用途では rate limit 後にしか password 検証できないため攻撃にならない）。一方、レート制限突破のために短時間に複数回 password を打ち込む試行は signInWithPassword 側で別途吸収される必要があります。

**修正案**:
- 順序入れ替え: `userData → birthday 重複チェック → rate limit → password 検証 → 実行` の順に。
- `userData.user.email` が undefined なら `UNAUTHENTICATED` で fail させる guard を追加。

### R3. 補償ロールバック失敗時の通知が console.error のみ

`change-birthday.ts:142-148`

```ts
if (rollbackError) {
  console.error(
    "[changeBirthdayWithPassword] rollback FAILED — birthday=newBirthday, password=oldMMDD のまま",
    { userId: userData.user.id, attempted: input.newBirthday },
  );
}
return fail("TRANSACTION_FAILED");
```

ロールバック失敗時はユーザーが「**新誕生日 + 古いパスワード**」状態でログイン不能になります。Vercel logs に出るだけで、admin への自動通知はありません。Tree は最厳格・FileMaker 並行稼働中で、**1 名でもログイン不能になると即座にコールセンター業務影響**します。

**修正案**:
- Chatwork 通知 (admin room) を best-effort で投げる
- `root_audit_log` に severity='critical' で別途残す
- ユーザーには「事務局に連絡してください」案内を表示（メッセージは`TRANSACTION_FAILED` で伝わる）

少なくとも検出経路を確保しないと、コールセンター業務停止が発覚するまでに数時間かかる可能性。

## 🟡 推奨指摘事項

### Y1. `accessToken = ""` の早期 guard 不足

`src/app/tree/mypage/page.tsx` の `handleChangeBirthdaySubmit`:

```ts
const { data: sessionData } = await supabase.auth.getSession();
const accessToken = sessionData.session?.access_token ?? "";
return await changeBirthdayWithPassword({...});
```

session が無いときに空文字を渡しています。Server Action 側で `getUser("")` は UNAUTHENTICATED を返すので最終的に動作はするものの、無駄なネットワーク往復 + ユーザーには不親切なメッセージ。`!sessionData.session` の段階でモーダル側に「再ログインしてください」と返す方が UX 良。

### Y2. クライアント側の `max` が UTC ベース

`ChangeBirthdayModal.tsx:81` `max={new Date().toISOString().slice(0, 10)}`

サーバー側は `Asia/Tokyo` 計算済（R2 改善済）ですが、クライアント側 `<input max>` は UTC のまま。00:00-09:00 JST 間は max が 1 日早くなる（前日まで）ことがあります。実害は小さいですが、UI 一貫性のため JST 計算に揃えることを推奨：

```ts
max={new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Tokyo" }).format(new Date())}
```

### Y3. SAME_AS_CURRENT のチェック位置

`change-birthday.ts:99` で `employee.birthday === input.newBirthday` を比較しますが、その前にすでに employee SELECT で 1 往復しているのでコスト無し。一方、その後で **password 検証 → rate limit → UPDATE** の順なので、現状コードは概ね妥当。R2 と同じく順序の整理推奨。

### Y4. 監査ログ insert 失敗 = rate limit が効かない

`change-birthday.ts:152-167` で `audit_insert` が失敗してもユーザーには success を返します。これは正しい設計ですが、**audit log が rate limit の唯一の根拠**（line 113-118）なので、insert 失敗が続くと rate limit が機能せず連続変更が可能になります。

**修正案**: rate limit の根拠を `root_audit_log` ではなく `root_employees.birthday_changed_at`（新カラム）に持たせる、または併用。

### Y5. testing-library/user-event 未導入

PR description にも記載あり、`fireEvent.change` で代替している部分（autonomous モード制約）。次 PR で `npm install --save-dev @testing-library/user-event` 検討。

### Y6. メールが email enumeration に使える

`signInWithPassword({email: userData.user.email!, password: input.currentPassword})` でエラーメッセージから「このメールは存在する/しない」「パスワードは合ってる/合ってない」が判別可能。攻撃面は本人が UNAUTHENTICATED 通過後（自分のセッション必須）なので影響は低いものの、エラーメッセージは `WRONG_PASSWORD` 一本で良いか、あるいは `signInError.message` を出していないか念のため確認推奨（コードでは出していないので OK）。

### Y7. 楽観ロック無し

`UPDATE root_employees SET birthday = $new WHERE user_id = $uid` は同一ユーザーが二重タブで同時操作した場合の楽観ロック無し。実害は小さい（最後勝ち）が、Tree の他箇所で `updated_at` ベースの ETag/lock を採用しているなら統一を検討。

## 🟢 軽微指摘

### G1. `process.env` 直読みの 2 箇所重複
`change-birthday.ts:68-69` で `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` を読んで `verifyClient` と `passwordVerifyClient` の 2 つ作成。同じ env で 2 つの client 作るなら一本化推奨。`auth: { persistSession: false }` で同じ設定なので問題はないが冗長。

### G2. `console.warn` の構造化ログ
`audit log insert failed` の warn が出るのは良い。本番では Vercel Logs に lower priority で乗ることになるので、あとで Sentry 等に移送するか検討。

### G3. PR が delete している大量ドキュメント
`git diff develop..pr60 --stat` で 22,920 deletions が出ますが、これは PR60 の merge base が develop の中盤（`e4619c7`）にあり、その後 develop に PR #56-#76 が merge されているため。**実際の merge では git が保持するので削除されない**ので blocker ではありませんが、`docs/effort-tracking.md` は両側で変更があるため**コンフリクト発生確実**。マージ前に `git merge develop` で予習すると安全。

### G4. successMsg の 5 秒タイマー
`page.tsx` `setTimeout(() => setSuccessMsg(""), 5000)` はアンマウント時のクリーンアップ無し。React 警告は出ないが厳密には `useEffect` + `clearTimeout` を推奨。

## known-pitfalls.md 横断チェック

| # | タイトル | 関連有無 | 備考 |
|---|---|:---:|---|
| #1 | timestamptz 空文字 insert | 該当無し | birthday は date 型、UPDATE は valid な YYYY-MM-DD 文字列のみ通る |
| #2 | RLS anon クライアント流用 | 適切 | Server Action 内で `getSupabaseAdmin()` 使用、anon は `getUser(token)` の token 検証のみ |
| #3 | 空オブジェクト insert | 該当無し | UPDATE のみで insert 無し、空 payload 無し |
| #4 | KoT IP 制限 | 関係無し | Tree は KoT 連携無し |
| #5 | Vercel Cron + Fixie | 関係無し | 同上 |
| #6 | garden_role CHECK 制約 | 関係無し | role 変更無し |
| #7 | KoT date 形式 | 関係無し | 同上 |
| #8 | deleted_at vs is_active | 🟡 微妙 | UPDATE 時に `deleted_at IS NULL` 条件無し。論理削除済みユーザーがマイページに来れる経路があるなら追加チェック検討 |

## spec / plan 整合

`docs/specs/2026-04-25-tree-phase-b-beta-mypage-birthday-modal.md` v1.0 (479 行) と実装は概ね整合。一部相違：
- spec §3.4 は password 検証に **選択肢 1（signInWithPassword）** を採用と記載 → 実装一致
- spec §5 errorCode 一覧と実装の `ChangeBirthdayErrorCode` 7 種が一致
- spec §2.2.1 「現誕生日と同一値禁止」は実装でクライアント側 + サーバ側両方でチェック

ただし spec で **R3 の補償失敗時の通知経路** が明示されていないので、spec 側にも追記しておくと将来の Phase D・E 経路設計時に統一できます。

## 判定

**LGTM (with comments)** — ただし以下を東海林さんと確認した上でマージ：

1. **R1（申請承認パターンとの整合）**: birthday の直接編集が memory の例外として正式合意済か確認。合意済なら spec に「申請承認パターンの例外」と明記推奨。
2. **R2（password 検証とレート制限の順序）**: 修正できれば良いが、現状でも本人のセッションを通過した上での処理なので攻撃面は限定的。Phase B-β cut-over 前で OK。
3. **R3（補償失敗時の通知）**: コールセンター業務影響につき、最低でも Chatwork 通知 or audit_log severity='critical' の追加を推奨。次の PR で OK。

R1 が合意済前提なら、テスト網羅性も高く、補償ロジックも適切に書かれているので Tree 最厳格基準でも品質は十分。Y/G 系は次 PR か α版運用の中で順次改善。

特に注意すべき手動確認項目（マージ前 or α版投入時）：
- [ ] develop と merge して `effort-tracking.md` のコンフリクト解決
- [ ] 三好 理央（1324）アカウントで実機テスト（spec 推奨通り、`docs/phase-b-beta-e2e-checklist.md` STEP 12-15）
- [ ] R3 の補償ロールバック失敗時の通知追加（次 PR でも可、Tree α版投入前必須）
- [ ] R1 の memory 整合確認（東海林さん意思決定）

---
🤖 a-review (PR レビュー専属セッション) by Claude Opus 4.7 (1M context)

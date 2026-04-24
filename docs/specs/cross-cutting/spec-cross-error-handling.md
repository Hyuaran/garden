# Cross-Cutting Spec: エラーハンドリング統一ガイド

- 優先度: **🟡 中**
- 見積: **0.5d**
- 作成: 2026-04-24（a-auto / Batch 7 Garden 横断 #5）
- 前提: 各モジュールで個別の try-catch パターン、ユーザー表示手法が分散

---

## 1. 背景と目的

### 1.1 現状の課題

- Route Handler / Server Component / Client Component で**try-catch パターンが統一されていない**
- エラー時のユーザー表示が**toast / modal / inline / alert 混在**
- Sentry 等のエラー監視が未導入、本番エラーが不可視
- エラーメッセージの日本語化 / 技術的詳細の出し分けが曖昧

### 1.2 本 spec のゴール

- レイヤ別の try-catch 規約統一
- ユーザー表示の使い分けルール
- Sentry 導入方針と段階計画
- `known-pitfalls.md` との接続

---

## 2. エラーの種類と扱い

### 2.1 階層別の分類

| 階層 | エラー種別 | 対応 |
|---|---|---|
| **プログラマエラー** | 型不整合、未定義参照、論理ミス | 即座に throw、開発時に修正 |
| **業務エラー** | バリデーション違反、状態遷移不可 | structured error 返却、UI 表示 |
| **外部エラー** | DB 接続失敗、API タイムアウト、RLS 拒否 | リトライ or フォールバック、監査ログ |
| **セキュリティエラー** | 権限不足、JWT 無効、レート制限 | 適切な HTTP ステータス、ログ記録 |

### 2.2 ErrorCode 体系

```typescript
// src/lib/errors/codes.ts
export type ErrorCategory =
  | 'VALIDATION'      // 入力エラー
  | 'AUTH'            // 認証・認可
  | 'BUSINESS'        // 業務ルール違反（遷移不可等）
  | 'EXTERNAL'        // 外部 API / DB
  | 'NOT_FOUND'       // リソース不在
  | 'INTERNAL';       // プログラマエラー

export interface StructuredError {
  category: ErrorCategory;
  code: string;             // 'INVALID_AMOUNT' 等
  message: string;          // 日本語メッセージ（ユーザー向け）
  technicalMessage?: string; // 開発者向け詳細
  field?: string;           // バリデーション対象フィールド
  retryable?: boolean;
}
```

---

## 3. レイヤ別 try-catch 規約

### 3.1 Route Handler（`src/app/api/**/route.ts`）

```typescript
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // 1. 認証
    const auth = await verifyAuth(req);
    if (!auth) {
      return NextResponse.json(
        { error: '認証が必要です', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // 2. 入力検証（Zod）
    const body = CreateTransferSchema.parse(await req.json());

    // 3. 業務処理
    const result = await createTransfer(body);
    return NextResponse.json(result);

  } catch (e) {
    return handleRouteError(e);
  }
}

// 共通ヘルパー（src/lib/errors/route-handler.ts）
export function handleRouteError(e: unknown): NextResponse {
  if (e instanceof z.ZodError) {
    return NextResponse.json({
      error: '入力内容を確認してください',
      code: 'VALIDATION_ERROR',
      fields: e.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message,
      })),
    }, { status: 400 });
  }

  if (e instanceof BusinessError) {
    return NextResponse.json({
      error: e.message,
      code: e.code,
    }, { status: 422 });
  }

  if (e instanceof AuthError) {
    return NextResponse.json({
      error: e.message,
      code: 'FORBIDDEN',
    }, { status: 403 });
  }

  // Unknown エラー
  console.error('[route:unknown]', e);
  // Phase C: Sentry.captureException(e)
  return NextResponse.json({
    error: 'サーバーエラーが発生しました',
    code: 'INTERNAL_ERROR',
  }, { status: 500 });
}
```

### 3.2 Server Action（`'use server'`）

```typescript
'use server';

export async function approveTransfer(transferId: string): Promise<
  | { success: true; transferId: string }
  | { success: false; error: string; code: string }
> {
  try {
    // 業務処理
    await doApprove(transferId);
    return { success: true, transferId };

  } catch (e) {
    if (e instanceof BusinessError) {
      return { success: false, error: e.message, code: e.code };
    }
    console.error('[server-action:approveTransfer]', e);
    return { success: false, error: 'サーバーエラーが発生しました', code: 'INTERNAL_ERROR' };
  }
}
```

**ポイント**: Server Action は**常に Result 型を返す**（throw 禁止）。クライアント側の状態管理が単純化。

### 3.3 Client Component

```typescript
'use client';

function ApproveButton({ transferId }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleApprove = async () => {
    try {
      setLoading(true);
      const result = await approveTransfer(transferId);
      if (result.success) {
        toast.success('承認しました');
        router.refresh();
      } else {
        // 業務エラーは toast
        toast.error(result.error);
        // code ごとの追加アクション
        if (result.code === 'UNAUTHORIZED') {
          router.push('/login');
        }
      }
    } catch (e) {
      // 想定外のエラー（ネットワーク断等）
      console.error('[component:ApproveButton]', e);
      toast.error('通信エラーが発生しました。再試行してください');
    } finally {
      setLoading(false);
    }
  };
  // ...
}
```

### 3.4 Server Component

```typescript
// RLS エラーは Supabase が返すため、明示的に扱う
export default async function TransferDetail({ params }: { params: { id: string } }) {
  const supabase = createAuthenticatedSupabase(/* JWT from cookies */);

  const { data, error } = await supabase
    .from('bud_transfers').select('*').eq('id', params.id).maybeSingle();

  if (error) {
    return <ErrorFallback message="データの取得に失敗しました" technicalMessage={error.message} />;
  }
  if (!data) {
    notFound();  // Next.js の標準 404 ページへ
  }

  return <TransferDetailView transfer={data} />;
}
```

---

## 4. ユーザー表示の使い分け

### 4.1 フォーム: **inline**（入力の直下）

入力エラーはフィールド直下に表示：
```tsx
<Field>
  <Label>振込金額</Label>
  <Input value={amount} onChange={...} />
  {errors.amount && <ErrorMessage>{errors.amount}</ErrorMessage>}
</Field>
```

### 4.2 操作結果: **toast**（画面右下 3 秒）

- 承認・差戻し・保存等のアクション完了通知
- 非ブロッキング（ユーザーの作業を止めない）
- ライブラリ: `sonner` / `react-hot-toast`（Garden 統一）

```tsx
toast.success('保存しました');
toast.error('承認できませんでした: ' + error);
toast.warning('既に処理済みです');
```

### 4.3 重要確認: **modal**（中央ダイアログ）

- 削除確認・権限不足・**課金影響**・取消不可操作
- ブロッキング（ユーザーの明示操作で閉じる）

```tsx
<AlertDialog>
  <AlertDialogContent>
    <AlertDialogTitle>権限が不足しています</AlertDialogTitle>
    <AlertDialogDescription>
      この操作は admin 以上の権限が必要です。
      管理者に権限付与を依頼してください。
    </AlertDialogDescription>
    <AlertDialogAction>OK</AlertDialogAction>
  </AlertDialogContent>
</AlertDialog>
```

### 4.4 システム停止級: **page-level error boundary**

- DB 接続不可・Supabase ダウン・重大バグ
- Next.js `error.tsx` を活用

```tsx
// src/app/bud/error.tsx
'use client';

export default function BudError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // Phase C: Sentry.captureException(error);
    console.error('[bud:error]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2>Bud でエラーが発生しました</h2>
      <p>問題が解決しない場合は管理者にご連絡ください</p>
      <button onClick={reset}>再試行</button>
    </div>
  );
}
```

### 4.5 使い分けマトリクス

| 状況 | 表示手法 | 理由 |
|---|---|---|
| 必須フィールド未入力 | inline | 該当位置に表示 |
| 送信失敗（ネットワーク）| toast | 非ブロッキング、再試行を促す |
| 承認・差戻し成功 | toast | 完了通知 |
| 権限不足 | modal | ブロッキング、代替アクション提示 |
| 削除確認 | modal | 取消不可操作の事前確認 |
| 金額確認（振込実行前）| modal | 課金影響 |
| Supabase ダウン | page error | 復旧まで操作不可 |
| 404 | page notFound | Next.js 標準 |

---

## 5. エラーメッセージの日本語化

### 5.1 辞書

```typescript
// src/lib/errors/messages.ts
export const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: '認証が必要です。再度ログインしてください',
  FORBIDDEN: 'この操作を実行する権限がありません',
  VALIDATION_ERROR: '入力内容を確認してください',
  NOT_FOUND: 'データが見つかりませんでした',
  INTERNAL_ERROR: 'サーバーエラーが発生しました',
  RATE_LIMITED: 'リクエストが多すぎます。しばらく待ってから再試行してください',

  // モジュール固有
  INVALID_TRANSITION: 'このステータスから遷移できません',
  DUPLICATE_SUSPECTED: '同条件の振込が既に存在します',
  MISSING_REASON: '差戻し理由を入力してください',
  FILE_TOO_LARGE: 'ファイルサイズが上限を超えています',
};

export function t(code: string, fallback = 'エラーが発生しました'): string {
  return ERROR_MESSAGES[code] ?? fallback;
}
```

### 5.2 技術的詳細は console.error のみ

```typescript
// ❌ ユーザーに技術的詳細を出さない
toast.error(`Failed: ${error.stack}`);

// ✅ 日本語メッセージ + コンソールに詳細
console.error('[component:X]', error);
toast.error(t(code));
```

### 5.3 admin 向け管理画面では technicalMessage を許容

```typescript
// admin のみアクセス可能な画面では技術メッセージを表示
<AdminDebugPanel
  message={error.message}
  technicalMessage={error.technicalMessage}
  stack={error.stack}
/>
```

---

## 6. Sentry 連携方針

### 6.1 導入時期

| Phase | 導入レベル |
|---|---|
| Phase A（現在） | **未導入**、console.error のみ |
| Phase B | dev / staging で試験導入 |
| Phase C | 本番導入、admin 監視 |
| Phase D | 全モジュール完全カバー |

### 6.2 スコープ

- **エラー**: すべての 500 系、unknown exception
- **警告**: severity='warn' の監査ログ連動
- **パフォーマンス**: Route Handler 3 秒超、Client render 2 秒超
- **リリース**: GitHub Actions で commit SHA を release tag

### 6.3 PII 除外

- ユーザー情報（employee_id, 氏名）は Sentry に送らない
- **金額情報**は hash 化（`sha256(amount + salt).slice(0, 8)`）
- Request body はマスク（`{ amount: '[MASKED]' }`）

### 6.4 設定例（導入時）

```typescript
// src/lib/sentry/init.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // PII 除去
    if (event.request?.data) {
      event.request.data = maskPII(event.request.data);
    }
    return event;
  },
  integrations: [
    Sentry.browserTracingIntegration(),
  ],
});
```

---

## 7. リトライ戦略

### 7.1 自動リトライ対象

| エラー | リトライ | 間隔 |
|---|---|---|
| Supabase 接続タイムアウト | 3 回 | 1s, 2s, 4s |
| Chatwork 429 | 3 回 | 1s, 2s, 4s（spec-cross-chatwork §7.2）|
| Drive API 503 | 3 回 | 指数バックオフ |
| ネットワーク断（クライアント）| ユーザー操作 | - |

### 7.2 非リトライ対象

- 認証エラー（401 / 403）
- バリデーションエラー（400）
- 業務エラー（422）

---

## 8. カスタムエラークラス

```typescript
// src/lib/errors/classes.ts
export class BusinessError extends Error {
  constructor(
    public code: string,
    message: string,
    public field?: string,
  ) {
    super(message);
    this.name = 'BusinessError';
  }
}

export class AuthError extends Error {
  constructor(
    public code: 'UNAUTHORIZED' | 'FORBIDDEN',
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export class ExternalApiError extends Error {
  constructor(
    public service: string,
    public originalError: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'ExternalApiError';
  }
}
```

---

## 9. 実装ステップ

### W1: 共通ヘルパー整備（0.15d）
- [ ] `src/lib/errors/codes.ts` ErrorCategory 型 + StructuredError
- [ ] `src/lib/errors/classes.ts` BusinessError / AuthError / ExternalApiError
- [ ] `src/lib/errors/messages.ts` 日本語辞書
- [ ] `src/lib/errors/route-handler.ts` `handleRouteError()`

### W2: Toast ライブラリ選定 + 導入（0.1d）
- [ ] `sonner` 導入（親 CLAUDE.md 承認後）
- [ ] Garden 全体の Toaster コンポーネントを `src/app/layout.tsx` に配置

### W3: Error Boundary 整備（0.1d）
- [ ] `src/app/<module>/error.tsx` を各モジュールに追加
- [ ] グローバル `src/app/error.tsx` 強化

### W4: 既存モジュールへの適用（0.1d / モジュール）
- [ ] Bloom / Forest / Bud / Root の各 Route Handler を統一パターンに移行

### W5: Sentry 導入準備（Phase B 以降）
- [ ] DSN 取得、Organization 作成
- [ ] `@sentry/nextjs` セットアップ
- [ ] PII マスキング実装

---

## 10. 判断保留

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判1 | Toast ライブラリ | **sonner 推奨**（軽量、Tailwind 親和性）|
| 判2 | Sentry 導入時期 | **Phase B** 試験 → Phase C 本番 |
| 判3 | エラーメッセージの多言語化 | **Phase A は日本語のみ**、Phase D で英語対応検討 |
| 判4 | Server Action の throw 禁止 | 原則禁止、Result 型で返却 |
| 判5 | BusinessError の HTTP status mapping | 422 Unprocessable Entity 推奨（業務的に不可な操作）|
| 判6 | ユーザー向けメッセージの文体 | **敬体（です・ます）**、丁寧語統一 |
| 判7 | エラーの分析ダッシュボード | Sentry 導入後、Bloom KPI と統合検討 |

---

## 11. 次アクション

1. W1-W3 の実装は Phase A 末（M2 頃）
2. Sentry 導入は Bud α版開始後（M3 中旬）
3. `known-pitfalls.md` §7 に本 spec のリンクを追加

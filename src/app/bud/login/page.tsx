"use client";

/**
 * Garden-Bud — ログイン画面
 *
 * 社員番号 + パスワードで Supabase Auth にサインイン。
 * フロントで 社員番号 → emp{4桁}@garden.internal に変換して渡す。
 */

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInBud } from "../_lib/auth";
import { useBudState } from "../_state/BudStateContext";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isExpired = searchParams.get("reason") === "expired";
  const { refreshAuth } = useBudState();

  const [empNumber, setEmpNumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!empNumber.trim()) {
      setError("社員番号を入力してください");
      return;
    }
    if (!password) {
      setError("パスワードを入力してください");
      return;
    }

    setLoading(true);
    try {
      const signInResult = await signInBud(empNumber, password);
      if (!signInResult.success) {
        setError(signInResult.error ?? "ログインに失敗しました");
        return;
      }
      // Bud 権限チェック
      const authResult = await refreshAuth();
      if (!authResult.success) {
        setError(
          authResult.error ??
            "Bud の利用権限がありません。管理者にお問い合わせください",
        );
        return;
      }
      router.replace("/bud/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-md w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🌱</div>
          <h1 className="text-xl font-bold text-gray-800">Garden-Bud</h1>
          <p className="text-sm text-gray-500 mt-1">経理・収支システム</p>
        </div>

        {isExpired && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 text-sm text-amber-700">
            セッションが 2時間で期限切れになりました。再度ログインしてください。
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="empNumber"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              社員番号
            </label>
            <input
              id="empNumber"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{1,4}"
              maxLength={4}
              placeholder="0008"
              value={empNumber}
              onChange={(e) => setEmpNumber(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              autoFocus
              autoComplete="username"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              パスワード
            </label>
            <input
              id="password"
              type="password"
              placeholder="パスワードを入力"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              autoComplete="current-password"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
          >
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-6">
          パスワードを忘れた場合は管理者（東海林）に連絡してください
        </p>
      </div>
    </div>
  );
}

export default function BudLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <LoginForm />
    </Suspense>
  );
}

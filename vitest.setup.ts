import "@testing-library/jest-dom/vitest";

// Phase A-2.1 (dispatch main- No. 90, 2026-05-08): vitest 環境変数設定
// supabase client 初期化のため、テスト環境でのダミー env を供給
// (実 Supabase 接続は forest-fetcher の dev mock fallback で回避される)
process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "test-anon-key-for-vitest";

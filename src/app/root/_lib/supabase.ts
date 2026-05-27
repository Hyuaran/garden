/**
 * Garden Root — Supabase クライアント
 *
 * 匿名キー（anon key）のみを使用。サービスロールキーは使わない。
 *
 * 環境変数（.env.local）:
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
 */

import { createBrowserClient } from "../../_lib/supabase/browser";

export const supabase = createBrowserClient();

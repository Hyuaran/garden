"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/bloom/_lib/supabase";
import { usePartnerSession } from "./PartnerGate";

export function PartnerHeaderActions() {
  const session = usePartnerSession();
  const router = useRouter();
  if (!session) return null;
  if (session.kind === "staff") return <Link href="/">Gardenへ戻る</Link>;
  return <button type="button" onClick={async()=>{await supabase.auth.signOut();router.replace("/p/login");router.refresh();}}>ログアウト</button>;
}

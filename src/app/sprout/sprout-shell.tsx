"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ModuleShell } from "@/app/_components/layout/GardenShell/ModuleShell";
import { useAuthUnified } from "@/app/_lib/auth-unified";
import { createBrowserClient } from "@/app/_lib/supabase/browser";
import { GARDEN_ROLE_LABELS } from "@/app/root/_constants/types";
import shell from "@/app/system/_components/ShachoShell/shacho-shell.module.css";
export default function SproutShell({ current, children }: { current: "掲載管理" | "採用管理"; children: ReactNode }) {
 const { userId, role, signOut } = useAuthUnified();
 const [profile, setProfile] = useState<{ userId: string; name: string } | null>(null);
 useEffect(() => {
  let cancelled = false;
  if (userId) void (async () => {
   const { data } = await createBrowserClient().from("root_employees").select("name").eq("user_id", userId).maybeSingle();
   if (!cancelled && data) setProfile({ userId, name: data.name ?? "" });
  })();
  return () => { cancelled = true; };
 }, [userId]);
 return <ModuleShell moduleId="sprout" moduleName="Sprout" moduleLabel="Sprout ／ 採用" gardenRole={role}
  userName={profile?.userId === userId ? profile?.name : ""} roleLabel={role ? GARDEN_ROLE_LABELS[role] : ""} signOut={signOut}
  menu={<>{[["/sprout/postings", "掲載管理"], ["/sprout", "採用管理"]].map(([href, label]) =>
   <Link key={href} href={href} className={current === label ? shell.active : undefined} aria-current={current === label ? "page" : undefined}>{label}</Link>)}</>}>
  {children}
 </ModuleShell>;
}

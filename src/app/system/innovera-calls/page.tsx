import { redirect } from "next/navigation";
import { CallAccessError, requireCallAccess } from "@/lib/innovera/calls.server";
import InnoveraCallsClient from "./InnoveraCallsClient";

export const metadata = { title: "INNOVERA履歴・録音 | Garden" };

export default async function InnoveraCallsPage() {
  let ctx: Awaited<ReturnType<typeof requireCallAccess>> | null = null;
  let denied = false;
  try {
    ctx = await requireCallAccess();
  } catch (error) {
    if (error instanceof CallAccessError && error.status === 401) redirect("/login?returnTo=%2Fsystem%2Finnovera-calls");
    if (error instanceof CallAccessError) denied = true;
    else throw error;
  }

  if (denied || !ctx) {
    return (
      <main style={{ padding: 32 }}>
        <h1>この画面へアクセスする権限がありません</h1>
        <p>管理者へ問い合わせてください。</p>
      </main>
    );
  }

  return (
    <InnoveraCallsClient
      access={ctx.access}
      ownExtension={ctx.ownExtension}
      ownExtensions={ctx.ownExtensions}
      ownWindows={ctx.ownWindows ?? []}
      usesDailyExtension={ctx.usesDailyExtension}
      ownName={ctx.employeeName}
      role={ctx.role}
    />
  );
}

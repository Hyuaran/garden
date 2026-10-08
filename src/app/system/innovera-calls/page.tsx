import { redirect } from "next/navigation";
import { callAccessErrorResponse, requireCallAccess } from "@/lib/innovera/calls.server";
import InnoveraCallsClient from "./InnoveraCallsClient";

export const metadata = { title: "INNOVERA履歴・録音 | Garden" };

export default async function InnoveraCallsPage() {
  try {
    const ctx = await requireCallAccess();
    return (
      <InnoveraCallsClient
        access={ctx.access}
        ownExtension={ctx.ownExtension}
        role={ctx.role}
      />
    );
  } catch (error) {
    try {
      const response = callAccessErrorResponse(error);
      if (response.status === 401) redirect("/login?returnTo=%2Fsystem%2Finnovera-calls");
    } catch {
      throw error;
    }
    return (
      <main style={{ padding: 32 }}>
        <h1>この画面を使う権限がありません</h1>
        <p>管理者へ問い合わせてください。</p>
      </main>
    );
  }
}

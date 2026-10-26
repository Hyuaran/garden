import { notFound } from "next/navigation";
import { requireBoard } from "./server";
import { ViewPermissionError } from "@/lib/auth/view-permission.server";
import BoardClient from "./BoardClient";
export default async function Page() {
 try { await requireBoard(); } catch (e) { if (e instanceof ViewPermissionError) notFound(); throw e; }
 return <BoardClient />;
}

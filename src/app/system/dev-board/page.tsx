import { notFound } from "next/navigation";
import { requireBoard } from "./server";
import { ViewPermissionError } from "@/lib/auth/view-permission.server";
import BoardClient from "./BoardClient";
export default async function Page() {
 let userId: string;
 try { userId = (await requireBoard()).userId; } catch (e) { if (e instanceof ViewPermissionError) notFound(); throw e; }
 return <BoardClient userId={userId} />;
}

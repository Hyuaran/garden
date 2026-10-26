import RootHomeClient from "./RootHomeClient";
import { RootView } from "@/lib/auth/root-view.server";
export default function Page() { return <RootView pageKey="root-home"><RootHomeClient /></RootView>; }

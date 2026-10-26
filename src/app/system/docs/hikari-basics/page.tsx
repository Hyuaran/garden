import { withSystemView } from "@/lib/auth/system-view-page.server";
import HikariBasicsDocument from "../_components/HikariBasicsDocument";
import { loadHikariBasicsFigures } from "../_lib/hikari-basics.server";

export const metadata = { title: "光回線・通信の基礎 | Garden" };

async function HikariBasicsPage() {
  const figures = await loadHikariBasicsFigures();
  return <div id="hikari-basics-top"><HikariBasicsDocument figures={figures} /></div>;
}

export default withSystemView("system-docs", HikariBasicsPage, undefined, "/system/docs/hikari-basics");

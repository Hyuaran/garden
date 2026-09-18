import HikariBasicsDocument from "../_components/HikariBasicsDocument";
import { loadHikariBasicsFigures } from "../_lib/hikari-basics.server";

export const metadata = { title: "光回線・通信の基礎 | Garden" };

export default async function HikariBasicsPage() {
  const figures = await loadHikariBasicsFigures();
  return <div id="hikari-basics-top"><HikariBasicsDocument figures={figures} /></div>;
}

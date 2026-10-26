import "server-only";
import data from "../_data/corporate-sites.json";
import type { CorporateSitesData } from "./sites-registry";

// サイトの配線・契約情報をクライアント側の共通関数の bundle に含めない。
export const CORPORATE_SITES_DATA = data as CorporateSitesData;

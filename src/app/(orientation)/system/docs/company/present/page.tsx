import CompanyDocument from "@/app/system/docs/_components/CompanyDocument";
import { loadCompanyMembers } from "@/app/system/docs/_lib/company-doc.server";

export const metadata = { title: "会社説明・オリエンテーション | Garden" };

export default async function OrientationPage() {
  const { members, photos } = await loadCompanyMembers("/system/docs/company/present");
  return <div id="company-top"><CompanyDocument members={members} photos={photos} presentation /></div>;
}

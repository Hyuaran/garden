import CompanyDocument from "../_components/CompanyDocument";
import { loadCompanyMembers } from "../_lib/company-doc.server";

export const metadata = { title: "会社説明 | Garden" };

export default async function CompanyPage() {
  const { members, photos } = await loadCompanyMembers();
  return <div id="company-top"><CompanyDocument members={members} photos={photos} /></div>;
}

import { ShinkoukiWorkspace } from "../../_components/ShinkoukiWorkspace";

type Props = {
  params: Promise<{ companyId: string }>;
};

export default async function ForestShinkoukiCompanyPage({ params }: Props) {
  const { companyId } = await params;
  return <ShinkoukiWorkspace mode="detail" companyId={companyId} />;
}

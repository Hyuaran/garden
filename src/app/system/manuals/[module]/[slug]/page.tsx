import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@/app/_lib/supabase/server";
import { GARDEN_ROLE_ORDER, type GardenRole } from "@/app/root/_constants/types";
import { isEmployeeActive } from "@/lib/auth/employee-access";
import ManualDetailClient from "../../ManualDetailClient";
import { findManual, findManualModule, getVisibleManualDocs } from "../../_lib/manuals-registry";

export async function generateMetadata({ params }: { params: Promise<{ module: string; slug: string }> }) {
  const { module: moduleSlug, slug } = await params;
  const manual = findManual(moduleSlug, slug);
  return { title: `${manual?.name ?? "マニュアル"} | Garden` };
}

export default async function ManualDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ module: string; slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { module: moduleSlug, slug } = await params;
  const { tab } = await searchParams;
  const manualModule = findManualModule(moduleSlug);
  const manual = findManual(moduleSlug, slug);
  if (!manualModule || !manual) notFound();

  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?returnTo=%2Fsystem%2Fmanuals%2F${encodeURIComponent(moduleSlug)}%2F${encodeURIComponent(slug)}`);

  const { data: employee } = await supabase
    .from("root_employees")
    .select("garden_role,is_active,termination_date,deleted_at")
    .eq("user_id", auth.user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (!employee || !isEmployeeActive(employee)) redirect(`/login?returnTo=%2Fsystem%2Fmanuals%2F${encodeURIComponent(moduleSlug)}%2F${encodeURIComponent(slug)}`);

  const role = GARDEN_ROLE_ORDER.includes(employee.garden_role as GardenRole)
    ? employee.garden_role as GardenRole
    : "staff";
  const visibleDocs = getVisibleManualDocs(manual, role);
  if (!visibleDocs.length) {
    return <ManualDetailClient module={manualModule} manual={manual} docs={[]} />;
  }

  const selectedDoc = visibleDocs.find((doc) => doc.key === tab) ?? visibleDocs[0];
  return <ManualDetailClient module={manualModule} manual={manual} docs={visibleDocs} selectedDoc={selectedDoc} />;
}

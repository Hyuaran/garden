import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { companyIdFromSlug } from "./slugs";

export type PublicCompanyNews = {
  id: string;
  published_on: string;
  title: string;
  body: string;
};

export type PublicCompanyResponse = {
  slug: string;
  company_name: string;
  representative: string;
  address: string;
  phone: string | null;
  established_on: string | null;
  updated_at: string;
  news: PublicCompanyNews[];
};

type RootCompanyRow = {
  company_name: string | null;
  representative: string | null;
  address: string | null;
  phone: string | null;
  established_on: string | null;
  updated_at: string | null;
  is_active: boolean | null;
};

type NewsRow = {
  id: string;
  published_on: string;
  title: string;
  body: string | null;
};

export async function getPublicCompany(slug: string): Promise<PublicCompanyResponse | null> {
  const companyId = companyIdFromSlug(slug);
  if (!companyId) return null;

  const admin = getSupabaseAdmin();
  const { data: company, error: companyError } = await admin
    .from("root_companies")
    .select("company_name,representative,address,phone,established_on,updated_at,is_active")
    .eq("company_id", companyId)
    .maybeSingle<RootCompanyRow>();

  if (companyError || !company || company.is_active === false) return null;

  const { data: news, error: newsError } = await admin
    .from("system_site_news")
    .select("id,published_on,title,body")
    .eq("company_id", companyId)
    .eq("is_published", true)
    .order("published_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(10) as { data: NewsRow[] | null; error: { message: string } | null };

  if (newsError) throw new Error(newsError.message);

  return {
    slug,
    company_name: company.company_name ?? "",
    representative: company.representative ?? "",
    address: company.address ?? "",
    phone: company.phone,
    established_on: company.established_on,
    updated_at: company.updated_at ?? "",
    news: (news ?? []).map((item) => ({
      id: item.id,
      published_on: item.published_on,
      title: item.title,
      body: item.body ?? "",
    })),
  };
}

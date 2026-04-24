export type DigestPageKind =
  | 'cover'
  | 'achievements'
  | 'progress_graph'
  | 'next_month_goals'
  | 'work_summary'
  | 'custom';

export type DigestPage = {
  kind: DigestPageKind;
  title: string;
  body: string;
  image_url?: string;
  data_payload?: unknown;
};

export type MonthlyDigestStatus = 'draft' | 'published' | 'archived';

export type MonthlyDigest = {
  id: string;
  digest_month: string;
  status: MonthlyDigestStatus;
  title: string;
  summary: string | null;
  pages: DigestPage[];
  published_at: string | null;
  published_by: string | null;
  pdf_url: string | null;
  image_urls: Record<number, string> | null;
  created_at: string;
  updated_at: string;
};

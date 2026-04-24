export type ParsePdfResult = {
  company_id: string | null;
  uriage: number | null;
  gaichuhi: number | null;
  rieki: number | null;
  period: string | null;
};

export type ShinkoukiUpdateInput = {
  uriage?: number | null;
  gaichuhi?: number | null;
  rieki?: number | null;
  reflected?: string;
  zantei?: boolean;
};

export type PeriodRolloverInput = {
  junshisan: number;
  genkin: number;
  yokin: number;
  doc_url: string;
};

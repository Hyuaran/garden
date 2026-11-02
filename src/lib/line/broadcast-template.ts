export type BroadcastTemplate = {
 id: string; label: string; title: string; body: string;
 tags: { kind: string; name: string }[]; sort: number;
 updated_at?: string; updated_by?: string | null; updated_by_name?: string | null;
};

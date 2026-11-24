import { normalizeKanriNo } from "@/lib/leaf-kanden/kanri-no";
import type { EntryQuery, SearchRequest } from "./entry";

function normalizeCondition(term: string) {
  const [, operator, value] = term.trim().match(/^((?:!\s*)*(?:==|>=|<=|>|<|=)?)([\s\S]*)$/) ?? ["", "", term];
  const number = normalizeKanriNo(value);
  return number === null ? term : operator + number;
}

function normalizeRequests(requests: SearchRequest[]) {
  return requests.map(request => request.kanri_no === undefined ? request :
    { ...request, kanri_no: normalizeCondition(request.kanri_no) });
}

export function normalizeEntrySearch(query: EntryQuery): EntryQuery {
  return {
    ...query,
    search: normalizeKanriNo(query.search) ?? query.search,
    ...(query.requests && { requests: normalizeRequests(query.requests) }),
    ...(query.refinements && { refinements: query.refinements.map(refinement => ({
      ...refinement,
      requests: normalizeRequests(refinement.requests),
    })) }),
  };
}

import { expect, it } from "vitest";
import { entryQuery } from "./entry";
import { normalizeEntrySearch } from "./search-query";

it.each(["PD1617124", "pd1617124", "1617124", "1617124(2)"])("一覧と検索モードで %s を同じ番号にする", text => {
  expect(normalizeEntrySearch({
    ...entryQuery,
    search: text,
    requests: [{ kanri_no: text, customer_name: "サイズ*" }],
    refinements: [{ mode: "extend", requests: [{ kanri_no: `==${text}` }] }],
  })).toEqual({
    ...entryQuery,
    search: "1617124",
    requests: [{ kanri_no: "1617124", customer_name: "サイズ*" }],
    refinements: [{ mode: "extend", requests: [{ kanri_no: "==1617124" }] }],
  });
});

import { expect, it } from "vitest";
import { broadcastTemplates, templateTagIds } from "./broadcast-templates";
const tags=[{id:"e1",kind:"employment",name:"正社員"},{id:"e2",kind:"employment",name:"アルバイト"},{id:"b1",kind:"business",name:"ブロードバンド事業"},{id:"s1",kind:"status",name:"在籍中"}];
it("雇用契約書：押した月の文と、在籍中のブロードバンド事業のアルバイト",()=>{
  const t=broadcastTemplates(new Date("2026-11-02T03:00:00Z"))[0];
  expect(t.title).toBe("2026年11月分 雇用契約書");
  expect(t.body).toBe("お疲れ様です！\n\n2026年11月分【雇用契約書】のクラウドサインをお送りしてますので、認証作業をお願いします。\nすでに認証済みの方もいらっしゃいますが、再送が必要な方はご連絡ください！");
  expect(templateTagIds(t,tags)).toEqual({ids:["e2","b1","s1"],missing:[]});
});
it("月末の夜（日本時間で翌月）は翌月の文",()=>{
  expect(broadcastTemplates(new Date("2026-11-30T16:00:00Z"))[0].title).toBe("2026年12月分 雇用契約書");
});
it("年末調整：年と令和を押した年に合わせ、在籍中の正社員とアルバイト",()=>{
  const t=broadcastTemplates(new Date("2027-10-20T03:00:00Z"))[1];
  expect(t.title).toBe("2027年度 年末調整申告開始のお知らせ");
  expect(t.body).toContain("～ 2027年度 ～");
  expect(t.body).toContain("〇令和9年途中入社の従業員様の源泉徴収票について");
  expect(t.body).toContain("令和9年11月20日(金)17時");
  expect(templateTagIds(t,tags)).toEqual({ids:["e1","e2","s1"],missing:[]});
});
it("タグが無いときは名前を返す",()=>{
  expect(templateTagIds(broadcastTemplates()[0],[]).missing).toEqual(["アルバイト","ブロードバンド事業","在籍中"]);
});

import { describe, it, expect } from "vitest";
import { applicant, flatten, hearing, canViewSprout, hireValues, filterApplicants, type KRecord } from "./model";
export const record = (values: Record<string, unknown>): KRecord => Object.fromEntries(Object.entries(values).map(([k,value]) => [k,{value}]));
describe("Sprout conversion and filtering", () => {
  it("preserves checkboxes, timestamps, and nested record values", () => {
    const a = applicant({ ...record({ $id:"1", チェックボックス_3:["バイトル","友人からの紹介"], 日時_2:"2026-10-24T05:00:00Z", 日付_0:"2026-10-24" }),
      "配属・異動":{type:"SUBTABLE",value:[{id:"10",value:record({日付_1:"2026-10-24",文字列__複数行__0:"確認済み"})}]} });
    expect(a.application_methods).toEqual(["バイトル","友人からの紹介"]);
    expect(a.interview_at).toBe("2026-10-24T05:00:00.000Z");
    expect(a.raw["配属・異動"]).toEqual([{id:"10",日付_1:"2026-10-24",文字列__複数行__0:"確認済み"}]);
    expect(flatten(record({ empty: "" }))).toEqual({empty:""});
  });
  it("links by the reference condition; falls back to unique name and phone, never guesses", () => {
    const a = applicant(record({$id:"1",従業員名_姓名:"山田 太郎",連絡先:"090-1111-2222",問合せNo:"42"}));
    expect(hearing(record({$id:"2",照合:"42"}),[a],{field:"問合せNo",relatedField:"照合"}).applicant_record_id).toBe("1");
    const h = record({従業員名_姓名:"山田　太郎",連絡先_ハイフンなし:"09011112222"});
    expect(hearing(h,[a]).applicant_record_id).toBe("1");
    expect(hearing(h,[a,{...a,kintone_record_id:"3"}]).applicant_record_id).toBeNull();
    expect(hearing(record({従業員名_姓名:"山田 太郎"}),[a]).applicant_record_id).toBeNull();
  });
  it("filters statuses and months; schedules include today in Japan and sort ascending", () => {
    const base = applicant(record({$id:"1",従業員名_姓名:"山田 太郎",連絡先:"09011112222",日付_0:"2026-10-01",ドロップダウン_1:"④▼面接待ち",日時_2:"2026-10-23T15:00:00Z"}));
    const rows = [{...base,kintone_record_id:"2",interview_at:"2026-10-24T06:00:00Z"},base,{...base,kintone_record_id:"3",interview_at:"2026-10-23T14:59:00Z"}];
    expect(filterApplicants(rows,"interviews","",[],"","2026-10-24").map(a=>a.kintone_record_id)).toEqual(["1","2"]);
    expect(filterApplicants(rows,"applicants","2026-09",[],"","2026-10-24")).toHaveLength(0);
    expect(filterApplicants(rows,"applicants","",["⑩入社"],"","2026-10-24")).toHaveLength(0);
    expect(filterApplicants([base],"applicants","",[],"090-1111","2026-10-24")).toHaveLength(1);
    expect(filterApplicants([{...base,training_date:"2026-10-24"},{...base,training_date:"2026-10-23"}],"training","",[],"","2026-10-24")).toHaveLength(1);
  });
  it("only exposes recruitment to super_admin", () => {
    for (const role of [null,undefined,"admin","staff","manager","owner"]) expect(canViewSprout(role)).toBe(false);
    expect(canViewSprout("super_admin")).toBe(true);
  });
  it("builds a planned hire using the training date before hire date", () => {
    const a = applicant(record({$id:"1",従業員名_姓名:"山田 太郎",従業員名_姓名カナ:"ヤマダ タロウ",性別:"男性",日付:"2000-01-01",日付_2:"2026-11-01",入社日:"2026-11-02",ドロップダウン_1:"⑧▼研修待ち"}));
    expect(hireValues(a)).toMatchObject({source_applicant_id:"1",status:"planned",hire_date:"2026-11-01",employment_type:"アルバイト"});
    expect(hireValues({...a,training_date:null}).hire_date).toBe("2026-11-02");
    expect(()=>hireValues({...a,status:"①面接未決"})).toThrow();
    expect(()=>hireValues({...a,first_name:""})).toThrow();
  });
});

import { describe, expect, it, vi } from "vitest";
import { buildRows, monthEnd, reconcile, applyActions, type Action } from "./kanden-sync";
const expense = (ym: string, n: number) => ({ 日付: {value:"2024-07-10"}, 事業選択:{value:["関電"]}, 文字列__1行__4:{value:ym}, 数値:{value:String(n)} });
it("settlement aggregation, rounding, month ends and zero omission", () => {
 const rows = buildRows([expense("202407",100),expense("202407",101),expense("202408",0)],[],"2024-08");
 expect(rows).toHaveLength(1); expect(rows[0].支払額_税込_.value).toBe("201"); expect(rows[0].支払額_税抜_.value).toBe("183"); expect(rows[0].入出金予定日.value).toBe("2024-07-31"); expect(monthEnd("2024-02")).toBe("2024-02-29");
});
it("multiple transfers, last date, first description and missing months", () => {
 const rows = buildRows([], [{date:"2024-07-31",content:"カ)トツプウエイ last",value:60500,side:"EXPENSE"},{date:"2024-07-01",content:"カ)トツプウエイ first",value:30250,side:"EXPENSE"},{date:"2024-07-20",content:"ヒラノ ジユンヤ",value:38500,side:"EXPENSE"}],"2024-08");
 expect(rows).toHaveLength(2); expect(rows[0].支払額_税込_.value).toBe("90750"); expect(rows[0]._MF_取引日.value).toBe("2024-07-31"); expect(rows[0]._MF_摘要.value).toBe("カ)トツプウエイ first"); expect(rows[1].支払額_税抜_.value).toBe("35000");
});
it("add, update amounts only, unchanged, unmarked and duplicate conflicts", () => {
 const rows = buildRows([expense("202407",1100)],[],"2024-07");
 const add = reconcile(rows,[],"履歴")[0]; expect(add.action).toBe("add");
 const old = {...add.record,$id:{value:"1"},$revision:{value:"2"}};
 expect(reconcile(rows,[old],"履歴")[0].action).toBe("unchanged");
 const update = reconcile(rows,[{...old,支払額_税込_:{value:"100"}}],"履歴")[0]; expect(update.action).toBe("update"); expect(Object.keys(update.record)).toEqual(["支払額_税込_"]); expect(update.revision).toBe("2");
 expect(reconcile(rows,[{...old,テーブル:{value:[]}}],"履歴")[0].action).toBe("conflict"); expect(reconcile(rows,[old,old],"履歴")[0].action).toBe("conflict");
});
it("dry run never writes; batches 100; stops on failure", async () => {
 const actions: Action[] = Array.from({length:201},(_,i)=>({action:"add",key:String(i),record:{}})); const write=vi.fn().mockResolvedValue(undefined);
 await applyActions(actions,true,write); expect(write).not.toHaveBeenCalled(); await applyActions(actions,false,write); expect(write.mock.calls.map(c=>c[1].length)).toEqual([100,100,1]);
 write.mockReset().mockRejectedValue(new Error("fail")); await expect(applyActions(actions,false,write)).rejects.toThrow("fail"); expect(write).toHaveBeenCalledTimes(1);
});

describe("まとめて払った月を分ける（今回に限り）", () => {
  it("2024-11 のヒラノ 154,000 円を 8〜11 月に 38,500 円ずつ・入出金予定日は各月末・取引日は実際の振込日", () => {
    const rows = buildRows([], [{ date: "2024-11-29", content: "関西みらい銀行 ヒラノ ジユンヤ(依頼人名:", value: 154000, side: "EXPENSE" } as never], "2024-12");
    const months = rows.map(r => [r.実績期間.value, r.支払額_税込_.value, r.入出金予定日.value, r._MF_取引日?.value]);
    expect(months).toEqual([
      ["2024-08-01", "38500", "2024-08-31", "2024-11-29"],
      ["2024-09-01", "38500", "2024-09-30", "2024-11-29"],
      ["2024-10-01", "38500", "2024-10-31", "2024-11-29"],
      ["2024-11-01", "38500", "2024-11-30", "2024-11-29"],
    ]);
  });
});

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createValidSalesMasterRecord, evaluateGardenCheck } from "../_lib/zenkaku-check";
import { ZenkakuCheckError } from "../_lib/zenkaku-source";
import ZenkakuTab from "./ZenkakuTab";

describe("ZenkakuTab", () => {
  it("shows postal data date and a two-month stale warning", () => {
    const { rerender } = render(<ZenkakuTab postalDataStatus={{ sourceDate: "2026-08-01", importedAt: "2026-08-05T00:00:00Z" }} now={new Date("2026-09-30T00:00:00Z")} />);
    expect(screen.getByText("郵便番号データ：2026年8月1日 時点")).toBeInTheDocument(); expect(screen.queryByText("郵便番号データが古い可能性があります")).not.toBeInTheDocument();
    rerender(<ZenkakuTab postalDataStatus={{ sourceDate: "2026-08-01", importedAt: "2026-08-05T00:00:00Z" }} now={new Date("2026-10-01T00:00:00Z")} />);
    expect(screen.getByText("郵便番号データが古い可能性があります")).toBeInTheDocument();
  });
  it("checks a sales ID and blocks progress while showing every missing field", async () => {
    const runCheck = vi.fn().mockResolvedValue(evaluateGardenCheck(createValidSalesMasterRecord({ productCategory1: "回線", applicationPlanName: null, applicationIsp: null, constructionType: null }), [], new Date(2026, 7, 22)));
    render(<ZenkakuTab runCheck={runCheck}/>);
    fireEvent.change(screen.getByLabelText("営業ID"), { target: { value: " L26000001 " } });
    fireEvent.click(screen.getByRole("button", { name: "連携チェック" }));
    expect(await screen.findByRole("heading", { name: "修正が必要です" })).toBeInTheDocument();
    expect(runCheck).toHaveBeenCalledWith("L26000001");
    expect(screen.getByText("申込プラン名")).toBeInTheDocument(); expect(screen.getByText("申込ISP")).toBeInTheDocument(); expect(screen.getByText("工事種別")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "確認できました" })).not.toBeInTheDocument();
  });
  it("shows success and leaves the next-stage button disabled when no blocking issue exists", async () => {
    render(<ZenkakuTab runCheck={async () => evaluateGardenCheck(createValidSalesMasterRecord())}/>);
    fireEvent.change(screen.getByLabelText("営業ID"), { target: { value: "L26000001" } }); fireEvent.click(screen.getByRole("button", { name: "連携チェック" }));
    expect(await screen.findByRole("heading", { name: "確認できました" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "前確依頼を出す" })).toBeEnabled();
  });
  it("shows checking state until the source resolves", async () => {
    let resolve!: (value: ReturnType<typeof evaluateGardenCheck>) => void;
    const pending = new Promise<ReturnType<typeof evaluateGardenCheck>>((done) => { resolve = done; });
    render(<ZenkakuTab runCheck={() => pending}/>); fireEvent.change(screen.getByLabelText("営業ID"), { target: { value: "L1" } }); fireEvent.click(screen.getByRole("button", { name: "連携チェック" }));
    expect(screen.getByRole("status")).toHaveTextContent("社内のシステムに確認しています"); resolve(evaluateGardenCheck(createValidSalesMasterRecord()));
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });
  it("shows duplicate details as a warning without blocking the success result", async () => {
    render(<ZenkakuTab runCheck={async () => evaluateGardenCheck(createValidSalesMasterRecord(), [{ caseId: "L26000123", productName: "BIGLOBE光", registeredDate: "2026-07-18" }])}/>);
    fireEvent.change(screen.getByLabelText("営業ID"), { target: { value: "L26000001" } }); fireEvent.click(screen.getByRole("button", { name: "連携チェック" }));
    expect(await screen.findByRole("heading", { name: "警告" })).toBeInTheDocument();
    expect(screen.getByText(/案件ID L26000123 ／ BIGLOBE光 ／ 2026-07-18/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "確認できました" })).toBeInTheDocument();
  });
  it("requires a sales ID before loading data", () => {
    const runCheck = vi.fn(); render(<ZenkakuTab runCheck={runCheck}/>); fireEvent.click(screen.getByRole("button", { name: "連携チェック" }));
    expect(screen.getByRole("alert")).toHaveTextContent("営業IDを入力してください"); expect(runCheck).not.toHaveBeenCalled();
  });
  it("shows actionable messages for not-found and unavailable responses", async () => {
    const { rerender } = render(<ZenkakuTab runCheck={async () => { throw new ZenkakuCheckError("not_found"); }}/>); fireEvent.change(screen.getByLabelText("営業ID"), { target: { value: "BAD" } }); fireEvent.click(screen.getByRole("button", { name: "連携チェック" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("この営業IDは見つかりませんでした");
    rerender(<ZenkakuTab runCheck={async () => { throw new ZenkakuCheckError("unavailable"); }}/>); fireEvent.click(screen.getByRole("button", { name: "連携チェック" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("管理者へ問合せてください"));
  });
  it("groups simple required fields under one repeated-free heading", async () => {
    const result = evaluateGardenCheck(createValidSalesMasterRecord({ constructionType: "転用 他社転用", transferApprovalNumber: null, installationPostalCode: null }));
    render(<ZenkakuTab runCheck={async () => result}/>); fireEvent.change(screen.getByLabelText("営業ID"), { target: { value: "L1" } }); fireEvent.click(screen.getByRole("button", { name: "連携チェック" }));
    await screen.findByText("転用承諾番号"); expect(screen.getAllByText("次の項目を入力してください。")).toHaveLength(1); expect(screen.getByText("郵便番号")).toBeInTheDocument();
  });
  it("shows multiple team candidates in the page and continues with the selected team", async () => {
    const result={...evaluateGardenCheck(createValidSalesMasterRecord()),requestId:"check-1"};
    const fetchMock=vi.spyOn(globalThis,"fetch").mockResolvedValueOnce(new Response(JSON.stringify({id:"submit-1"}),{status:201})).mockResolvedValueOnce(new Response(JSON.stringify({status:"needs_partner",candidates:[{code:"101",label:"訪問A"},{code:"202",label:"訪問B"}]}))).mockResolvedValueOnce(new Response(JSON.stringify({ok:true}))).mockResolvedValueOnce(new Response(JSON.stringify({status:"done",case_id:"L26000001"})));
    render(<ZenkakuTab runCheck={async()=>result}/>);fireEvent.change(screen.getByLabelText("営業ID"),{target:{value:"L1"}});fireEvent.click(screen.getByRole("button",{name:"連携チェック"}));await screen.findByRole("button",{name:"前確依頼を出す"});fireEvent.click(screen.getByRole("button",{name:"前確依頼を出す"}));await act(async()=>{await new Promise(resolve=>setTimeout(resolve,1100))});expect(screen.getByText("どちらのチームか選んでください")).toBeInTheDocument();fireEvent.click(screen.getByLabelText(/訪問B/));fireEvent.click(screen.getByRole("button",{name:"このチームで出す"}));await act(async()=>{await new Promise(resolve=>setTimeout(resolve,1100))});expect(await screen.findByText(/前確依頼を出しました/)).toBeInTheDocument();expect(String(fetchMock.mock.calls[2][1]?.body)).toContain('"partnerCode":"202"');fetchMock.mockRestore();
  });
  it("can cancel the team selection",async()=>{const fetchMock=vi.spyOn(globalThis,"fetch").mockResolvedValueOnce(new Response(JSON.stringify({id:"submit-1"}),{status:201})).mockResolvedValueOnce(new Response(JSON.stringify({status:"needs_partner",candidates:[{code:"101",label:"訪問A"},{code:"202",label:"訪問B"}]})));render(<ZenkakuTab runCheck={async()=>({...evaluateGardenCheck(createValidSalesMasterRecord()),requestId:"check-1"})}/>);fireEvent.change(screen.getByLabelText("営業ID"),{target:{value:"L1"}});fireEvent.click(screen.getByRole("button",{name:"連携チェック"}));await screen.findByRole("button",{name:"前確依頼を出す"});fireEvent.click(screen.getByRole("button",{name:"前確依頼を出す"}));await act(async()=>{await new Promise(resolve=>setTimeout(resolve,1100))});fireEvent.click(screen.getByRole("button",{name:"取りやめる"}));expect(screen.getByRole("status")).toHaveTextContent("前確依頼を取りやめました。");fetchMock.mockRestore();});
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createValidSalesMasterRecord, evaluateGardenCheck } from "../_lib/zenkaku-check";
import { ZenkakuCheckError } from "../_lib/zenkaku-source";
import ZenkakuTab from "./ZenkakuTab";

describe("ZenkakuTab", () => {
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
    expect(screen.getByRole("button", { name: /次へ進む/ })).toBeDisabled();
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
});

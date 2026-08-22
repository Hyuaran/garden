import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createValidSalesMasterRecord } from "../_lib/zenkaku-check";
import ZenkakuTab from "./ZenkakuTab";

describe("ZenkakuTab", () => {
  it("checks a sales ID and blocks progress while showing every missing field", async () => {
    const loadSource = vi.fn().mockResolvedValue({ record: createValidSalesMasterRecord({ productCategory1: "回線", applicationPlanName: null, applicationIsp: null, constructionType: null }), duplicates: [] });
    render(<ZenkakuTab loadSource={loadSource} now={() => new Date(2026, 7, 22)}/>);
    fireEvent.change(screen.getByLabelText("営業ID"), { target: { value: " L26000001 " } });
    fireEvent.click(screen.getByRole("button", { name: "連携チェック" }));
    expect(await screen.findByRole("heading", { name: "修正が必要です" })).toBeInTheDocument();
    expect(loadSource).toHaveBeenCalledWith("L26000001");
    expect(screen.getByText("申込プラン名")).toBeInTheDocument(); expect(screen.getByText("申込ISP")).toBeInTheDocument(); expect(screen.getByText("工事種別")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "確認できました" })).not.toBeInTheDocument();
  });
  it("shows success and leaves the next-stage button disabled when no blocking issue exists", async () => {
    render(<ZenkakuTab loadSource={async () => ({ record: createValidSalesMasterRecord(), duplicates: [] })}/>);
    fireEvent.change(screen.getByLabelText("営業ID"), { target: { value: "L26000001" } }); fireEvent.click(screen.getByRole("button", { name: "連携チェック" }));
    expect(await screen.findByRole("heading", { name: "確認できました" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /次へ進む/ })).toBeDisabled();
  });
  it("shows checking state until the source resolves", async () => {
    let resolve!: (value: { record: ReturnType<typeof createValidSalesMasterRecord>; duplicates: [] }) => void;
    const pending = new Promise<{ record: ReturnType<typeof createValidSalesMasterRecord>; duplicates: [] }>((done) => { resolve = done; });
    render(<ZenkakuTab loadSource={() => pending}/>); fireEvent.change(screen.getByLabelText("営業ID"), { target: { value: "L1" } }); fireEvent.click(screen.getByRole("button", { name: "連携チェック" }));
    expect(screen.getByRole("status")).toHaveTextContent("営業マスタを確認しています"); resolve({ record: createValidSalesMasterRecord(), duplicates: [] });
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });
  it("shows duplicate details as a warning without blocking the success result", async () => {
    render(<ZenkakuTab loadSource={async () => ({ record: createValidSalesMasterRecord(), duplicates: [{ caseId: "L26000123", productName: "BIGLOBE光", registeredDate: "2026-07-18" }] })}/>);
    fireEvent.change(screen.getByLabelText("営業ID"), { target: { value: "L26000001" } }); fireEvent.click(screen.getByRole("button", { name: "連携チェック" }));
    expect(await screen.findByRole("heading", { name: "警告" })).toBeInTheDocument();
    expect(screen.getByText(/案件ID L26000123 ／ BIGLOBE光 ／ 2026-07-18/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "確認できました" })).toBeInTheDocument();
  });
  it("requires a sales ID before loading data", () => {
    const loadSource = vi.fn(); render(<ZenkakuTab loadSource={loadSource}/>); fireEvent.click(screen.getByRole("button", { name: "連携チェック" }));
    expect(screen.getByRole("alert")).toHaveTextContent("営業IDを入力してください"); expect(loadSource).not.toHaveBeenCalled();
  });
});

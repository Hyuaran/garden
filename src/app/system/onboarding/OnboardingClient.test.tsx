import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OnboardingClient from "./OnboardingClient";
import OnboardingReview from "./_components/OnboardingReview";
import { emptyInput, POSTAL_NOT_FOUND, STEPS, type OnboardingRecord } from "./_lib/onboarding";
import { NDA_FULL_TEXT } from "../mypage/_lib/nda-content";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const initial = (): OnboardingRecord => ({ values: emptyInput(), status: "draft", ndaAgreedAt: null, submittedAt: null });
let requests: { action: string; values: OnboardingRecord["values"] }[];
let fetchMock: ReturnType<typeof vi.fn>;
async function next(index: number) {
  fireEvent.click(screen.getByRole("button", { name: "次へ" }));
  await screen.findByRole("heading", { name: STEPS[index] });
}

describe("8画面の入社手続き", () => {
  beforeEach(() => {
    refresh.mockClear();
    requests = [];
    fetchMock = vi.fn(async (_url: string, options?: RequestInit) => {
      const body = JSON.parse(String(options?.body)); requests.push(body);
      return { ok: true, json: async () => ({ ok: true, status: body.action === "submit" ? "submitted" : "draft" }) };
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("初期値を表示し、編集できる。個人番号の欄はない", () => {
    const record = initial(); record.values.name = "検証 太郎"; record.values.name_kana = "ケンショウ タロウ"; record.values.birth_date = "2000-01-02";
    const { container } = render(<OnboardingClient initial={record} />);
    expect(screen.getByLabelText("氏名")).toHaveValue("検証 太郎");
    expect(screen.getByLabelText("フリガナ")).toHaveValue("ケンショウ タロウ");
    expect(screen.getByLabelText("生年月日")).toHaveValue("2000-01-02");
    fireEvent.change(screen.getByLabelText("氏名"), { target: { value: "訂正後" } });
    expect(screen.getByLabelText("氏名")).toHaveValue("訂正後");
    expect(screen.queryByLabelText(/マイナンバー|個人番号/)).toBeNull();
    expect(container.querySelector("[required]")).toBeNull();
  });
  it("空欄・同意なしでも8画面を順に進んで提出でき、進むたび保存する", async () => {
    render(<OnboardingClient initial={initial()} />);
    for (let index = 1; index < 8; index++) await next(index);
    expect(requests).toHaveLength(7); expect(requests.every(r => r.action === "save")).toBe(true);
    expect(screen.getByText("8つのうち 8番目")).toBeInTheDocument();
    expect(screen.getAllByText("未入力").length).toBeGreaterThan(10);
    fireEvent.click(screen.getByRole("button", { name: "提出する" }));
    await screen.findByRole("heading", { name: "入社手続きを提出しました" });
    expect(requests[7]).toEqual({ action: "submit", values: emptyInput() });
    expect(refresh).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "提出する" })).toBeNull();
  });
  it("戻るときも保存し、入力内容を維持する", async () => {
    render(<OnboardingClient initial={initial()} />);
    fireEvent.change(screen.getByLabelText("氏名"), { target: { value: "入力した名前" } });
    await next(1);
    fireEvent.click(screen.getByRole("button", { name: "戻る" }));
    await screen.findByRole("heading", { name: "あなたのこと" });
    expect(screen.getByLabelText("氏名")).toHaveValue("入力した名前"); expect(requests).toHaveLength(2);
  });
  it("途中保存した内容を再マウントで復元できる", async () => {
    const view = render(<OnboardingClient initial={initial()} />);
    fireEvent.change(screen.getByLabelText("氏名"), { target: { value: "保存された名前" } });
    fireEvent.click(screen.getByRole("button", { name: "途中保存" }));
    await screen.findByText("保存しました。");
    view.unmount(); render(<OnboardingClient initial={{ ...initial(), values: requests[0].values }} />);
    expect(screen.getByLabelText("氏名")).toHaveValue("保存された名前");
  });
  it("保存失敗は進まず内容を残し、再試行できる", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "保存できませんでした。" }) });
    render(<OnboardingClient initial={initial()} />);
    fireEvent.change(screen.getByLabelText("氏名"), { target: { value: "消えない入力" } });
    fireEvent.click(screen.getByRole("button", { name: "次へ" }));
    await screen.findByText("保存できませんでした。");
    expect(screen.getByLabelText("氏名")).toHaveValue("消えない入力");
    await next(1);
  });
  it("形式の注意は表示するが次へ進める", async () => {
    render(<OnboardingClient initial={initial()} />); await next(1);
    fireEvent.change(screen.getByLabelText("郵便番号"), { target: { value: "12" } });
    expect(screen.getByText(/郵便番号は7桁/)).toBeInTheDocument();
    await next(2); expect(requests.at(-1)?.values.postal_code).toBe("12");
  });
  it("扶養家族を2人に増やして1人消せる", async () => {
    render(<OnboardingClient initial={initial()} />); await next(1); await next(2);
    fireEvent.change(screen.getByLabelText("扶養している家族はいますか"), { target: { value: "yes" } });
    fireEvent.click(screen.getByRole("button", { name: "もう1人ふやす" }));
    expect(screen.getByRole("group", { name: "扶養家族 2人目" })).toBeInTheDocument();
    fireEvent.change(within(screen.getByRole("group", { name: "扶養家族 2人目" })).getByLabelText("氏名"), { target: { value: "残す家族" } });
    fireEvent.click(screen.getByRole("button", { name: "1人目を消す" }));
    expect(screen.queryByRole("group", { name: "扶養家族 2人目" })).toBeNull();
    expect(screen.getByLabelText("氏名")).toHaveValue("残す家族");
    await next(3); expect(requests.at(-1)?.values.dependents).toHaveLength(1);
  });
  it("被保険者証ありのときだけ番号欄を表示する", async () => {
    render(<OnboardingClient initial={initial()} />); await next(1); await next(2); await next(3);
    expect(screen.queryByLabelText("雇用保険被保険者番号")).toBeNull();
    fireEvent.change(screen.getByLabelText("雇用保険被保険者証"), { target: { value: "yes" } });
    expect(screen.getByLabelText("雇用保険被保険者番号")).toBeInTheDocument();
  });
  it("既存の秘密保持本文をそのまま表示する", async () => {
    const { container } = render(<OnboardingClient initial={initial()} />);
    for (let index = 1; index <= 6; index++) await next(index);
    expect([...container.querySelectorAll("div")].some(node => node.textContent === NDA_FULL_TEXT)).toBe(true);
    expect(screen.getByLabelText("内容を確認しました")).not.toBeChecked();
  });
  it("郵便番号一致時に住所・カナを補完し、当たりがないと手入力案内を出す", async () => {
    render(<OnboardingClient initial={initial()} />); await next(1);
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ addresses: [{ address: "大阪府大阪市中央区南本町", addressKana: "オオサカフオオサカシチュウオウクミナミホンマチ" }] }) });
    fireEvent.change(screen.getByLabelText("郵便番号"), { target: { value: "5410054" } });
    await waitFor(() => expect(screen.getByLabelText("住所")).toHaveValue("大阪府大阪市中央区南本町"));
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ addresses: [] }) });
    fireEvent.change(screen.getByLabelText("郵便番号"), { target: { value: "0000000" } });
    await screen.findByText(POSTAL_NOT_FOUND);
    fireEvent.change(screen.getByLabelText("住所"), { target: { value: "手入力の住所" } });
    expect(screen.getByLabelText("住所")).toHaveValue("手入力の住所");
  });
  it("郵便番号の遅い応答で手入力住所を上書きしない", async () => {
    render(<OnboardingClient initial={initial()} />); await next(1);
    let resolvePostal!: (value: unknown) => void;
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { resolvePostal = resolve; }));
    fireEvent.change(screen.getByLabelText("郵便番号"), { target: { value: "5410054" } });
    await screen.findByText("住所を調べています。");
    fireEvent.change(screen.getByLabelText("住所"), { target: { value: "手入力を優先" } });
    resolvePostal({ ok: true, json: async () => ({ addresses: [{ address: "候補", addressKana: "コウホ" }] }) });
    await screen.findByText("住所の候補を選ぶか、住所を直接入れてください。");
    expect(screen.getByLabelText("住所")).toHaveValue("手入力を優先");
  });
});

describe("確認画面", () => {
  it("7テーマを指定順で並べ、内容・未入力・直すを表示する", () => {
    const values = emptyInput(); values.name = "確認する名前";
    const edit = vi.fn(); render(<OnboardingReview values={values} onEdit={edit} />);
    expect(screen.getAllByRole("heading", { level: 3 }).map(h => h.textContent)).toEqual(STEPS.slice(0, 7));
    expect(screen.getByText("確認する名前")).toBeInTheDocument();
    expect(screen.getAllByText("未入力").length).toBeGreaterThan(10);
    expect(screen.getByText("扶養家族：0人")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "住所と連絡先を直す" })); expect(edit).toHaveBeenCalledWith(1);
  });
});

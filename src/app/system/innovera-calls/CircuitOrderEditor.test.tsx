import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CircuitOrderEditor from "./CircuitOrderEditor";
const id1 = "00000000-0000-4000-8000-000000000001", id2 = "00000000-0000-4000-8000-000000000002";
const a = { id: "a", name: "回線A" }, b = { id: "b", name: "回線B" };
const initial = [{ id: id1, name: "代表番号", circuits: [a, b] }, { id: id2, name: "空の表題", circuits: [] }, { id: null, name: "その他", circuits: [] }];
const reply = (groups = initial) => new Response(JSON.stringify({ ok: true, circuitGroups: groups }));
function fromBody(init?: RequestInit) {
  const body = JSON.parse(String(init?.body));
  const lookup = new Map([["a", a], ["b", b]]);
  return [...body.groups.map((g: { id: string; name: string; circuitIds: string[] }) => ({ id: g.id, name: g.name, circuits: g.circuitIds.map(id => lookup.get(id)) })), { id: null, name: "その他", circuits: body.other.map((id: string) => lookup.get(id)) }];
}
describe("CircuitOrderEditor", () => {
  beforeEach(() => vi.restoreAllMocks());
  it("moves a circuit into an empty heading and moves whole headings with the keyboard", async () => {
    const fetchMock = vi.fn(async (_: unknown, init?: RequestInit) => init?.method === "PUT" ? reply(fromBody(init)) : reply());
    vi.stubGlobal("fetch", fetchMock);
    render(<CircuitOrderEditor onBusy={vi.fn()} />);
    fireEvent.keyDown(await screen.findByLabelText("回線Bをつかんで移動"), { key: "ArrowDown" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).groups[1].circuitIds).toEqual(["b"]);
    await waitFor(() => expect(screen.getByText("回線B").closest("[data-order-group]")).toHaveAttribute("data-order-group", id2));
    fireEvent.keyDown(screen.getByLabelText("代表番号をつかんで移動"), { key: "ArrowDown" });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body)).groups.map((g: { id: string }) => g.id)).toEqual([id2, id1]);
  });
  it("sends consecutive changes one at a time and rolls back pending changes after failure", async () => {
    let finish!: (response: Response) => void;
    const fetchMock = vi.fn((_url: unknown, init?: RequestInit): Promise<Response> => {
      if (!init?.method) return Promise.resolve(reply());
      return new Promise(resolve => { finish = resolve; });
    });
    vi.stubGlobal("fetch", fetchMock);
    const busy = vi.fn(); render(<CircuitOrderEditor onBusy={busy} />);
    fireEvent.keyDown(await screen.findByLabelText("回線Aをつかんで移動"), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByLabelText("回線Aをつかんで移動"), { key: "ArrowDown" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = fromBody(fetchMock.mock.calls[1][1]); finish(reply(first));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body)).groups[1].circuitIds).toEqual(["a"]);
    finish(new Response(JSON.stringify({ ok: false }), { status: 500 }));
    expect(await screen.findByRole("alert")).toHaveTextContent("並び順を保存できませんでした。もう一度お試しください");
    expect(screen.getByText("回線A").closest("[data-order-group]")).toHaveAttribute("data-order-group", id1);
    expect(busy).toHaveBeenLastCalledWith(false);
    expect(Array.from(screen.getByText("代表番号").closest("[data-order-group]")!.querySelectorAll("[data-order-item] span")).map(el => el.textContent)).toEqual(["回線B", "回線A"]);
  });
  it("adds, renames and deletes headings through the shared modal and moves deleted circuits to other", async () => {
    const fetchMock = vi.fn(async (_: unknown, init?: RequestInit) => init?.method === "PUT" ? reply(fromBody(init)) : reply());
    vi.stubGlobal("fetch", fetchMock); render(<CircuitOrderEditor onBusy={vi.fn()} />);
    const add = await screen.findByRole("button", { name: "＋ 表題を追加する" });
    expect(add.compareDocumentPosition(screen.getByText("代表番号").closest("[data-order-group]")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(add);
    let dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("表題"), { target: { value: "追加" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "表題を追加する" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    fireEvent.click(within(screen.getByText("追加").closest("[data-order-group]")!).getByRole("button", { name: "追加を編集" }));
    dialog = screen.getByRole("dialog", { name: "表題を編集" });
    fireEvent.change(within(dialog).getByLabelText("表題"), { target: { value: "変更済み" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "表題を編集" }));
    await screen.findByText("変更済み");
    fireEvent.click(within(screen.getByText("代表番号").closest("[data-order-group]")!).getByRole("button", { name: "代表番号を削除" }));
    dialog = screen.getByRole("dialog", { name: "表題を削除" });
    expect(dialog).toHaveTextContent("中の番号は『その他』に移ります");
    fireEvent.click(within(dialog).getByRole("button", { name: "削除する" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    expect(JSON.parse(String(fetchMock.mock.calls[3][1]?.body)).other).toEqual(["a", "b"]);
    expect(screen.queryByText("代表番号")).not.toBeInTheDocument();
  });
});

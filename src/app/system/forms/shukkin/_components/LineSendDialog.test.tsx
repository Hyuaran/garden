import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SHUKKIN_GROUPS, type LineShiftBlock, type ShukkinMember } from "../_lib/shukkin";
import LineSendDialog from "./LineSendDialog";

vi.mock("@/app/system/list/_components/ListProcessingOverlay", () => ({
  ListProcessingOverlay: () => null,
}));

function member(employeeNumber: string, name: string): ShukkinMember {
  return {
    employeeNumber,
    name,
    employmentType: "",
    groupName: SHUKKIN_GROUPS[3],
    sortOrder: Number(employeeNumber),
    active: true,
  };
}

const blocks: LineShiftBlock[] = [
  {
    shift: "10:00-14:00",
    people: [member("0001", "A"), member("0002", "B")],
    recipients: [],
    message: "message 1",
    summary: "",
  },
  {
    shift: "14:00-18:00",
    people: [member("0003", "C")],
    recipients: [],
    message: "message 2",
    summary: "",
  },
];

function actionButton() {
  const buttons = screen.getAllByRole("button");
  return buttons[buttons.length - 1];
}

describe("LineSendDialog", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends all members first and retries only failed employee numbers", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("/api/system/shukkin/line-send?")) {
        return new Response(JSON.stringify({
          quota: null,
          used: 0,
          remaining: null,
          needed: 3,
          ownLinked: true,
          members: [
            { employeeNumber: "0001", name: "A", linked: true, blocked: false },
            { employeeNumber: "0002", name: "B", linked: true, blocked: false },
            { employeeNumber: "0003", name: "C", linked: true, blocked: false },
          ],
        }), { status: 200 });
      }
      if (init?.method === "POST" && fetchMock.mock.calls.filter(([, callInit]) => callInit?.method === "POST").length === 1) {
        return new Response(JSON.stringify({
          sent: [{ employeeNumber: "0001", name: "A", shift: "10:00-14:00" }],
          failed: [{ employeeNumber: "0002", name: "B", shift: "10:00-14:00" }],
          unlinked: [],
          sentAt: "2026-10-14T00:00:00.000Z",
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        sent: [{ employeeNumber: "0002", name: "B", shift: "10:00-14:00" }],
        failed: [],
        unlinked: [],
        sentAt: "2026-10-14T00:01:00.000Z",
      }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LineSendDialog open date="2026-10-15" blocks={blocks} onClose={vi.fn()} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fireEvent.click(actionButton());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    fireEvent.click(actionButton());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    const firstBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(firstBody.blocks.map((block: { employeeNumbers: string[] }) => block.employeeNumbers)).toEqual([["0001", "0002"], ["0003"]]);

    const retryBody = JSON.parse(String(fetchMock.mock.calls[2][1]?.body));
    expect(retryBody.blocks).toEqual([{
      shift: "10:00-14:00",
      employeeNumbers: ["0002"],
      message: "message 1",
    }]);
  });
});

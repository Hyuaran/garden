import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

type ClarityCall = NonNullable<Window["clarity"]>;

async function loadTracker({
  projectId,
  employeeNumber,
  pathname,
}: {
  projectId?: string;
  employeeNumber: string | null;
  pathname: string;
}) {
  vi.resetModules();
  if (projectId === undefined) {
    delete process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
  } else {
    process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID = projectId;
  }

  let currentEmployeeNumber = employeeNumber;
  let currentPathname = pathname;

  vi.doMock("next/script", () => ({
    default: ({ id, src, strategy }: { id: string; src: string; strategy: string }) => (
      <script data-testid="clarity-script" data-script-id={id} data-src={src} data-strategy={strategy} />
    ),
  }));
  vi.doMock("next/navigation", () => ({
    usePathname: () => currentPathname,
  }));
  vi.doMock("@/app/_lib/auth-unified", () => ({
    useAuthUnified: () => ({ employeeNumber: currentEmployeeNumber }),
  }));

  const trackerModule = await import("./ClarityTracker");
  return {
    ClarityTracker: trackerModule.default,
    setEmployeeNumber: (next: string | null) => {
      currentEmployeeNumber = next;
    },
    setPathname: (next: string) => {
      currentPathname = next;
    },
  };
}

describe("ClarityTracker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
    delete window.clarity;
  });

  it("renders nothing and does not identify when the project id is empty", async () => {
    const clarity = vi.fn<ClarityCall>();
    window.clarity = clarity;
    const { ClarityTracker } = await loadTracker({
      employeeNumber: "0008",
      pathname: "/system/list",
    });

    render(<ClarityTracker />);

    expect(screen.queryByTestId("clarity-script")).not.toBeInTheDocument();
    expect(clarity).not.toHaveBeenCalled();
  });

  it("renders nothing when the project id contains invalid characters", async () => {
    const { ClarityTracker } = await loadTracker({
      projectId: "abc-123",
      employeeNumber: "0008",
      pathname: "/system/list",
    });

    render(<ClarityTracker />);

    expect(screen.queryByTestId("clarity-script")).not.toBeInTheDocument();
  });

  it("loads the Clarity script for a valid project id", async () => {
    const { ClarityTracker } = await loadTracker({
      projectId: "abc123",
      employeeNumber: null,
      pathname: "/system/list",
    });

    render(<ClarityTracker />);

    expect(screen.getByTestId("clarity-script")).toHaveAttribute("data-src", "https://www.clarity.ms/tag/abc123");
    expect(screen.getByTestId("clarity-script")).toHaveAttribute("data-strategy", "afterInteractive");
  });

  it("identifies the logged-in employee again when the pathname changes", async () => {
    const clarity = vi.fn<ClarityCall>();
    window.clarity = clarity;
    const tracker = await loadTracker({
      projectId: "abc123",
      employeeNumber: "0008",
      pathname: "/system/list",
    });
    const { ClarityTracker } = tracker;

    const { rerender } = render(<ClarityTracker />);

    await waitFor(() => {
      expect(clarity).toHaveBeenCalledWith("identify", "0008", undefined, "/system/list", "0008");
    });

    tracker.setPathname("/root/employees");
    rerender(<ClarityTracker />);

    await waitFor(() => {
      expect(clarity).toHaveBeenCalledWith("identify", "0008", undefined, "/root/employees", "0008");
    });
    expect(clarity).toHaveBeenCalledTimes(2);
  });

  it("queues identify when Clarity has not loaded yet", async () => {
    const { ClarityTracker } = await loadTracker({
      projectId: "abc123",
      employeeNumber: "0008",
      pathname: "/system/list",
    });

    render(<ClarityTracker />);

    await waitFor(() => {
      expect(window.clarity?.q).toEqual([
        ["identify", "0008", undefined, "/system/list", "0008"],
      ]);
    });
  });

  it("does not identify when no employee is logged in", async () => {
    const clarity = vi.fn<ClarityCall>();
    window.clarity = clarity;
    const { ClarityTracker } = await loadTracker({
      projectId: "abc123",
      employeeNumber: null,
      pathname: "/system/list",
    });

    render(<ClarityTracker />);

    expect(clarity).not.toHaveBeenCalled();
  });
});

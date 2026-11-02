import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
vi.mock("@/lib/ui/withInitialUrlView.server", () => ({ withInitialUrlView: (page: unknown) => page }));
vi.mock("../_components/BudFaithfulFrame", () => ({
  BudFaithfulFrame: ({ sourceHtml }: { sourceHtml: string }) => <main dangerouslySetInnerHTML={{ __html: sourceHtml }} />,
}));
vi.mock("./_components/TransferManagementEmbed", () => ({ TransferManagementEmbed: () => null }));
import TransfersPage from "./page";

it("renders transfer table placeholders before the client portals mount", () => {
  const { container } = render(<TransfersPage />);
  for (const name of ["overview-calendar", "schedule", "approval", "list"]) {
    const mount = container.querySelector("#trf-" + name + "-mount") as HTMLElement;
    expect(mount).not.toBeNull();
    expect(within(mount).getByRole("table")).toBeInTheDocument();
    expect(within(mount).getAllByRole("row")).toHaveLength(8);
  }
  expect(screen.getAllByRole("status", { name: "読み込み中" })).toHaveLength(4);
});

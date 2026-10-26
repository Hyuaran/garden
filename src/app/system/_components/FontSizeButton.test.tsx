import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { FontSizeProvider } from "@/app/_lib/FontSizeProvider";
import { initialFontSizeScript, rootZoom } from "@/app/_lib/font-size";
import FontSizeButton from "./FontSizeButton";
const auth = vi.hoisted(() => ({ userId: "person-a", loading: false }));
vi.mock("@/app/_lib/auth-unified", () => ({ useAuthUnified: () => auth }));
beforeEach(() => { localStorage.clear(); auth.userId = "person-a"; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); document.documentElement.style.zoom = ""; });
const view = () => <FontSizeProvider><FontSizeButton className="iconButton" tipClassName="actionTip" /><FontSizeButton className="iconButton" tipClassName="actionTip" /></FontSizeProvider>;
it("cycles both headers together, persists per user and restores on account change", () => {
  const { rerender } = render(view());
  for (const [label, size, zoom] of [["大", "l", "1.15"], ["小", "s", "0.9"], ["中", "m", "1"]]) {
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(document.documentElement.dataset.fontSize).toBe(size);
    expect(document.documentElement.style.zoom).toBe(zoom);
    expect(document.documentElement.style.getPropertyValue("--garden-zoom")).toBe(zoom);
    expect(localStorage.getItem("garden-font-size:person-a")).toBe(size);
    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveAccessibleName(new RegExp(`文字の大きさ：${label}`));
      expect(button).not.toHaveAttribute("title");
      expect(button.querySelector(".actionTip")).toHaveTextContent(`文字の大きさ：${label}`);
    }
  }
  localStorage.setItem("garden-font-size:person-b", "s");
  auth.userId = "person-b"; rerender(view());
  expect(rootZoom()).toBe(0.9);
});
it("uses medium when storage is inaccessible and still cycles", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw Error("blocked"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw Error("blocked"); });
  render(view());
  expect(rootZoom()).toBe(1);
  fireEvent.click(screen.getAllByRole("button")[0]);
  expect(rootZoom()).toBe(1.15);
});
it("restores before hydration from chunked cookie session without network", () => {
  const key = "sb--auth-token";
  const raw = "base64-" + btoa(JSON.stringify({ user: { id: "person-a" } }));
  document.cookie = `${key}.0=${raw.slice(0, 12)}`;
  document.cookie = `${key}.1=${raw.slice(12)}`;
  localStorage.setItem("garden-font-size:person-a", "l");
  const script = initialFontSizeScript.replace(/const project = .*?;/, 'const project = "";');
  window.eval(script);
  expect(rootZoom()).toBe(1.15);
  document.cookie = `${key}.0=; max-age=0`; document.cookie = `${key}.1=; max-age=0`;
});
it("installs controls in desktop and mobile shells and resets print zoom", () => {
  for (const file of ["system/_components/ShachoShell/ShachoShell.tsx", "bud/_components/BudShachoShell/BudShachoShell.tsx", "_components/layout/GardenShell/ModuleShell.tsx", "rill/_components/RillShachoShell.tsx"]) {
    expect(readFileSync(`src/app/${file}`, "utf8").match(/<FontSizeButton /g)).toHaveLength(2);
  }
  expect(readFileSync("src/app/globals.css", "utf8")).toMatch(/@media print\s*\{\s*html\s*\{\s*zoom:\s*1\s*!important/);
});

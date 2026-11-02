import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { useStoredView } from "./useStoredView";
function View({ name = "view" }: { name?: string }) {
  const [value,setValue,ready]=useStoredView(name,"list",raw=>raw,value=>value);
  return <button style={{visibility:ready?"visible":"hidden"}} onClick={()=>setValue(value==="list"?"grid":"list")}>{value}</button>;
}
afterEach(()=>{cleanup();localStorage.clear();vi.restoreAllMocks();});
it("hydrates without displaying the default or overwriting the saved preference", async()=>{
  localStorage.setItem("view","grid");
  const html=renderToString(<View/>);
  expect(html).toContain("visibility:hidden");
  expect(html).toContain("list");
  const container=document.createElement("div");container.innerHTML=html;document.body.appendChild(container);
  const errors:unknown[]=[];
  let root:ReturnType<typeof hydrateRoot>;
  await act(async()=>{root=hydrateRoot(container,<View/>,{onRecoverableError:error=>errors.push(error)});});
  expect(container.querySelector("button")).toHaveTextContent("grid");
  expect(container.querySelector("button")).toBeVisible();
  expect(localStorage.getItem("view")).toBe("grid");
  expect(errors).toEqual([]);
  await act(async()=>root!.unmount());container.remove();
});
it("restores a changed user key and persists only explicit changes",()=>{
  localStorage.setItem("first","grid");localStorage.setItem("second","list");
  const view=render(<View name="first"/>);
  expect(screen.getByRole("button")).toHaveTextContent("grid");
  view.rerender(<View name="second"/>);
  expect(screen.getByRole("button")).toHaveTextContent("list");
  fireEvent.click(screen.getByRole("button"));
  expect(localStorage.getItem("second")).toBe("grid");
  expect(localStorage.getItem("first")).toBe("grid");
});
it("falls back safely when storage is blocked",()=>{
  vi.spyOn(Storage.prototype,"getItem").mockImplementation(()=>{throw Error("blocked");});
  render(<View/>);expect(screen.getByRole("button")).toHaveTextContent("list");
});

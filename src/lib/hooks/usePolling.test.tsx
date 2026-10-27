import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { usePolling } from "./usePolling";
beforeEach(()=>{ vi.useFakeTimers(); Object.defineProperty(document,"visibilityState",{configurable:true,value:"visible"}); });
afterEach(()=>{ vi.useRealTimers(); });
const advance = (ms:number)=>act(async()=>{await vi.advanceTimersByTimeAsync(ms);});
it("callback changes do not restart polling, and latest callback is used",async()=>{
  const first=vi.fn(), next=vi.fn();
  const {rerender,unmount}=renderHook(({cb})=>usePolling(cb,1000),{initialProps:{cb:first}});
  expect(first).toHaveBeenCalledTimes(1);
  rerender({cb:next}); await advance(999); expect(next).not.toHaveBeenCalled();
  await advance(1); expect(next).toHaveBeenCalledTimes(1); unmount();
});
it("pauses while hidden and immediately resumes once",async()=>{
  Object.defineProperty(document,"visibilityState",{configurable:true,value:"hidden"});
  const cb=vi.fn();const {unmount}=renderHook(()=>usePolling(cb,1000));
  await advance(5000);expect(cb).not.toHaveBeenCalled();
  await act(async()=>{Object.defineProperty(document,"visibilityState",{configurable:true,value:"visible"});document.dispatchEvent(new Event("visibilitychange"));});
  expect(cb).toHaveBeenCalledTimes(1);await advance(1000);expect(cb).toHaveBeenCalledTimes(2);
  act(()=>{Object.defineProperty(document,"visibilityState",{configurable:true,value:"hidden"});document.dispatchEvent(new Event("visibilitychange"));});
  await advance(5000);expect(cb).toHaveBeenCalledTimes(2);unmount();
});
it("does not overlap even when interval or visibility changes during a request",async()=>{
  let finish!:()=>void; const cb=vi.fn(()=>new Promise<void>(r=>{finish=r;}));
  const {rerender,unmount}=renderHook(({interval})=>usePolling(cb,interval),{initialProps:{interval:1000}});
  await advance(3000);rerender({interval:500});await advance(1000);expect(cb).toHaveBeenCalledTimes(1);
  act(()=>{Object.defineProperty(document,"visibilityState",{configurable:true,value:"hidden"});document.dispatchEvent(new Event("visibilitychange"));});
  act(()=>{Object.defineProperty(document,"visibilityState",{configurable:true,value:"visible"});document.dispatchEvent(new Event("visibilitychange"));});
  expect(cb).toHaveBeenCalledTimes(1);
  await act(async()=>{finish();});await advance(500);expect(cb).toHaveBeenCalledTimes(2);unmount();
});
it("honors enabled, delayed start, failure and cleanup",async()=>{
  const cb=vi.fn().mockRejectedValue(new Error("offline"));
  const {rerender,unmount}=renderHook(({enabled})=>usePolling(cb,1000,{enabled,immediate:false}),{initialProps:{enabled:false}});
  await advance(2000);expect(cb).not.toHaveBeenCalled();rerender({enabled:true});
  await advance(2000);expect(cb).toHaveBeenCalledTimes(2);unmount();await advance(2000);expect(cb).toHaveBeenCalledTimes(2);
});

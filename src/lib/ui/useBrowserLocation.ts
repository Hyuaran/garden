"use client";
import { useLayoutEffect, useState } from "react";
import { useInitialSearch } from "./InitialUrlView";
export function useBrowserLocation(version = "") {
  const initialSearch=useInitialSearch();
  const [url,setUrl]=useState<string|null>(null);
  useLayoutEffect(()=>{
    const read=()=>setUrl(window.location.pathname+window.location.search+window.location.hash);
    read();window.addEventListener("popstate",read);window.addEventListener("hashchange",read);window.addEventListener("garden-tab-change",read);
    return()=>{window.removeEventListener("popstate",read);window.removeEventListener("hashchange",read);window.removeEventListener("garden-tab-change",read);};
  },[version,initialSearch]);
  return url;
}

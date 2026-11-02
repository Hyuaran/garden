"use client";
import { useLayoutEffect, useState } from "react";
export function useBrowserOrigin() {
  const [origin,setOrigin]=useState<string|null>(null);
  useLayoutEffect(()=>setOrigin(window.location.origin),[]);
  return origin;
}

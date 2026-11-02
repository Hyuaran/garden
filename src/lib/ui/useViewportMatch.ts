"use client";
import { useLayoutEffect, useState } from "react";
/** 幅による表示は描画前に確定する。SSR中は呼び出し元が領域を隠して予約する。 */
export function useViewportMatch(query: string) {
  const [state,setState]=useState({matches:false,ready:false});
  useLayoutEffect(()=>{
    const media=window.matchMedia?.(query);
    const update=()=>setState({matches:media?.matches ?? false,ready:true});
    update();media?.addEventListener("change",update);
    return()=>media?.removeEventListener("change",update);
  },[query]);
  return [state.matches,state.ready] as const;
}

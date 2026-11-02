"use client";
import { useLayoutEffect, useState } from "react";
/** チャートの描画前に明暗を確定し、明示設定がなければOS設定に従う。 */
export function useThemeAppearance() {
  const [state,setState]=useState({dark:false,ready:false});
  useLayoutEffect(()=>{
    const media=window.matchMedia?.("(prefers-color-scheme: dark)");
    const update=()=>{const theme=document.documentElement.dataset.theme;setState({dark:theme==="dark"||(theme!=="light"&&!!media?.matches),ready:true});};
    update();
    const observer=new MutationObserver(update);observer.observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
    media?.addEventListener("change",update);
    return()=>{observer.disconnect();media?.removeEventListener("change",update);};
  },[]);
  return [state.dark,state.ready] as const;
}

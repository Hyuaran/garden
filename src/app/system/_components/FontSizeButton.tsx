"use client";
import { useFontSize } from "@/app/_lib/FontSizeProvider";
import { fontLabel, nextFontSize } from "@/app/_lib/font-size";
export default function FontSizeButton({ className, tipClassName }: { className: string; tipClassName: string }) {
  const { size, cycle } = useFontSize();
  const label = `文字の大きさ：${fontLabel[size]}（押すと${fontLabel[nextFontSize[size]]}）`;
  return <button type="button" className={className} aria-label={label} onClick={cycle}>
    <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1 }}>あ</span>
    <span aria-hidden="true" style={{ position: "absolute", right: 3, bottom: 2, fontSize: 9, lineHeight: 1 }}>{fontLabel[size]}</span>
    <span className={tipClassName}>{label}</span>
  </button>;
}

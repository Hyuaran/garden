"use client";
import { useState } from "react";
import { todayJst } from "@/lib/haken/rules";
export default function ExcelButton({
  ids,
  onError,
}: {
  ids: string[];
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true);
    onError("");
    try {
      const response = await fetch("/api/system/haken/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `派遣先管理台帳_${todayJst().replaceAll("-", "")}.xlsx`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      onError(
        error instanceof Error ? error.message : "出力できませんでした。",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      disabled={busy || !ids.length}
      onClick={() => void download()}
    >
      Excel を出力する
    </button>
  );
}

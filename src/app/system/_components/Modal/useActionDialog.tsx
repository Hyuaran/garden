"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";

/** ブラウザの確認・理由入力を共通の小窓で行う。 */
export function useActionDialog() {
  const [request, setRequest] = useState<{ message: string; input: boolean; initial: string } | null>(null);
  const [value, setValue] = useState("");
  const resolve = useRef<((value: string | null) => void) | null>(null);
  useEffect(() => () => { resolve.current?.(null); }, []);
  function finish(result: string | null) {
    const done = resolve.current;
    resolve.current = null;
    setRequest(null);
    done?.(result);
  }
  function ask(message: string, input: boolean, initial = "") {
    if (resolve.current) return Promise.resolve(null);
    setValue(initial);
    setRequest({ message, input, initial });
    return new Promise<string | null>(done => { resolve.current = done; });
  }
  return {
    confirm: async (message: string) => (await ask(message, false)) !== null,
    prompt: (message: string, initial = "") => ask(message, true, initial),
    dialog: request && <Modal title={request.input ? "理由の入力" : "確認"} size="sm" onClose={() => finish(null)} actions={<>
      <button type="button" data-modal-action="secondary" onClick={() => finish(null)}>やめる</button>
      <button type="button" data-modal-action={request.input ? "primary" : "danger"} onClick={() => finish(request.input ? value : "ok")}>{request.input ? "次へ" : "実行する"}</button>
    </>}><p style={{ whiteSpace: "pre-wrap" }}>{request.message}</p>{request.input && <label>理由<textarea value={value} onChange={event => setValue(event.target.value)} /></label>}</Modal>,
  };
}

"use client";

import { useMemo } from "react";
import { toHalfWidthKana } from "../../../../lib/zengin/kana-converter";
import { transferFormStyles as styles } from "./transferFormStyles";

interface Props {
  input: string;
  label?: string;
}

export function KanaPreview({ input, label = "半角カナ変換結果" }: Props) {
  const result = useMemo(() => {
    if (!input || input.trim() === "") return null;
    return toHalfWidthKana(input);
  }, [input]);

  if (!result) return null;

  return (
    <div className={`${styles.hint} mt-1`}>
      <span className="font-medium">{label}:</span>{" "}
      <span className="font-mono text-text-main">{result.kana}</span>
      {result.warnings.length > 0 && (
        <span className="ml-2 text-[#b3892e]">（{result.warnings.join(" / ")}）</span>
      )}
    </div>
  );
}

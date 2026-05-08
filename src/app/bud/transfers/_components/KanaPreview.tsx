"use client";

import { useMemo } from "react";
import { toHalfWidthKana } from "../../../../lib/zengin/kana-converter";

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
    <div className="text-xs text-gray-500 mt-1">
      <span className="font-medium">{label}:</span>{" "}
      <span className="font-mono text-gray-700">{result.kana}</span>
      {result.warnings.length > 0 && (
        <span className="ml-2 text-amber-600">（{result.warnings.join(" / ")}）</span>
      )}
    </div>
  );
}
